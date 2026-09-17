package com.teacat.server.nft.service;

import com.teacat.server.nft.client.PhotocardChainClient;
import com.teacat.server.nft.client.PhotocardTransferResult;
import com.teacat.server.nft.entity.NftTradeChainStatus;
import com.teacat.server.wallet.client.CatMoneyClient;
import com.teacat.server.wallet.client.BlockchainApiException;
import com.teacat.server.wallet.client.CatMoneyWriteResult;
import com.teacat.server.wallet.client.TxReportResult;
import com.teacat.server.nft.exception.NftErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigInteger;
import java.util.Optional;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.BDDMockito.willThrow;

@ExtendWith(MockitoExtension.class)
class NftTradeSettlementProcessorTests {
    private static final long TRADE_ID = 7L;
    private static final String TX = "0x111";

    @Mock NftTradeSettlementWriter writer;
    @Mock CatMoneyClient catMoneyClient;
    @Mock PhotocardChainClient photocardChainClient;
    private NftTradeSettlementProcessor processor;

    @BeforeEach
    void setUp() {
        processor = new NftTradeSettlementProcessor(writer, catMoneyClient, photocardChainClient);
    }

    @Test
    void 대기_거래는_구매자에서_판매자로_캣머니를_보낸다() {
        var command = command(NftTradeChainStatus.PENDING, null, null, null);
        given(writer.command(TRADE_ID)).willReturn(command);
        given(catMoneyClient.transfer("cat-key", "buyer", 1, "seller", BigInteger.valueOf(300), "7"))
                .willReturn(new CatMoneyWriteResult("PENDING", TX));

        processor.process(TRADE_ID);

        verify(writer).catSubmitted(TRADE_ID, TX);
    }

    @Test
    void 캣머니가_확정되면_다음_단계로_넘긴다() {
        given(writer.command(TRADE_ID)).willReturn(command(NftTradeChainStatus.CAT_SUBMITTED, TX, null, null));
        given(catMoneyClient.findTxReport(TX))
                .willReturn(Optional.of(new TxReportResult("CONFIRMED", TX, 10L, null)));

        processor.process(TRADE_ID);

        verify(writer).catConfirmed(TRADE_ID);
    }

    @Test
    void 포카_이전이_실패하면_캣머니_보상을_시작한다() {
        given(writer.command(TRADE_ID)).willReturn(command(NftTradeChainStatus.NFT_SUBMITTED, null, TX, null));
        given(catMoneyClient.findTxReport(TX))
                .willReturn(Optional.of(new TxReportResult("FAILED", TX, 10L,
                        new TxReportResult.Error("REVERT", "failed"))));

        processor.process(TRADE_ID);

        verify(writer).startCompensation(TRADE_ID, "NFT_TX_REVERTED");
    }

    @Test
    void 같은_포카_키가_이미_실행됐으면_DB를_최종_체결한다() {
        given(writer.command(TRADE_ID)).willReturn(command(NftTradeChainStatus.CAT_CONFIRMED, null, null, null));
        given(photocardChainClient.transfer("nft-key", "seller", 2, "buyer", "9", "7"))
                .willReturn(new PhotocardTransferResult("ALREADY_DONE", null));

        processor.process(TRADE_ID);

        verify(writer).nftSubmitted(TRADE_ID, null);
        verify(writer).complete(TRADE_ID);
    }

    @Test
    void 환불이_확정되면_보상_완료한다() {
        given(writer.command(TRADE_ID)).willReturn(command(NftTradeChainStatus.REFUND_SUBMITTED, null, null, TX));
        given(catMoneyClient.findTxReport(TX))
                .willReturn(Optional.of(new TxReportResult("CONFIRMED", TX, 10L, null)));

        processor.process(TRADE_ID);

        verify(writer).compensate(TRADE_ID);
    }

    @Test
    void 블록체인_API의_실제_실패_코드를_클래스명_대신_저장한다() {
        var command = command(NftTradeChainStatus.CAT_CONFIRMED, null, null, null);
        given(writer.command(TRADE_ID)).willReturn(command);
        willThrow(new BlockchainApiException(
                NftErrorCode.PHOTOCARD_TRANSFER_FAILED,
                "INSUFFICIENT_BALANCE",
                "seller balance is insufficient"))
                .given(photocardChainClient)
                .transfer("nft-key", "seller", 2, "buyer", "9", "7");

        processor.process(TRADE_ID);

        verify(writer).retry(TRADE_ID, "INSUFFICIENT_BALANCE");
    }

    private NftTradeSettlementWriter.SettlementCommand command(
            NftTradeChainStatus status, String catTx, String nftTx, String refundTx) {
        var buyer = new NftTradeSettlementWriter.WalletRef(1L, "buyer", 1);
        var seller = new NftTradeSettlementWriter.WalletRef(2L, "seller", 2);
        return new NftTradeSettlementWriter.SettlementCommand(
                TRADE_ID, status, 0, 300, "9",
                "cat-key", catTx, "nft-key", nftTx, "refund-key", refundTx, buyer, seller);
    }
}
