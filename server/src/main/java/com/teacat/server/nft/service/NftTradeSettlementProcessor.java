package com.teacat.server.nft.service;

import com.teacat.server.nft.client.PhotocardChainClient;
import com.teacat.server.nft.client.PhotocardTransferResult;
import com.teacat.server.nft.entity.NftTradeChainStatus;
import com.teacat.server.wallet.client.CatMoneyClient;
import com.teacat.server.wallet.client.BlockchainApiException;
import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.wallet.client.CatMoneyWriteResult;
import com.teacat.server.wallet.client.TxReportResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigInteger;
import java.util.Optional;

/** 서로 원자적이지 않은 두 체인 전송을 멱등 키와 보상으로 이어 붙인다. */
@Slf4j
@Component
@RequiredArgsConstructor
public class NftTradeSettlementProcessor {
    private final NftTradeSettlementWriter writer;
    private final CatMoneyClient catMoneyClient;
    private final PhotocardChainClient photocardChainClient;

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void process(Long tradeId) {
        NftTradeSettlementWriter.SettlementCommand command = writer.command(tradeId);
        try {
            switch (command.status()) {
                case PENDING -> submitCat(command);
                case CAT_SUBMITTED -> confirmCat(command);
                case CAT_CONFIRMED -> submitNft(command);
                case NFT_SUBMITTED -> confirmNft(command);
                case COMPENSATING -> submitRefund(command);
                case REFUND_SUBMITTED -> confirmRefund(command);
                default -> { }
            }
        } catch (RuntimeException e) {
            log.warn("NFT 거래 정산 단계를 처리하지 못했습니다. tradeId={} status={}",
                    tradeId, command.status(), e);
            writer.retry(tradeId, errorCode(e));
        }
    }

    private void submitCat(NftTradeSettlementWriter.SettlementCommand c) {
        CatMoneyWriteResult result = catMoneyClient.transfer(
                c.catKey(), c.buyer().address(), c.buyer().derivationIndex(), c.seller().address(),
                BigInteger.valueOf(c.price()), c.tradeId().toString());
        if (result.isPending()) writer.catSubmitted(c.tradeId(), result.txHash());
        else writer.catConfirmed(c.tradeId());
    }

    private void confirmCat(NftTradeSettlementWriter.SettlementCommand c) {
        Optional<TxReportResult> report = catMoneyClient.findTxReport(c.catTxHash());
        if (report.isEmpty()) {
            writer.dropped(c.tradeId(), NftTradeChainStatus.CAT_SUBMITTED, "CAT_TX_DROPPED");
            return;
        }
        String status = report.get().status();
        if ("CONFIRMED".equals(status) || "ALREADY_DONE".equals(status)) writer.catConfirmed(c.tradeId());
        else if ("FAILED".equals(status)) writer.abortBeforePayment(
                c.tradeId(), reportFailureCode("CAT", report.get()));
    }

    private void submitNft(NftTradeSettlementWriter.SettlementCommand c) {
        PhotocardTransferResult result = photocardChainClient.transfer(
                c.nftKey(), c.seller().address(), c.seller().derivationIndex(), c.buyer().address(),
                c.chainTokenId(), c.tradeId().toString());
        if (result.isPending()) writer.nftSubmitted(c.tradeId(), result.txHash());
        else writer.nftSubmitted(c.tradeId(), null);
        if (result.isAlreadyDone()) writer.complete(c.tradeId());
    }

    private void confirmNft(NftTradeSettlementWriter.SettlementCommand c) {
        if (c.nftTxHash() == null) {
            writer.complete(c.tradeId());
            return;
        }
        Optional<TxReportResult> report = catMoneyClient.findTxReport(c.nftTxHash());
        if (report.isEmpty()) {
            writer.dropped(c.tradeId(), NftTradeChainStatus.NFT_SUBMITTED, "NFT_TX_DROPPED");
            return;
        }
        String status = report.get().status();
        if ("CONFIRMED".equals(status) || "ALREADY_DONE".equals(status)) writer.complete(c.tradeId());
        else if ("FAILED".equals(status)) writer.startCompensation(
                c.tradeId(), reportFailureCode("NFT", report.get()));
    }

    private void submitRefund(NftTradeSettlementWriter.SettlementCommand c) {
        CatMoneyWriteResult result = catMoneyClient.transfer(
                c.refundKey(), c.seller().address(), c.seller().derivationIndex(), c.buyer().address(),
                BigInteger.valueOf(c.price()), c.tradeId().toString());
        if (result.isPending()) writer.refundSubmitted(c.tradeId(), result.txHash());
        else {
            writer.refundSubmitted(c.tradeId(), null);
            writer.compensate(c.tradeId());
        }
    }

    private void confirmRefund(NftTradeSettlementWriter.SettlementCommand c) {
        if (c.refundTxHash() == null) {
            writer.compensate(c.tradeId());
            return;
        }
        Optional<TxReportResult> report = catMoneyClient.findTxReport(c.refundTxHash());
        if (report.isEmpty()) {
            writer.dropped(c.tradeId(), NftTradeChainStatus.REFUND_SUBMITTED, "REFUND_TX_DROPPED");
            return;
        }
        String status = report.get().status();
        if ("CONFIRMED".equals(status) || "ALREADY_DONE".equals(status)) writer.compensate(c.tradeId());
        else if ("FAILED".equals(status)) writer.dropped(
                c.tradeId(), NftTradeChainStatus.REFUND_SUBMITTED,
                reportFailureCode("REFUND", report.get()));
    }

    private String errorCode(RuntimeException e) {
        if (e instanceof BlockchainApiException api && api.getRemoteCode() != null) {
            return safeCode(api.getRemoteCode(), "CHAIN_REQUEST_FAILED");
        }
        if (e instanceof BusinessException business) {
            return switch (business.getErrorCode().getCode()) {
                case "WALLET_005" -> "INSUFFICIENT_BALANCE";
                case "NFT_051", "WALLET_007", "WALLET_009" -> "CHAIN_UNAVAILABLE";
                case "WALLET_002" -> "BLOCKCHAIN_NOT_CONFIGURED";
                default -> safeCode(business.getErrorCode().getCode(), "SETTLEMENT_REJECTED");
            };
        }
        if (e instanceof IllegalStateException) {
            return "SETTLEMENT_STATE_CONFLICT";
        }
        return "UNEXPECTED_SETTLEMENT_ERROR";
    }

    private String reportFailureCode(String stage, TxReportResult report) {
        if (report.error() == null) {
            return stage + "_TX_REVERTED";
        }
        String message = report.error().message();
        if (message != null && message.contains("InsufficientBalance")) {
            return "INSUFFICIENT_BALANCE";
        }
        String code = report.error().code();
        if ("CHAIN_REVERTED".equals(code) || "REVERT".equals(code)) {
            return stage + "_TX_REVERTED";
        }
        return safeCode(code, stage + "_TX_FAILED");
    }

    private String safeCode(String value, String fallback) {
        if (value == null || !value.matches("[A-Z][A-Z0-9_]{0,99}")) {
            return fallback;
        }
        return value;
    }
}
