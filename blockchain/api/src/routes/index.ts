import { Router } from 'express';
import { internalAuth } from '../middlewares/internalAuth';
import { getHealth } from '../controllers/health.controller';
import { createWallet } from '../controllers/wallet.controller';
import { asyncHandler } from '../shared/http';

/**
 * 라우팅은 선언만 합니다. 검증은 controller, 판단은 service, 체인은 chain/.
 */
export const router = Router();

// 헬스체크만 인증 없이 열어둡니다.
router.get('/health', asyncHandler(getHealth));

// 나머지는 전부 Spring 전용입니다.
const internal = Router();
internal.use(internalAuth);

internal.post('/wallets', createWallet);

// 쓰기 엔드포인트는 202 + txHash 를 즉시 돌려주고, 확정은 Spring 이 폴링합니다.
// (DESIGN.md 4-2, 7장)
//
//   internal.post('/tickets/issue', …)
//   internal.get('/tx/:txHash', …)

router.use('/internal', internal);
