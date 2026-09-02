import { mock } from '../router';
import { requireUser } from './auth';

/**
 * 캣머니(토큰).
 *
 * 벌기 컨텐츠는 아직 미정이라 **잔액 조회만** 열어둡니다.
 * 잔액을 깎는 쪽(포카 구매·캣머니 결제)은 각자 핸들러에서 `user.tokenBalance` 를
 * 직접 줄입니다 — 실서버에서도 **차감은 서버가** 합니다.
 */
mock('GET', '/me/token', (ctx) => {
  const user = requireUser(ctx.headers);
  return { balance: user.tokenBalance, symbol: 'CATMONEY' };
});
