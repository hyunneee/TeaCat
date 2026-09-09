-- ================================
-- NFT 소각 상태
-- ================================
-- 예매를 취소하면 SBT 를 태우는데, 지금은 그 사실이 burn_tx_hash 가 채워졌는지로만 드러난다.
-- 그래서 status 는 MINTED 인데 실제로는 소각된 행이 생기고, API 응답만 보면 구분되지 않는다.
--
-- 상태 하나로 읽히게 값을 추가한다.
--
-- 블록체인 서비스와 충돌하지 않는다 — 그쪽이 status 를 건드리는 SQL 은 전부
-- PENDING / MINTING 으로 게이트돼 있어서 BURNED 행은 대상이 되지 않는다.
--   markIssueSent   : WHERE status = 'PENDING'
--   markIssueResult : WHERE status IN ('PENDING', 'MINTING')
--   훑기(sweep)     : WHERE status = 'MINTING'
--   markBurnTx      : burn_tx_hash 만 쓰고 상태는 건드리지 않는다
--
-- 이 타입은 nft_photocards 와 공유한다. 포카는 아직 소각 경로가 없어 이 값을 쓰지 않지만,
-- 생기면 같은 의미로 쓰면 된다.

ALTER TYPE nft_mint_status ADD VALUE IF NOT EXISTS 'BURNED';
