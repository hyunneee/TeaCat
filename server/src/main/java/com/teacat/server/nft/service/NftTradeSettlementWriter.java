package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.entity.NftAuction;
import com.teacat.server.nft.entity.NftPhotocardTrade;
import com.teacat.server.nft.entity.NftTradeChainStatus;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.nft.repository.NftPhotocardRepository;
import com.teacat.server.nft.repository.NftPhotocardTradeRepository;
import com.teacat.server.wallet.client.BlockchainProperties;
import com.teacat.server.wallet.entity.CatMoneyHoldRefType;
import com.teacat.server.wallet.entity.Wallet;
import com.teacat.server.wallet.entity.WalletOwner;
import com.teacat.server.wallet.exception.WalletErrorCode;
import com.teacat.server.wallet.repository.WalletOwnerRepository;
import com.teacat.server.wallet.repository.WalletRepository;
import com.teacat.server.wallet.service.CatMoneyHoldService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** 체인 I/O 전후의 짧은 DB 트랜잭션만 소유한다. */
@Component
@RequiredArgsConstructor
public class NftTradeSettlementWriter {
    private final NftPhotocardTradeRepository tradeRepository;
    private final NftPhotocardRepository photocardRepository;
    private final WalletOwnerRepository walletOwnerRepository;
    private final WalletRepository walletRepository;
    private final BlockchainProperties blockchainProperties;
    private final CatMoneyHoldService holdService;

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
                trade.getRefundOperationKey(), trade.getRefundTxHash(), buyer, seller);
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
    public record SettlementCommand(Long tradeId, NftTradeChainStatus status, int retryCount, long price,
                                    String chainTokenId, String catKey, String catTxHash,
                                    String nftKey, String nftTxHash, String refundKey, String refundTxHash,
                                    WalletRef buyer, WalletRef seller) {}
}
