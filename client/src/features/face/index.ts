/**
 * 얼굴 등록 feature 의 공개 API.
 *
 * 🔴 이 배럴에 **이미지를 다루는 것을 export 하지 마세요.**
 *    얼굴 원본은 이 feature 안(워커)에서 시작해서 안에서 끝납니다.
 *    밖으로 나가는 건 임베딩(Float32Array)과 화면용 좌표뿐입니다. (CLAUDE.md 7장)
 */

// Controller
export { useCamera, type CameraError, type CameraErrorCode } from './hooks/useCamera';
export { useFaceEngine, type EngineState } from './hooks/useFaceEngine';
export { useFaceGuide } from './hooks/useFaceGuide';
export { useAutoShutter, type AutoShutter } from './hooks/useAutoShutter';
export {
  useGuidedCapture,
  type GuidedSession,
  type StepCheck,
} from './hooks/useGuidedCapture';
export { useFaceRegistration } from './hooks/useFaceRegistration';
export { useFaceRemoval } from './hooks/useFaceRemoval';
export { useFaceVerify } from './hooks/useFaceVerify';

// View
export { CameraStage } from './components/CameraStage';

// Model
export { faceApi } from './api/faceApi';
export {
  checkFaceQuality,
  selectPrimaryFace,
  readPose,
  type FacePose,
  FACE_GUIDE_IDLE,
  FACE_GUIDE_READY,
} from './model/faceQuality';
export { cosineSimilarity, centroidOf, SFACE_COSINE_THRESHOLD } from './model/embedding';
export { REGISTER_STEPS, BENCH_STEPS, type CaptureStep } from './model/captureSteps';
export type {
  FaceEnrollRequest,
  FaceVerifyRequest,
  FaceVerifyResult,
  DetectedFace,
  FaceQualityCode,
  FaceQualityIssue,
} from './model/face.types';
