package com.teacat.server.nft.entity;

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
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * 포토카드 템플릿 — 그림 하나.
 *
 * <p><b>수량도 체인 상태도 없다.</b> 그 둘은 {@link NftPhotocardDesign} 이 갖는다. 템플릿을
 * 등록하는 것은 "이런 카드가 있다" 까지이고, 몇 장 발행할지는 공연이나 이벤트에 넣을 때 정한다.
 * 그래서 쓰지 않는 템플릿은 온체인에 올라가지 않는다.
 *
 * <p>🔴 <b>삭제하지 않는다.</b> 이 템플릿으로 만든 도안들이 {@code imageCid} 를 그대로 가리키고
 * 있어서, 지우거나 IPFS 에서 언핀하면 그 그림을 쓰는 모든 도안의 이미지가 깨진다. 온체인 등록도
 * 되돌릴 수 없다. 목록에서 감추는 것({@code hidden})까지만 한다.
 */
@Entity
@Table(name = "nft_photocard_templates")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NftPhotocardTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /** 메타데이터 JSON 에 들어간다. 도안을 만들 때 이 값이 쓰인다 */
    @Column(name = "description", length = 500)
    private String description;

    /** 🔴 도안들이 이 값을 공유한다. 언핀하면 전부 깨진다 */
    @Column(name = "image_cid", nullable = false, length = 100, updatable = false)
    private String imageCid;

    @Column(name = "image_url", nullable = false, updatable = false)
    private String imageUrl;

    @Column(name = "group_name", nullable = false, length = 50)
    private String groupName;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "grade", nullable = false, columnDefinition = "nft_photocard_grade")
    private NftPhotocardGrade grade;

    @Column(name = "hidden", nullable = false)
    private boolean hidden;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private NftPhotocardTemplate(String name, String description, String imageCid, String imageUrl,
                                 String groupName, NftPhotocardGrade grade) {
        this.name = name;
        this.description = description;
        this.imageCid = imageCid;
        this.imageUrl = imageUrl;
        this.groupName = groupName;
        this.grade = grade;
        this.hidden = false;
    }

    /**
     * 핀을 마친 템플릿을 만든다.
     *
     * <p><b>CID 없이는 만들 수 없다.</b> 그림이 IPFS 에 없는 템플릿으로는 도안을 만들 수 없다.
     */
    public static NftPhotocardTemplate create(String name, String description, String imageCid,
                                              String imageUrl, String groupName,
                                              NftPhotocardGrade grade) {
        return new NftPhotocardTemplate(name, description, imageCid, imageUrl, groupName, grade);
    }

    /** 목록에서 감추거나 되살린다. 이미 만든 도안은 그대로 동작한다 */
    public void changeHidden(boolean hidden) {
        this.hidden = hidden;
    }
}
