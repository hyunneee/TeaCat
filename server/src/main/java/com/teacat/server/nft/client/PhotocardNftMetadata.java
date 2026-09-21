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

    /**
     * 뽑기 풀 도안. <b>공연 풀 도안도 이걸 쓴다.</b>
     *
     * <p>🔴 <b>공연 제목을 넣지 않는다 — 일부러다.</b> 이름과 속성이 같으면 JSON 바이트가 같고,
     * 바이트가 같으면 CID 도 같다. 그래서 템플릿 하나를 공연 몇 개에 꽂든 Pinata 에는
     * <b>파일 하나</b>로만 쌓인다. 공연마다 제목을 박던 예전 방식은 도안 수만큼 파일이 늘어
     * 무료 플랜 파일 한도(500)를 넘겼다 — 도안 378개가 JSON 378개였다 (2026-09-21).
     *
     * <p>대신 <b>지갑에서는 어느 공연 카드인지 보이지 않는다.</b> 우리 화면은 DB 의
     * {@code nft_photocard_designs.name}("{템플릿} · {공연}")을 쓰므로 영향이 없다 —
     * 이 문서를 읽는 건 외부 지갑뿐이다.
     *
     * <p>🔴 <b>이미 핀된 것은 그대로다.</b> 2026-09-21 이전에 만든 378개는 공연 제목이 박힌
     * 문서를 가리키고 온체인 값도 동결돼 있어 바뀌지 않는다. 두 세대가 공존한다.
     *
     * <p>🔴 이 문서가 핀되는 순간 이름·설명·속성이 CID 하나로 굳고, 그 CID 가 온체인에 박힌다.
     * <b>attribute 구성을 또 바꾸면</b> 이미 등록된 도안의 온체인 문서는 그대로 남아 새 규칙과
     * 어긋난다. 바꿀 때마다 세대가 하나씩 늘어난다는 뜻이다.
     */
    public static PhotocardNftMetadata ofDrawPool(String name, String description, String imageCid,
                                                  String group, String grade) {
        return new PhotocardNftMetadata(name, description, IPFS_SCHEME + imageCid,
                List.of(new Attribute("소속", group), new Attribute("등급", grade)));
    }
}
