package com.teacat.server.nft.service;

import com.teacat.server.nft.client.ChainTxReport;
import com.teacat.server.nft.client.PhotocardChainClient;
import com.teacat.server.nft.client.PhotocardDesignRegisterResult;
import com.teacat.server.nft.service.NftDesignChainWriter.RegistrationTarget;
import com.teacat.server.wallet.client.BlockchainProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 도안 하나를 체인에 등록하고 확정을 확인한다.
 *
 * <p><b>트랜잭션을 열지 않는다.</b> 체인에 다녀오는 동안(SSAFY 체인은 블록이 10초) DB 커넥션을
 * 쥐고 있으면 안 되기 때문이다. DB 쓰기는 {@link NftDesignChainWriter} 의 짧은 트랜잭션 둘로 갈라져 있다:
 *
 * <pre>
 * ① claim              보낼 수 있는 상태인지 확인하고 값을 꺼낸다   (트랜잭션)
 * ② registerDesign     체인 호출                                (트랜잭션 밖)
 * ③ applyRegisterResult 결과를 적는다                            (트랜잭션)
 * </pre>
 *
 * <p>②와 ③ 사이에서 죽으면 트랜잭션은 체인에 있는데 행은 PENDING 으로 남는다.
 * <b>그래도 안전하다</b> — 등록은 멱등이라 다시 보내면 {@code ALREADY_DONE} 이 온다.
 * 같은 이유로 ①~③ 이 동시에 둘 돌아도 트랜잭션 하나가 낭비될 뿐 값은 어긋나지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NftDesignChainRegistrar {

    private final PhotocardChainClient chainClient;
    private final NftDesignChainWriter writer;
    private final BlockchainProperties blockchainProperties;

    /**
     * 등록 요청을 보낸다. 상태가 맞지 않거나 블록체인 서비스가 거절하면 예외가 나간다.
     *
     * @param force 확정 대기 중(REGISTERING)이어도 다시 보낼지
     */
    public void register(Long designId, boolean force) {
        RegistrationTarget target = writer.claim(designId, force);

        PhotocardDesignRegisterResult result;
        try {
            result = chainClient.registerDesign(target.designId(), target.maxSupply(), target.metadataCid());
        } catch (RuntimeException e) {
            // 보낸 적이 없으므로 되돌린다. 도안은 남고 등록만 다시 보내면 된다
            writer.applyRegisterNotSent(designId);
            throw e;
        }

        // 주소 조회가 실패해도 등록은 막지 않는다 (null 이면 컬럼만 빈다)
        writer.applyRegisterResult(designId, result,
                blockchainProperties.chainId(), chainClient.photocardContractAddress());
    }

    /**
     * 보내둔 등록 트랜잭션이 확정됐는지 본다.
     *
     * <p>조회 자체가 실패하면 <b>아무것도 확정하지 않는다.</b> 블록체인 서비스가 잠깐 죽은 것과
     * 트랜잭션이 실패한 것은 다르고, REGISTERING 으로 남겨두면 다음 주기에 다시 잡힌다.
     *
     * @return 이 호출로 상태가 끝났으면 true
     */
    public boolean confirm(Long designId, String txHash) {
        if (txHash == null) {
            // 보내지도 못했는데 REGISTERING 인 행. 재시도 대상으로 되돌린다
            writer.applyRegisterNotSent(designId);
            return true;
        }

        ChainTxReport report = chainClient.txReport(txHash);
        return writer.applyTxReport(designId, report);
    }
}
