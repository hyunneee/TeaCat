/**
 * payment feature 의 공개 API.
 *
 * PG(포트원) SDK 의존은 이 폴더 안에만 있습니다.
 * 화면은 `usePayment` 만 알면 되고, PG 를 바꾸거나 실제 결제를 켜도
 * 화면 코드는 건드리지 않습니다.
 */
export { usePayment, type PaymentStage } from './hooks/usePayment';
export { paymentApi } from './api/paymentApi';
export { PAY_METHOD_LABEL } from './model/payment.model';
export type {
  PayMethod,
  PaymentPrepareResponse,
  PaymentAuthResult,
  PaymentConfirmResponse,
  PaymentFailure,
} from './model/payment.types';
