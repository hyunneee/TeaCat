import { useCallback, useEffect, useRef, useState } from 'react';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { env } from '@/shared/config';
import type { DetectedFace } from '../model/face.types';
import type { FaceWorkerRequest, FaceWorkerResponse } from '../model/faceWorkerProtocol';

/**
 * 얼굴 추론 엔진(워커)의 수명과 요청/응답을 관리합니다.
 *
 * 화면은 `detect(video)` 와 `embed(video)` 두 개만 알면 됩니다 —
 * 워커도, ONNX 도, wasm 경로도 모릅니다.
 *
 * ── 프레임은 복사하지 않습니다 ────────────────────────────
 * `createImageBitmap` 으로 만든 뒤 **transfer** 로 넘깁니다.
 * 넘긴 순간 이쪽에서는 못 쓰게 되고(소유권 이동), 워커가 다 쓰면 close() 합니다.
 */

export type EngineState = 'idle' | 'loading' | 'ready' | 'failed';

export interface EmbedResult {
  faces: DetectedFace[];
  embedding: Float32Array | null;
  sharpness: number;
  brightness: number;
}

/** 가이드 루프에 쓰는 검출 해상도. 원본을 통째로 넘기면 5fps 를 못 지킵니다. */
const GUIDE_FRAME = 320;

/**
 * @param enabled 켜기 전까지는 **아무것도 받지 않습니다.**
 *   화면에 들어왔다는 이유만으로 4.5MB 를 내려받으면, 들어왔다 바로 나가는
 *   사람의 데이터를 그냥 태워버리는 셈입니다. 카메라를 켜는 순간부터 받습니다.
 *   (권한 팝업이 뜨는 몇 초가 모델을 받는 시간을 가려 줍니다)
 */
export function useFaceEngine(enabled: boolean) {
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);
  /** id → 응답을 기다리는 쪽 */
  const pendingRef = useRef(new Map<number, (result: FaceWorkerResponse) => void>());

  const [state, setState] = useState<EngineState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const worker = new Worker(new URL('../model/face.worker.ts', import.meta.url), {
      type: 'module',
      name: 'face-engine',
    });
    workerRef.current = worker;
    const pending = pendingRef.current;

    worker.onmessage = (event: MessageEvent<FaceWorkerResponse>) => {
      const message = event.data;

      if (message.type === 'ready') {
        setState('ready');
        return;
      }
      if (message.type === 'failed' && message.id === undefined) {
        setState('failed');
        setError(message.message);
        return;
      }

      const id = 'id' in message ? message.id : undefined;
      if (id === undefined) return;

      const resolve = pending.get(id);
      pending.delete(id);
      resolve?.(message);
    };

    // 워커 자체가 못 뜨는 경우(번들 오류 등)
    worker.onerror = () => {
      setState('failed');
      setError('얼굴 인식을 준비하지 못했어요.');
    };

    setState('loading');
    const init: FaceWorkerRequest = {
      type: 'init',
      wasmUrl,
      detectorUrl: env.face.detectorUrl,
      embedderUrl: env.face.embedderUrl,
    };
    worker.postMessage(init);

    return () => {
      // 남아 있는 대기자를 깨워서 화면이 영원히 로딩에 걸리지 않게 합니다.
      pending.forEach((resolve) =>
        resolve({ type: 'failed', message: '화면을 벗어났습니다.' }),
      );
      pending.clear();
      worker.terminate();
      workerRef.current = null;
      setState('idle');
    };
  }, [enabled]);

  /** 프레임을 워커로 넘기고 응답을 기다립니다 */
  const send = useCallback(
    async (
      type: 'detect' | 'embed',
      source: HTMLVideoElement | ImageBitmap,
      size?: number,
    ): Promise<FaceWorkerResponse | null> => {
      const worker = workerRef.current;
      if (!worker) return null;

      const isVideo = source instanceof HTMLVideoElement;
      if (isVideo && source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;

      const height = isVideo ? source.videoHeight : source.height;
      const width = isVideo ? source.videoWidth : source.width;

      const frame = size
        ? await createImageBitmap(source, {
            resizeWidth: size,
            resizeHeight: Math.max(1, Math.round((size * height) / width)),
            resizeQuality: 'low',
          })
        : await createImageBitmap(source);

      const id = (seqRef.current += 1);

      return new Promise((resolve) => {
        pendingRef.current.set(id, resolve);
        const request: FaceWorkerRequest = { type, id, frame };
        try {
          // frame 은 transfer — 이 시점부터 메인 스레드에서는 못 씁니다.
          // 넘어간 뒤의 해제는 워커가 책임집니다 (face.worker.ts 의 release).
          worker.postMessage(request, [frame]);
        } catch {
          // 워커가 이미 죽었으면 프레임이 갈 곳이 없습니다. 여기서 놓아줍니다.
          frame.close();
          pendingRef.current.delete(id);
          resolve({ type: 'failed', id, message: '얼굴 인식이 중단됐어요.' });
        }
      });
    },
    [],
  );

  /** 가이드용 — 가볍게, 자주 */
  const detect = useCallback(
    async (video: HTMLVideoElement): Promise<DetectedFace[]> => {
      const result = await send('detect', video, GUIDE_FRAME);
      return result?.type === 'detected' ? result.faces : [];
    },
    [send],
  );

  /**
   * 캡처용 — 무거운 모델을 **여기서 딱 한 번** 돌립니다.
   * 카메라 프레임(HTMLVideoElement)과 정지 이미지(ImageBitmap) 둘 다 받습니다.
   * (정지 이미지는 개발용 검증 화면에서 파일을 넣을 때 씁니다)
   */
  const embed = useCallback(
    async (source: HTMLVideoElement | ImageBitmap): Promise<EmbedResult | { error: string }> => {
      const result = await send('embed', source);
      if (!result) return { error: '카메라 화면을 아직 읽을 수 없어요.' };
      if (result.type === 'failed') return { error: result.message };
      if (result.type !== 'embedded') return { error: '얼굴을 처리하지 못했어요.' };

      return {
        faces: result.faces,
        embedding: result.embedding,
        sharpness: result.sharpness,
        brightness: result.brightness,
      };
    },
    [send],
  );

  return { state, error, detect, embed };
}
