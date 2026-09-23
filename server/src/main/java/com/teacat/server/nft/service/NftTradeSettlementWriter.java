package com.teacat.server.nft.service;

import com.teacat.server.common.config.NftTradeReviewProperties;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.entity.NftAuction;
import com.teacat.server.nft.entity.NftPhotocardTrade;
import com.teacat.server.nft.entity.NftTradeChainStatus;
import com.teacat.server.nft.entity.NftTradeReview;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardRepository;
import com.teacat.server.nft.repository.NftPhotocardTradeRepository;
import com.teacat.server.nft.repository.NftTradeReviewRepository;
import com.teacat.server.wallet.client.BlockchainProperties;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.entity.Wallet;
import com.teacat.server.wallet.entity.WalletOwner;
import com.teacat.server.wallet.exception.WalletErrorCode;
import com.teacat.server.wallet.repository.WalletOwnerRepository;
import com.teacat.server.wallet.repository.WalletRepository;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** 체인 I/O 전후의 짧은 DB 트랜잭션만 소유한다. */
@Slf4j
@Component
@RequiredArgsConstructor
public class NftTradeSettlementWriter {
    private final NftPhotocardTradeRepository tradeRepository;
    private final NftPhotocardRepository photocardRepository;
    private final WalletOwnerRepository walletOwnerRepository;
    private final WalletRepository walletRepository;
    private final BlockchainProperties blockchainProperties;
    private final CatMoneyHoldService holdService;
    private final NftTradeRiskScreener riskScreener;
    private final NftTradeReviewRepository reviewRepository;
    private final NftTradeReviewProperties reviewProperties;

