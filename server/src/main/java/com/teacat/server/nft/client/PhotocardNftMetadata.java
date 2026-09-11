package com.teacat.server.nft.client;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * IPFS 에 핀하는 <b>메타데이터 JSON</b>. 지갑이 {@code uri(tokenId)} 로 받아가는 문서다.
 *
 * <pre>
 * tokenId 11 ─▶ uri(11) ─▶ ipfs://bafyMETA ─▶ { "image": "ipfs://bafyIMG" } ─▶ 그림
 * </pre>
 *
 * <p><b>Spring 이 이 문서를 서빙하지 않는다.</b> 지갑이 IPFS 에서 직접 가져간다 —
 * 그래서 메타데이터 공개 엔드포인트가 필요 없다. (blockchain/PHOTOCARD_PLAN.md 3장)
 *
 * <p>이 JSON 이 핀되는 순간 이름·설명·그림이 CID 하나로 굳는다. 한 글자만 바꿔도 CID 가
 * 달라져 온체인 값과 어긋나므로, <b>DB 를 고쳐도 체인이 가리키는 문서는 그대로다.</b>
 *
 * @param image {@code ipfs://<이미지 CID>}. 게이트웨이 URL 을 넣으면 그 게이트웨이가 죽는 날
 *              카드가 깨진다 — 스킴 주소여야 어느 게이트웨이로도 열린다
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PhotocardNftMetadata(
        String name,
        String description,
        String image,
        /** 뽑기 풀 도안만. 지갑이 속성 탭에 보여준다 (ERC-721 metadata 관례). 공연 도안은 null */
        List<Attribute> attributes
) {

    private static final String IPFS_SCHEME = "ipfs://";

    public record Attribute(
            @JsonProperty("trait_type") String traitType,
            String value
    ) {
    }

    public static PhotocardNftMetadata of(String name, String description, String imageCid) {
        return new PhotocardNftMetadata(name, description, IPFS_SCHEME + imageCid, null);
    }

    public static PhotocardNftMetadata ofDrawPool(String name, String description, String imageCid,
                                                  String group, String grade) {
        return new PhotocardNftMetadata(name, description, IPFS_SCHEME + imageCid,
                List.of(new Attribute("소속", group), new Attribute("등급", grade)));
    }
}
