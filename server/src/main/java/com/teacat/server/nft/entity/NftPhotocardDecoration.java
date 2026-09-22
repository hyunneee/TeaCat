package com.teacat.server.nft.entity;

import com.teacat.server.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

/**
 * 포토카드 한 장에 AI 스티커를 얹은 결과. <b>사람마다 한 장씩</b>이다
 * ({@code uq_photocard_decorations_card_user}).
 *
 * <p>🔴 <b>원본 카드는 건드리지 않는다.</b> NFT 라 되돌릴 수 없어서, 꾸민 사본만 여기 둔다.
 * 그래서 마켓·경매는 언제나 원본을 보여준다 — 사는 사람이 꾸며진 그림을 보고 샀는데 맨 카드를
 * 받는 일이 없다.
 *
 * <p>🔴 <b>조회는 반드시 (카드, 사용자) 두 칸으로 한다.</b> 카드 기준으로만 읽으면 주인이 바뀐 뒤
 * 새 주인 화면에 예전 주인의 그림이 뜬다. 유출을 막는 실제 장치가 이것이고, 판매 정산 때의
 * 삭제는 저장공간 정리다.
 *
 * <p>합성은 <b>클라이언트가</b> 캔버스로 한다. 서버는 받은 PNG 를 MinIO 에 올리고
 * 다시 꾸미기용 배치 정보를 함께 보관할 뿐이다.
 */
@Entity
@Table(name = "photocard_decorations")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftPhotocardDecoration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "photocard_id", nullable = false, updatable = false)
    private NftPhotocard photocard;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @Column(name = "image_key", nullable = false, length = 512)
    private String imageKey;

    /** 스티커 배치 JSON 배열. 서버는 내용을 해석하지 않고 그대로 보관한다 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "placements", nullable = false, columnDefinition = "jsonb")
    private String placements;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    private NftPhotocardDecoration(NftPhotocard photocard, User user, String imageKey, String placements) {
        this.photocard = photocard;
        this.user = user;
        this.imageKey = imageKey;
        this.placements = placements;
    }

    public static NftPhotocardDecoration of(NftPhotocard photocard, User user,
                                            String imageKey, String placements) {
        return new NftPhotocardDecoration(photocard, user, imageKey, placements);
    }

    /**
     * 다시 꾸미면 <b>덮어쓴다.</b> 행을 새로 만들지 않는다 — UNIQUE 제약에 막힌다.
     *
     * <p>🔴 부르는 쪽이 <b>예전 MinIO 객체를 지워야 한다.</b> 여기서는 키만 바꾸므로,
     * 안 지우면 다시 꾸밀 때마다 쓰레기가 한 장씩 쌓인다.
     */
    public void update(String imageKey, String placements) {
        this.imageKey = imageKey;
        this.placements = placements;
    }
}