    @Transactional(readOnly = true)
    public SettlementCommand command(Long tradeId) {
        NftPhotocardTrade trade = tradeRepository.findById(tradeId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.TRADE_NOT_FOUND));
        WalletRef buyer = wallet(trade.getBuyer().getId());
        WalletRef seller = wallet(trade.getSeller().getId());
        return new SettlementCommand(
                trade.getId(), trade.getChainStatus(), trade.getRetryCount(), trade.getPrice(),
                trade.getPhotocard().getDesign().chainTokenIdOrLegacy().toPlainString(),
                trade.getSettleOperationKey(), trade.getSettleTxHash(),
                trade.getTransferOperationKey(), trade.getTransferTxHash(),
                trade.getRefundOperationKey(), trade.getRefundTxHash(), buyer, seller,
                trade.getRiskScreenedAt());
    }

    /**
     * 이상거래 심사 (AUCTION_FRAUD_DESIGN.md 4·6장). 체인 전송 전, PENDING 이고 아직 심사 안 한 거래에 한 번 돈다.
     *
     * <p>신호가 하나라도 있으면 심사 행을 남긴다 — 관리자 화면에 쌓이는 데이터다. 그 뒤는 모드에 따라 갈린다.
     * <ul>
     *   <li><b>FLAG</b>(기본) — 정산은 그대로 간다. 심사 시각을 찍고 PENDING 유지. 관리자는 나중에 정상·부정 판정만 기록한다.</li>
     *   <li><b>HOLD</b> — 보류 기준을 넘으면 {@code RISK_REVIEW} 로 바꾼다. 구매자·판매자 홀드는 그대로, 카드도 판매자 소유
     *       그대로다. 스케줄러가 이 상태를 집지 않으므로 관리자가 승인해 PENDING 으로 돌려놓을 때까지 멈춘다.</li>
     * </ul>
     *
     * @return 보류했으면 true — 호출자는 이번 주기에 체인 전송을 하지 않는다. FLAG 모드에서는 항상 false
     */
    @Transactional
    public boolean screen(Long tradeId) {
        NftPhotocardTrade trade = tradeRepository.findByIdForUpdate(tradeId)
                .orElseThrow(() -> new BusinessException(NftErrorCode.TRADE_NOT_FOUND));
        if (trade.getChainStatus() != NftTradeChainStatus.PENDING || trade.isRiskScreened()) {
            return false;
        }
        TradeRiskAssessment assessment = riskScreener.screen(tradeId);
        boolean hold = assessment.flagged() && reviewProperties.holds();
        if (!assessment.signals().isEmpty()) {
            reviewRepository.save(NftTradeReview.open(
                    trade, assessment.signals(), assessment.maxSeverity(), assessment.flagged(), hold));
            log.info("NFT 거래 이상거래 신호 tradeId={} severity={} flagged={} held={} rules={}",
                    tradeId, assessment.maxSeverity(), assessment.flagged(), hold, assessment.ruleCodes());
        }
        if (hold) {
            trade.holdForRiskReview();
            return true;
        }
        trade.clearRisk(LocalDateTime.now());
        return false;
    }

    @Transactional
    public void catSubmitted(Long tradeId, String txHash) {
        NftPhotocardTrade trade = lock(tradeId, NftTradeChainStatus.PENDING);
        trade.catSubmitted(txHash);
        holdService.recordCaptureTx(trade.getPaymentHoldRefType(), trade.getPaymentHoldRefId(), txHash);
    }

    @Transactional
    public void catConfirmed(Long tradeId) {
        NftPhotocardTrade trade = tradeRepository.findByIdForUpdate(tradeId).orElseThrow();
        if (trade.getChainStatus() != NftTradeChainStatus.PENDING
                && trade.getChainStatus() != NftTradeChainStatus.CAT_SUBMITTED) return;
        holdService.capture(trade.getPaymentHoldRefType(), trade.getPaymentHoldRefId());
        trade.catConfirmed();
    }

    @Transactional
    public void nftSubmitted(Long tradeId, String txHash) {
        lock(tradeId, NftTradeChainStatus.CAT_CONFIRMED).nftSubmitted(txHash);
    }

    @Transactional
    public void startCompensation(Long tradeId, String code) {
        NftPhotocardTrade trade = tradeRepository.findByIdForUpdate(tradeId).orElseThrow();
        if (trade.getChainStatus() == NftTradeChainStatus.CAT_CONFIRMED
                || trade.getChainStatus() == NftTradeChainStatus.NFT_SUBMITTED) {
            trade.startCompensation(code);
        }
    }

    @Transactional
    public void refundSubmitted(Long tradeId, String txHash) {
        lock(tradeId, NftTradeChainStatus.COMPENSATING).refundSubmitted(txHash);
    }

    @Transactional
    public void complete(Long tradeId) {
        NftPhotocardTrade trade = lock(tradeId, NftTradeChainStatus.NFT_SUBMITTED);
        WalletRef buyerWallet = wallet(trade.getBuyer().getId());
        var photocard = photocardRepository.findByIdForUpdate(trade.getPhotocard().getId())
                .orElseThrow(() -> new BusinessException(NftErrorCode.PHOTOCARD_NOT_FOUND));
        if (!photocard.isOwnedBy(trade.getSeller().getId())) {
            trade.manualReview("DB_OWNER_CHANGED");
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        photocard.transferTo(trade.getBuyer(), buyerWallet.walletId());
        /* 🔴 꾸밈은 **지우지 않는다.** 카드의 일부라 사는 사람이 그대로 받는다 (2026-09-23).
           ⚠️ 2026-09-22 에는 여기서 판 사람의 꾸밈을 지웠다. 마켓에 꾸민 모습을 보여주기로
              하면서 뒤집혔다 — 보여준 것과 받는 것이 달라지면 사는 사람이 속는다.
              꾸밈 행은 photocard_id 로만 묶여 있어 소유자가 바뀌어도 따라간다. */
        if (trade.getListing() != null) {
            trade.getListing().sold(now);
        } else {
            NftAuction auction = trade.getAuction();
            // 자연 낙찰은 최고 입찰 홀드 자체가 결제 원본이라 이미 CAPTURED 상태다.
            // 즉시구매는 별도 NFT_TRADE_BUYER 홀드로 결제하므로 기존 최고 입찰자가
            // 즉시구매자 본인이더라도 입찰 홀드를 반드시 해제해야 한다.
            if (auction.getTopBid() != null
                    && trade.getPaymentHoldRefType() != CatMoneyHoldRefType.AUCTION_BID) {
                holdService.release(CatMoneyHoldRefType.AUCTION_BID, auction.getTopBid().getId());
            }
            auction.soldTo(trade.getBuyer(), trade.getPrice(), now);
        }
        holdService.release(CatMoneyHoldRefType.NFT_TRADE_SELLER, tradeId);
        trade.complete(now);
    }

    @Transactional
    public void compensate(Long tradeId) {
        NftPhotocardTrade trade = lock(tradeId, NftTradeChainStatus.REFUND_SUBMITTED);
        holdService.release(CatMoneyHoldRefType.NFT_TRADE_SELLER, tradeId);
        restoreSource(trade, LocalDateTime.now());
        trade.compensated(LocalDateTime.now());
    }

    @Transactional
    public void abortBeforePayment(Long tradeId, String code) {
        NftPhotocardTrade trade = tradeRepository.findByIdForUpdate(tradeId).orElseThrow();
        if (trade.getChainStatus() != NftTradeChainStatus.PENDING
                && trade.getChainStatus() != NftTradeChainStatus.CAT_SUBMITTED) return;
        holdService.release(trade.getPaymentHoldRefType(), trade.getPaymentHoldRefId());
        holdService.release(CatMoneyHoldRefType.NFT_TRADE_SELLER, tradeId);
        restoreSource(trade, LocalDateTime.now());
        trade.fail(code);
    }

    @Transactional
    public void retry(Long tradeId, String code) {
        NftPhotocardTrade trade = tradeRepository.findByIdForUpdate(tradeId).orElseThrow();
        if (trade.getRetryCount() >= 4) {
            // HTTP 예외는 "전송 전 실패"와 "전송 후 응답 유실"을 구분할 수 없다.
            // 돈이나 카드가 이미 움직였을 수 있으므로 자동 해제·보상하지 않고 홀드를 유지한다.
            trade.manualReview(code);
            return;
        }
        trade.retryLater(code, LocalDateTime.now().plusSeconds(Math.min(60, 1L << trade.getRetryCount())));
    }

    @Transactional
    public void dropped(Long tradeId, NftTradeChainStatus stage, String code) {
        NftPhotocardTrade trade = tradeRepository.findByIdForUpdate(tradeId).orElseThrow();
        LocalDateTime next = LocalDateTime.now().plusSeconds(2);
        if (stage == NftTradeChainStatus.CAT_SUBMITTED) trade.retryCat(code, next);
        else if (stage == NftTradeChainStatus.NFT_SUBMITTED) trade.retryNft(code, next);
        else if (stage == NftTradeChainStatus.REFUND_SUBMITTED) trade.retryRefund(code, next);
    }

    @Transactional
    public void manualReview(Long tradeId, String code) {
        tradeRepository.findByIdForUpdate(tradeId).ifPresent(t -> t.manualReview(code));
    }

    private void restoreSource(NftPhotocardTrade trade, LocalDateTime now) {
        if (trade.getListing() != null) {
            trade.getListing().reopen();
            return;
        }
        NftAuction auction = trade.getAuction();
        if (trade.getPaymentHoldRefType() == CatMoneyHoldRefType.AUCTION_BID) {
            auction.expire(now);
        } else {
            auction.reopen();
        }
    }

    private NftPhotocardTrade lock(Long id, NftTradeChainStatus expected) {
        NftPhotocardTrade trade = tradeRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new BusinessException(NftErrorCode.TRADE_NOT_FOUND));
        if (trade.getChainStatus() != expected) {
            throw new IllegalStateException("정산 상태가 바뀌었습니다 tradeId=" + id);
        }
        return trade;
    }

    private WalletRef wallet(Long userId) {
        WalletOwner owner = walletOwnerRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(WalletErrorCode.WALLET_NOT_FOUND));
        Wallet wallet = walletRepository.findByOwnerIdAndChainId(owner.getId(), blockchainProperties.chainId())
                .orElseThrow(() -> new BusinessException(WalletErrorCode.WALLET_NOT_FOUND));
        return new WalletRef(wallet.getId(), wallet.getAddress().trim(), owner.getDerivationIndex());
    }

    public record WalletRef(Long walletId, String address, int derivationIndex) {}
    /** @param riskScreenedAt 이상거래 심사를 통과(또는 승인)한 시각. null 이면 체인 전송 전에 심사한다 */
    public record SettlementCommand(Long tradeId, NftTradeChainStatus status, int retryCount, long price,
                                    String chainTokenId, String catKey, String catTxHash,
                                    String nftKey, String nftTxHash, String refundKey, String refundTxHash,
                                    WalletRef buyer, WalletRef seller, LocalDateTime riskScreenedAt) {

        public boolean needsRiskScreening() {
            return status == NftTradeChainStatus.PENDING && riskScreenedAt == null;
        }
    }
}
