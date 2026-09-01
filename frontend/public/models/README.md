# 얼굴 인식 모델 파일

여기 있는 ONNX 두 개로 얼굴 등록이 동작합니다.
용량이 커서 저장소에 커밋하지 않습니다(`.gitignore`). 없으면 등록 화면이
"얼굴 인식을 준비하지 못했어요" 로 끝납니다 (앱의 나머지는 정상 동작).

| 파일 | 무엇 | 크기 | 출처 |
|---|---|---|---|
| `face_detection_yunet_2023mar.onnx` | 얼굴 검출 + 5점 랜드마크 | 232 KB | OpenCV Zoo |
| `face_recognition_sface_2021dec_int8.onnx` | 128차원 임베딩 | 9.9 MB | OpenCV Zoo (INT8) |

경로·파일명은 `.env.*` 의 `VITE_FACE_DETECTOR_URL` · `VITE_FACE_EMBEDDER_URL` 에 있습니다.
CDN 주소를 넣어도 됩니다.

## 실측 규격 — 추측하지 말고 이걸 보세요

`node scripts/inspect-face-models.mjs` 가 모델에서 직접 읽어 출력합니다.
아래는 그 결과이고, 코드가 이 값에 맞춰져 있습니다.

### 검출기 — YuNet 2023mar

```
입력   input  [1, 3, 640, 640]  float32 · BGR · 0~255 · 정규화 없음
출력   cls_8  [1, 6400, 1]   cls_16  [1, 1600, 1]   cls_32  [1, 400, 1]
       obj_8  [1, 6400, 1]   obj_16  [1, 1600, 1]   obj_32  [1, 400, 1]
       bbox_8 [1, 6400, 4]   bbox_16 [1, 1600, 4]   bbox_32 [1, 400, 4]
       kps_8  [1, 6400,10]   kps_16  [1, 1600,10]   kps_32  [1, 400,10]
```

🔴 **입력 shape 이 640 으로 고정입니다.** OpenCV 의 YuNet 은 `setInputSize` 로
크기를 바꿀 수 있지만 이 ONNX 파일은 640 고정으로 export 돼 있어서,
onnxruntime-web 이 다른 크기를 **거부합니다.**
그래서 프레임을 640 정사각으로 **레터박스**해 넣고, 좌표에서 여백을 되돌립니다.
(`features/face/model/face.worker.ts` 의 `fitFrame`)

격자 개수가 곧 디코딩 전제입니다 — 6400 = 80×80(640/8), 1600 = 40×40, 400 = 20×20, 행 우선.

### 인식기 — SFace 2021dec INT8

```
입력   data  [1, 3, 112, 112]  float32 · BGR · 0~255 · 정규화 없음
출력   fc1   [1, 128]
```

🔴 **`(x−127.5)/128` 를 쓰지 마세요.** 그건 MobileFaceNet 계열 관례입니다.
OpenCV 의 `FaceRecognizerSF::feature()` 는 `dnn::blobFromImage(aligned_img)` 를
**기본 인자로** 부릅니다 — scalefactor 1.0, mean (0,0,0), swapRB false.
OpenCV 이미지가 BGR 이므로 blob 도 **BGR 0~255** 입니다.
잘못 넣으면 세션은 멀쩡히 돌아가고 **유사도만 조용히 무너집니다.**

🔴 **임베딩은 128차원입니다** (512 아님). `mocks/handlers/face.ts` 의
`EMBEDDING_DIM`, 백엔드 검증, 게이트 검표가 모두 128 이어야 합니다.

### 5점 정렬

`FaceRecognizerSF::alignCrop` 과 같은 기준점(112×112)으로 **닮음 변환**합니다.
어파인이 아닙니다 — 어파인은 얼굴을 늘려 사람마다 다른 비율을 지웁니다.

```
[38.2946, 51.6963]  [73.5318, 51.5014]  [56.0252, 71.7366]
[41.5493, 92.3655]  [70.7299, 92.2041]
```

YuNet 의 첫 랜드마크는 "사람의 오른눈" = **이미지 왼쪽**이고 위 첫 점도 x=38.3(왼쪽)이라
**인덱스 그대로 1:1** 로 맞습니다. 다시 정렬하지 마세요.

## 임계값

**SFace 공식 권장 코사인 임계값은 `0.363`** 입니다 (OpenCV Zoo `demo.py`).
ArcFace 감각으로 0.6~0.7 을 기대하면 같은 사람을 자꾸 거절하게 됩니다.
같은 사람이 0.4~0.7 사이로 나오는 게 정상입니다.

## 검증

```bash
node scripts/inspect-face-models.mjs     # 입출력 규격 확인
node scripts/verify-face-pipeline.mjs    # 세션·shape·정렬 수학·지연 확인
```

실제 얼굴 정확도는 개발 서버의 **`/dev/face`** 화면에서 사진 3장으로 봅니다
(같은 사람 2장 + 다른 사람 1장 → 코사인 유사도 표시). 운영 번들에는 없는 화면입니다.

## 넣지 말아야 할 것

- ❌ **안티스푸핑(라이브니스) 모델** — 다음 단계 작업입니다.
- ❌ 두 번째 WASM 런타임 (MediaPipe·tfjs) — 런타임은 onnxruntime 하나뿐입니다.
- ❌ 얼굴 이미지 샘플 — 이 저장소에 얼굴 사진을 커밋하지 마세요.

## 용량 메모

첫 진입 5MB 목표는 **취소**됐습니다 (SFace INT8 이 9.9MB). 지금은 정확도가 우선입니다.
그래도 아래는 유지합니다.

- 모델·런타임은 **카메라를 켤 때부터** 받습니다 (화면 진입만으로는 0바이트)
- **Cache API**(`tikat-face-models-v1`)로 재방문 시 재다운로드 없음
- 서비스워커 precache 대상 아님 (`vite.config.ts` 의 `globPatterns` 에 `onnx`·`wasm` 없음)
- ORT 런타임 13.3MB → 빌드 시 `.wasm.gz` 3.44MB 로 전송

나중에 줄일 여지: SFace 를 더 작은 인식 모델로 교체하거나, `.onnx` 도 gzip 전송.
