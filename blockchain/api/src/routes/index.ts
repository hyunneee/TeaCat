import { Router } from 'express';
import { internalAuth } from '../middlewares/internalAuth';
import { getHealth } from '../controllers/health.controller';
import { getMetrics } from '../controllers/metrics.controller';
import { createWallet } from '../controllers/wallet.controller';
import { getTx } from '../controllers/tx.controller';
import {
  getCatMoneyBalance,
  postCatMoneyBurn,
  postCatMoneyMint,
  postCatMoneyTransfer,
} from '../controllers/catMoney.controller';
import {
  getTicket,
  getTicketByKey,
  postTicketBurn,
  postTicketIssue,
} from '../controllers/ticket.controller';
import {
  getPhotocardBalanceOf,
  getPhotocardByKey,
  postPhotocardDesign,
  postPhotocardIssue,
  postPhotocardTransfer,
} from '../controllers/photocard.controller';
import {
  getDraw,
  postDrawAssign,
  postDrawOpen,
  postDrawReveal,
} from '../controllers/draw.controller';
import { asyncHandler } from '../shared/http';

/**
 * 라우팅은 선언만 합니다. 검증은 controller, 판단은 service, 체인은 chain/.
 */
export const router = Router();

// 헬스체크와 지표만 인증 없이 열어둡니다. 둘 다 포트가 호스트로 나가지 않아
// teacat-net 안(= Prometheus 컨테이너)에서만 닿습니다.
router.get('/health', asyncHandler(getHealth));
router.get('/metrics', asyncHandler(getMetrics));

// 나머지는 전부 Spring 전용입니다.
const internal = Router();
internal.use(internalAuth);

// 시드 발행이 붙으면서 쓰기가 됐습니다. async 는 반드시 감싸야 합니다.
internal.post('/wallets', asyncHandler(createWallet));

// 캣머니. 발행과 소각으로만 움직입니다 — 트레저리가 없습니다. (DESIGN.md 6장 ②)
internal.get('/tokens/catmoney/balance', asyncHandler(getCatMoneyBalance));
internal.post('/tokens/catmoney/mint', asyncHandler(postCatMoneyMint));
internal.post('/tokens/catmoney/burn', asyncHandler(postCatMoneyBurn));
// 유저 간 전송. 포카 마켓 정산에서만 씁니다 — 발행도 소각도 아닙니다. (7장)
internal.post('/tokens/catmoney/transfer', asyncHandler(postCatMoneyTransfer));

/* 티켓 SBT. 양도할 수 없고, 취소하면 소각됩니다. (DESIGN.md 6장 ①)
   좌석·공연·입장 여부는 Spring 의 티켓 DB 가 소유합니다 — 여기엔 없습니다.

   주의: `/tickets/by-key` 를 `/tickets/:tokenId` **앞에** 둡니다.
         뒤에 두면 :tokenId 가 "by-key" 를 먼저 삼켜서 400 이 납니다. */
internal.post('/tickets/issue', asyncHandler(postTicketIssue));
internal.get('/tickets/by-key', asyncHandler(getTicketByKey));
internal.get('/tickets/:tokenId', asyncHandler(getTicket));
internal.post('/tickets/:tokenId/burn', asyncHandler(postTicketBurn));

/* 검증 가능한 추첨. 체인이 만드는 것은 **난수 하나**뿐이고, 배정은 그 난수로부터
   계산되는 순수 함수라 누가 계산하든 같습니다. (PHOTOCARD_PLAN.md 4장)

   `/reveal` 은 수동 개입용입니다 — 평소에는 `drawWatcher.service` 가 자동으로
   부릅니다. 블록해시가 42분만 남아서 사람 손에 맡길 수 없습니다.

   주의: `/draws/open` 을 `/draws/:drawKey` **앞에** 둡니다.
         뒤에 두면 :drawKey 가 "open" 을 먼저 삼킵니다. */
internal.post('/draws/open', asyncHandler(postDrawOpen));
internal.get('/draws/:drawKey', asyncHandler(getDraw));
internal.post('/draws/:drawKey/reveal', asyncHandler(postDrawReveal));
internal.post('/draws/:drawKey/assign', asyncHandler(postDrawAssign));

/* 포토카드 NFT (ERC-1155). **tokenId 는 카드 한 장이 아니라 도안입니다.**
   좌석·공연·소유자는 Spring 의 DB 가 소유합니다 — 여기엔 없습니다.

   주의: `/photocards/by-key` 와 `/photocards/balance` 는 경로 파라미터가 아니라
         쿼리를 씁니다. 카드 키가 자유 문자열이라 경로에 넣으면 깨집니다. */
internal.post('/photocards/designs', asyncHandler(postPhotocardDesign));
internal.post('/photocards/issue', asyncHandler(postPhotocardIssue));
internal.get('/photocards/by-key', asyncHandler(getPhotocardByKey));
internal.get('/photocards/balance', asyncHandler(getPhotocardBalanceOf));

/* 마켓 정산. **판매자 본인의 파생 키로 서명합니다.** 캣머니 전송과 원자적이지
   않아서 순서가 있습니다 — 캣머니 확정 → 카드 이전, 실패하면 캣머니를 되돌립니다.
   그 순서는 Spring 이 소유합니다. (PHOTOCARD_PLAN.md 7장) */
internal.post('/photocards/transfer', asyncHandler(postPhotocardTransfer));

// 모든 쓰기의 최종 성공 여부를 확인하는 곳입니다. (DESIGN.md 4-2, 7장)
internal.get('/tx/:txHash', asyncHandler(getTx));

router.use('/internal', internal);
