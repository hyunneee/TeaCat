import { useEffect, useState } from 'react';
import { pickDeckArt, type ArtCandidate, type DeckArt } from '../model/memoryGame.model';

/**
 * 그림을 다 받기까지 기다려 주는 시간.
 *
 * 포토카드 그림은 IPFS 게이트웨이에서 옵니다(`gateway.pinata.cloud`). 게이트웨이가
 * 느린 날에 사용자를 무한정 세워 둘 수는 없어서, 이만큼 지나면 **포기하고 시드 SVG**
 * 로 갑니다. 반만 받아 놓고 시작하는 선택지는 없습니다 (`pickDeckArt` 주석).
 */
const PRELOAD_TIMEOUT_MS = 6000;

export interface MemoryArt {
  /** 쓸 준비가 끝난 그림 8종. 준비가 안 됐거나 실패했으면 빈 배열(= 시드 SVG) */
  art: DeckArt[];
  /** 아직 고르는·받는 중. 이 동안은 게임을 시작시키지 않습니다 */
  loading: boolean;
}

/**
 * 판에 쓸 **실제 포토카드 그림**을 골라서 미리 받아 둡니다.
 *
 * ── 🔴 왜 미리 받는가 ───────────────────────────────────────
 * 뒤집기 게임에서 그림이 늦게 뜨는 것은 느린 정도가 아니라 **정답이 보이는 버그**입니다.
 * 카드를 뒤집었는데 잠시 비어 있다가 채워지면, 그 사이에 옆 카드가 먼저 그려져
 * 짝을 눈이 아니라 로딩 순서로 찾게 됩니다. 그래서 8종을 **전부 디코드한 뒤에만**
 * 내주고, 그 전에는 빈 배열을 돌려 시드 SVG 로 깔립니다.
 *
 * ⚠️ 후보는 화면(페이지)이 넘깁니다. `features/token` 이 `features/nft` 를 직접 부르면
 * `features/nft` → `features/token`(tokenKeys) 와 **순환 참조**가 됩니다.
 */
export function useMemoryArt(candidates: ArtCandidate[], pending = false): MemoryArt {
  const picked = pickDeckArt(candidates);
  /* 후보 배열은 렌더마다 새로 만들어지므로 **내용**으로 비교합니다 */
  const signature = picked.map((a) => a.imageUrl).join('|');

  /** 받기를 마친 서명. signature 와 같아야 그 그림을 쓸 수 있습니다 */
  const [loaded, setLoaded] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!signature) return;

    let alive = true;
    const finish = (ok: boolean) => {
      if (!alive) return;
      setFailed(!ok);
      setLoaded(signature);
    };

    /* signature 에서 되꺼냅니다 — picked 를 의존성에 넣으면 렌더마다 다시 받습니다 */
    const urls = signature.split('|');
    const timer = setTimeout(() => finish(false), PRELOAD_TIMEOUT_MS);

    Promise.all(urls.map(preload))
      .then(() => finish(true))
      .catch(() => finish(false))
      .finally(() => clearTimeout(timer));

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [signature]);

  const ready = signature !== '' && loaded === signature && !failed;

  return {
    art: ready ? picked : [],
    loading: pending || (signature !== '' && loaded !== signature),
  };
}

/** 브라우저 캐시에 올려 둡니다. 실제 `<img>` 는 같은 주소라 곧바로 그려집니다 */
function preload(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`포토카드 그림을 받지 못했습니다`));
    image.src = url;
  });
}
