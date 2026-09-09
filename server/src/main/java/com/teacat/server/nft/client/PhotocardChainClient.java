package com.teacat.server.nft.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.teacat.server.nft.exception.NftErrorCode;
import com.teacat.server.wallet.client.BlockchainRestClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 도안 등록 경로가 블록체인 서비스에 묻는 것들.
 *
 * <p>주소·인증·타임아웃은 {@link BlockchainRestClient} 가 안다. 여기는 <b>어떤 엔드포인트를
 * 부르고 실패를 어떤 의미로 볼지</b>만 정한다.
 *
 * <p>도안 등록은 <b>멱등하다.</b> 같은 수량·같은 CID 로 다시 보내면 새 트랜잭션 없이
 * {@code ALREADY_DONE} 이 온다. 그래서 응답을 못 받았을 때 그냥 다시 보내면 된다.
 * (blockchain/DESIGN.md 4-3)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PhotocardChainClient {

    private static final String DESIGN_PATH = "/internal/photocards/designs";
    private static final String TX_PATH = "/internal/tx/";
    private static final String HEALTH_PATH = "/health";
    private static final String PHOTOCARD_CONTRACT = "PhotocardNFT";

    private final BlockchainRestClient blockchainRestClient;

    /**
     * 한정 수량과 메타데이터 CID 를 체인에 못 박는다.
     *
     * <p><b>발행보다 먼저다.</b> 등록되지 않은 도안이 발행 배치에 섞이면 배치 전체가 revert 된다.
     *
     * @param designId    {@code nft_photocard_designs.id}. 이 값이 그대로 온체인 tokenId 다
     * @param metadataCid <b>메타데이터 JSON</b> 의 CID. 이미지 CID 를 보내면 지갑이 JSON 대신
     *                    이미지 바이트를 파싱하려 들어 카드가 깨져 보인다
     */
    public PhotocardDesignRegisterResult registerDesign(Long designId, int maxSupply, String metadataCid) {
        Map<String, Object> body = Map.of(
                // bigint 라 JSON number 로 주고받으면 큰 값에서 정밀도가 깨진다. 문자열로 보낸다
                "designId", designId.toString(),
                "maxSupply", Integer.toString(maxSupply),
                "metadataCid", metadataCid);

        return blockchainRestClient.post(
                DESIGN_PATH, body, PhotocardDesignRegisterResult.class,
                NftErrorCode.DESIGN_REGISTRATION_FAILED);
    }

    /**
     * 등록 트랜잭션이 확정됐는지.
     *
     * <p>체인이 모르는 해시면 블록체인 API 가 404 를 주고 여기서는 예외가 된다 — 드롭됐다는 뜻이다.
     * 훑기는 그걸 실패로 확정하지 않고 다음 주기에 다시 본다.
     */
    public ChainTxReport txReport(String txHash) {
        return blockchainRestClient.get(
                TX_PATH + txHash, Map.of(), ChainTxReport.class,
                NftErrorCode.DESIGN_REGISTRATION_FAILED);
    }

    /**
     * 지금 떠 있는 PhotocardNFT 컨트랙트 주소. 배포 전이면 null 이다.
     *
     * <p>등록 응답에는 주소가 없어 배포 기록에서 읽는다. {@code chain_id · contract_address ·
     * register_tx_hash} 셋이 한 묶음이라 하나만 빠져도 <b>재배포 뒤에 어느 컨트랙트의 몇 번인지</b>
     * 답할 수 없다.
     *
     * <p>이 조회가 실패해도 등록 자체는 막지 않는다 — 주소만 비워두고 넘어간다.
     */
    public String photocardContractAddress() {
        try {
            HealthReport report = blockchainRestClient.get(
                    HEALTH_PATH, Map.of(), HealthReport.class, NftErrorCode.DESIGN_REGISTRATION_FAILED);

            if (report.contracts() == null) {
                return null;
            }

            String address = report.contracts().get(PHOTOCARD_CONTRACT);
            // DB 의 check 제약이 소문자만 받는다 (체크섬 대소문자가 섞여 온다)
            return address == null ? null : address.toLowerCase();
        } catch (RuntimeException e) {
            log.warn("PhotocardNFT 주소를 읽지 못했습니다. contract_address 를 비워둡니다", e);
            return null;
        }
    }

    /** GET /health 중 우리가 쓰는 부분만 */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record HealthReport(Map<String, String> contracts) {
    }
}
