import { Router } from 'express';
import { internalAuth } from '../middlewares/internalAuth';
import { getHealth } from '../controllers/health.controller';
import { createWallet } from '../controllers/wallet.controller';
import { getTx } from '../controllers/tx.controller';
import {
  getCatMoneyBalance,
  postCatMoneyBurn,
  postCatMoneyMint,
} from '../controllers/catMoney.controller';
import {
  getTicket,
  getTicketByKey,
  postTicketBurn,
  postTicketIssue,
} from '../controllers/ticket.controller';
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

// 시드 발행이 붙으면서 쓰기가 됐습니다. async 는 반드시 감싸야 합니다.
internal.post('/wallets', asyncHandler(createWallet));

// 캣머니. 발행과 소각으로만 움직입니다 — 트레저리가 없습니다. (DESIGN.md 6장 ②)
internal.get('/tokens/catmoney/balance', asyncHandler(getCatMoneyBalance));
internal.post('/tokens/catmoney/mint', asyncHandler(postCatMoneyMint));
internal.post('/tokens/catmoney/burn', asyncHandler(postCatMoneyBurn));

/* 티켓 SBT. 양도할 수 없고, 취소하면 소각됩니다. (DESIGN.md 6장 ①)
   좌석·공연·입장 여부는 Spring 의 티켓 DB 가 소유합니다 — 여기엔 없습니다.

   주의: `/tickets/by-key` 를 `/tickets/:tokenId` **앞에** 둡니다.
         뒤에 두면 :tokenId 가 "by-key" 를 먼저 삼켜서 400 이 납니다. */
internal.post('/tickets/issue', asyncHandler(postTicketIssue));
internal.get('/tickets/by-key', asyncHandler(getTicketByKey));
internal.get('/tickets/:tokenId', asyncHandler(getTicket));
internal.post('/tickets/:tokenId/burn', asyncHandler(postTicketBurn));

// 모든 쓰기의 최종 성공 여부를 확인하는 곳입니다. (DESIGN.md 4-2, 7장)
internal.get('/tx/:txHash', asyncHandler(getTx));

router.use('/internal', internal);
