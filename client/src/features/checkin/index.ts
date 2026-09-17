/**
 * 게이트 입장 확인 (검표).
 *
 * QR 로 표를 찾고 → 예매 당시 얼굴과 대조하고 → 통과하면 서버가 입장 처리합니다.
 * **ADMIN 전용 화면**(`/admin/check-in`)에서만 씁니다.
 *
 * 🔴 얼굴 원본은 이 feature 밖으로 나가지 않습니다. 나가는 것은 임베딩과 판정뿐이고,
 *    대조는 서버가 합니다 (client/CLAUDE.md 7장 · `api/checkInApi.ts` 주석).
 */

// Controller
export { useCheckIn, type CheckIn, type CheckInStep } from './hooks/useCheckIn';
export { useQrScanner, type QrScanner } from './hooks/useQrScanner';
export { useFaceCapture, type FaceCapture } from './hooks/useFaceCapture';

// View
export { QrScanStage } from './components/QrScanStage';
export { CheckInTicketCard } from './components/CheckInTicketCard';
export { CheckInResultCard } from './components/CheckInResultCard';

// Model
export { checkInApi } from './api/checkInApi';
export type { CheckInResult, CheckInSource, CheckInTicket } from './model/checkIn.types';
