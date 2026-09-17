package com.teacat.server.nft.entity;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.exception.NftErrorCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.math.BigDecimal;

@Entity
@Table(name = "nft_photocard_designs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftPhotocardDesign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ERC-1155 tokenId. 관계형 도안 PK와 독립적이며 한번 정해지면 재시도에서도 유지한다. */
    @Column(name = "chain_token_id", precision = 78)
    private BigDecimal chainTokenId;

    /** 공연 도안이면 공연 id. 뽑기 풀 도안은 null 이다 (DB CHECK 가 둘 중 하나임을 강제한다) */
    @Column(name = "performance_general_id")
    private Long performanceId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /**
     * 브라우저가 여는 주소. 핀을 쓰면 게이트웨이 URL 이 들어간다.
     *
     * <p>체인에 올라가는 값은 이게 아니라 {@link #metadataCid} 다. 이건 표시용이라
     * 게이트웨이를 바꿔도 온체인 값은 그대로다.
     */
    @Column(name = "image_url", nullable = false)
    private String imageUrl;

    @Column(name = "total_supply", nullable = false)
    private int totalSupply;

    @Column(name = "issued_supply", nullable = false)
    private int issuedSupply;

    /** 뽑기 풀 도안인가. true 면 performanceId 가 null 이고 groupName·grade 가 있다 */
    @Column(name = "draw_pool", nullable = false)
    private boolean drawPool;

    /** 소속. 예 "서울 3반" · "15기" · "개발자". 화면 문구에 쓴다 */
    @Column(name = "group_name", length = 50)
    private String groupName;

    /** 연출 등급. 화면은 이 값만 보고 금색/보라 · 먼지를 고른다 */
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "grade", columnDefinition = "nft_photocard_grade")
    private NftPhotocardGrade grade;

    /** 어느 템플릿에서 만들어졌나. 템플릿 없이 직접 등록된 기존 도안은 null */
    @Column(name = "template_id", updatable = false)
    private Long templateId;

    /** 그림 파일의 CID. 메타데이터 JSON 의 {@code image} 가 이 값을 가리킨다 */
    @Column(name = "image_cid", length = 80)
    private String imageCid;

    /**
     * 메타데이터 JSON 의 CID. <b>체인에 올라가는 값은 이것 하나다.</b>
     *
     * <p>{@code uri(tokenId)} 가 {@code ipfs://<이 값>} 을 돌려주고, 지갑이 거기서 JSON 을 받아
     * 그 안의 {@code image} 로 그림을 연다.
     */
    @Column(name = "metadata_cid", length = 80)
    private String metadataCid;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "chain_status", nullable = false, columnDefinition = "nft_design_chain_status")
    private NftDesignChainStatus chainStatus = NftDesignChainStatus.PENDING;

    /** 어느 체인에 등록했나. 재배포 뒤에 "어느 컨트랙트의 몇 번인지" 를 답하려면 셋이 한 묶음이다 */
    @Column(name = "chain_id")
    private Integer chainId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "contract_address", length = 42, columnDefinition = "char(42)")
    private String contractAddress;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "register_tx_hash", length = 66, columnDefinition = "char(66)")
    private String registerTxHash;

    @Column(name = "registered_at")
    private LocalDateTime registeredAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private NftPhotocardDesign(Long performanceId, String name, String imageUrl, int totalSupply,
                               String imageCid, String metadataCid) {
        this.performanceId = performanceId;
        this.name = name;
        this.imageUrl = imageUrl;
        this.totalSupply = totalSupply;
        this.issuedSupply = 0;
        this.imageCid = imageCid;
        this.metadataCid = metadataCid;
        this.chainTokenId = NftChainIdentity.newChainTokenId();
        this.chainStatus = NftDesignChainStatus.PENDING;
        this.drawPool = false;
    }

    /**
     * 뽑기 풀 도안. 공연이 없다. 규칙은 {@link #create} 와 같다 — 핀이 끝난 뒤에만 만들 수 있다.
     *
     * <p>{@code totalSupply} 가 희귀도다. 뽑기는 균등 랜덤이라 수량이 적은 도안이 먼저 소진된다.
     */
    public static NftPhotocardDesign createDrawPool(String name, String imageUrl, int totalSupply,
                                                    String imageCid, String metadataCid,
                                                    String groupName, NftPhotocardGrade grade) {
        NftPhotocardDesign design = new NftPhotocardDesign(null, name, imageUrl, totalSupply, imageCid, metadataCid);
        design.drawPool = true;
        design.groupName = groupName;
        design.grade = grade;
        return design;
    }

    /**
     * 핀을 마친 도안을 만든다.
     *
     * <p><b>CID 없이는 만들 수 없다.</b> 등록 요청을 보낼 수 없는 도안이 생기기 때문이다.
     * 순서는 항상 이미지 핀 → 메타데이터 핀 → 이 행이다 — 메타데이터 JSON 안에 이미지 CID 가
     * 들어가야 해서 뒤바뀔 수 없다.
     */
    public static NftPhotocardDesign create(Long performanceId, String name, String imageUrl, int totalSupply,
                                            String imageCid, String metadataCid) {
        return new NftPhotocardDesign(performanceId, name, imageUrl, totalSupply, imageCid, metadataCid);
    }

    /**
     * 템플릿으로 도안을 만든다 — 이것이 <b>발행 단위</b>다.
     *
     * <p><b>그림은 다시 올리지 않는다.</b> CID 는 내용 주소라 같은 그림이면 같은 값이고,
     * 재업로드는 변조 방지에 아무것도 더하지 않는다. 템플릿의 {@code imageCid} 를 그대로 가리킨다.
     *
     * <p>반대로 <b>메타데이터는 새로 핀한 것을 받는다.</b> 이름에 공연이 들어가고 {@code 공연}
     * attribute 가 붙어 JSON 이 달라지기 때문이다. 그래서 같은 템플릿으로 만든 공연 A의 도안과
     * 공연 B의 도안은 <b>다른 온체인 tokenId</b> 이고 마켓에서 따로 거래된다 — 그게 "공연마다 한정"
     * 의 실체다.
     *
     * <p>🔴 {@code totalSupply} 는 온체인 {@code maxSupply} 로 박히고 <b>첫 장이 나가면 동결</b>된다
     * (컨트랙트가 {@code DesignFrozen} 으로 거절한다). 한 장도 안 나갔으면 재등록으로 고칠 수 있다.
     *
     * @param performanceId null 이면 이벤트 팩이 뽑는 풀
     * @param name          {@code "{템플릿 이름} · {공연 제목}"}. 규칙을 바꾸면 이미 핀된 도안과 어긋난다
     * @param metadataCid   attribute 까지 넣어 새로 핀한 메타데이터 JSON 의 CID
     */
    public static NftPhotocardDesign fromTemplate(NftPhotocardTemplate template, Long performanceId,
                                                  String name, int totalSupply, String metadataCid) {
        NftPhotocardDesign design = new NftPhotocardDesign(
                performanceId, name, template.getImageUrl(), totalSupply,
                template.getImageCid(), metadataCid);
        design.drawPool = true;
        design.groupName = template.getGroupName();
        design.grade = template.getGrade();
        design.templateId = template.getId();
        return design;
    }

    /** 이벤트 팩이 뽑는 풀인가 (공연에 묶이지 않은 뽑기 풀 도안) */
    public boolean isEventPool() {
        return drawPool && performanceId == null;
    }

    /** 남은 수량 */
    public int remaining() {
        return totalSupply - issuedSupply;
    }

    public void reserve(int quantity) {
        if (quantity <= 0 || issuedSupply + quantity > totalSupply) {
            throw new BusinessException(NftErrorCode.DESIGN_QUANTITY_EXCEEDED);
        }
        issuedSupply += quantity;
    }

    /**
     * 뽑기 후보에 넣거나 뺀다. 온체인 등록·발행된 카드는 건드리지 않는다.
     *
     * <p>수량이 남았는데 더 안 나가게 하려면 이걸 쓴다. 온체인 {@code maxSupply} 는 줄일 수 없지만
     * (컨트랙트가 거절) 실제 발행은 여기서 멈춘다.
     *
     * <p>🔴 공연이 없는 도안(이벤트 풀)을 false 로 내리면
     * {@code chk_nft_photocard_designs_pool} 에 걸린다. 부르는 쪽이 먼저 막는다.
     */
    public void changeDrawPool(boolean drawPool) {
        this.drawPool = drawPool;
    }

    /** 등록 트랜잭션을 보냈다. txHash 를 <b>여기서</b> 채운다 — 확정 때 채우면 훑기가 대상을 못 찾는다 */
    public void markRegistering(String txHash, Integer chainId, String contractAddress) {
        this.chainStatus = NftDesignChainStatus.REGISTERING;
        this.registerTxHash = txHash;
        this.chainId = chainId;
        this.contractAddress = contractAddress;
        this.registeredAt = null;
    }

    /**
     * 확정. 블록체인 API 가 {@code ALREADY_DONE} 을 주면 새 트랜잭션이 없어 txHash 는 null 이다 —
     * 그것도 "이미 체인에 있다" 는 뜻이라 등록된 것으로 본다.
     */
    public void markRegistered(String txHash, Integer chainId, String contractAddress, LocalDateTime now) {
        this.chainStatus = NftDesignChainStatus.REGISTERED;
        if (txHash != null) {
            this.registerTxHash = txHash;
        }
        if (chainId != null) {
            this.chainId = chainId;
        }
        if (contractAddress != null) {
            this.contractAddress = contractAddress;
        }
        this.registeredAt = now;
    }

    /** 체인이 실행을 거부했다. 재시도할 수 있게 도안 자체는 그대로 남긴다 */
    public void markRegistrationFailed() {
        this.chainStatus = NftDesignChainStatus.FAILED;
        this.registeredAt = null;
    }

    /** 요청을 보내지도 못했다(블록체인 서비스가 죽었거나 설정이 없다). 보낸 적 없으므로 txHash 를 비운다 */
    public void markRegistrationNotSent() {
        this.chainStatus = NftDesignChainStatus.PENDING;
        this.registerTxHash = null;
        this.registeredAt = null;
    }

    public boolean isRegistered() {
        return chainStatus == NftDesignChainStatus.REGISTERED;
    }

    public boolean isRegistering() {
        return chainStatus == NftDesignChainStatus.REGISTERING;
    }

    public boolean hasPins() {
        return imageCid != null && metadataCid != null;
    }

    /**
     * 마이그레이션 전 행을 블루그린 배포 중 처음 만났을 때 식별자를 확정한다.
     * 제출 이력이 있으면 레거시 DB PK를 보존하고, 진짜 미제출 행만 새 전역 값을 받는다.
     */
    public BigDecimal ensureChainTokenId() {
        if (chainTokenId == null) {
            boolean submitted = registerTxHash != null || chainStatus != NftDesignChainStatus.PENDING;
            chainTokenId = submitted ? BigDecimal.valueOf(id) : NftChainIdentity.newChainTokenId();
        }
        return chainTokenId;
    }

    /** 제출된 레거시 행의 전환 기간 조회 fallback. */
    public BigDecimal chainTokenIdOrLegacy() {
        return chainTokenId != null ? chainTokenId : BigDecimal.valueOf(id);
    }
}
