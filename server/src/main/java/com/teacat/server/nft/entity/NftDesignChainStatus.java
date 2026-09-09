package com.teacat.server.nft.entity;

/**
 * 도안이 온체인에 등록됐는지 (nft_photocard_designs.chain_status).
 *
 * <pre>
 * PENDING      CID 는 있는데 아직 등록 요청을 안 보냈거나, 보냈다가 실패해 되돌아왔다
 * REGISTERING  트랜잭션을 보냈고 아직 블록에 안 실렸다   ← register_tx_hash 를 여기서 채운다
 * REGISTERED   확정. 이제 이 도안으로 카드를 발행할 수 있다
 * FAILED       체인이 실행을 거부했다. 원인을 고쳐 다시 보내야 한다
 * </pre>
 *
 * <b>등록은 발행보다 먼저다.</b> 등록되지 않은 도안이 발행 배치에 섞이면 배치 전체가 revert 된다.
 */
public enum NftDesignChainStatus {
    PENDING,
    REGISTERING,
    REGISTERED,
    FAILED
}
