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

@Entity
@Table(name = "nft_photocard_designs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftPhotocardDesign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

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

    public void reserve(int quantity) {
        if (quantity <= 0 || issuedSupply + quantity > totalSupply) {
            throw new BusinessException(NftErrorCode.DESIGN_QUANTITY_EXCEEDED);
        }
        issuedSupply += quantity;
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
}
