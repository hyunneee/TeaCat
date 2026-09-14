package com.teacat.server.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Array;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 얼굴 특징값(임베딩).
 *
 * 얼굴 원본 이미지는 서버로 오지 않는다. 클라이언트에서 추출한 임베딩만 저장한다.
 */
@Entity
@Table(name = "faces")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Face {

    /**
     * 임베딩 차원 수. 클라이언트가 쓰는 SFace(face_recognition_sface_2021dec)의 출력 차원이다.
     * 모델을 교체하면 이 값과 DB 의 vector(n) 을 함께 바꿔야 한다.
     */
    public static final int EMBEDDING_DIMENSION = 128;

    /**
     * 같은 사람으로 볼 최소 코사인 유사도.
     *
     * <p>SFace 의 공식 권장값은 <b>0.363</b> 이지만(OpenCV Zoo) 우리는 더 엄격하게 잡았다.
     * 입장 통제라 남을 통과시키는 쪽(오인)이 본인을 한 번 더 찍게 하는 쪽(거절)보다
     * 훨씬 비싸다 — 남의 티켓으로 들어가는 걸 막는 게 이 기능의 목적이다.
     *
     * <p>⚠️ <b>본인이 거절되는 일이 늘어난다.</b> 같은 사람도 조명·각도·거리에 따라
     * 0.4~0.7 사이로 흩어지므로, 0.65 는 그 분포의 위쪽만 통과시킨다. 실제 사람들로
     * 재보면서 조정할 값이고, 확정되면 설정(application.yaml)으로 옮기는 편이 낫다.
     *
     * <p>🔴 화면이 보여주는 합격선은 이 값이다 — 응답의 {@code threshold} 로 내려간다.
     * 클라이언트에 같은 숫자를 또 적지 마세요(두 곳이 갈라집니다).
     */
    public static final double SAME_PERSON_THRESHOLD = 0.65;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JdbcTypeCode(SqlTypes.VECTOR)
    @Array(length = EMBEDDING_DIMENSION)
    @Column(name = "embedding", nullable = false)
    private float[] embedding;

    /** 어떤 모델로 뽑은 값인지. 모델이 다르면 대조할 수 없다 */
    @Column(name = "model_version", nullable = false, length = 50)
    private String modelVersion;

    private Face(float[] embedding, String modelVersion) {
        this.embedding = embedding;
        this.modelVersion = modelVersion;
    }

    public static Face of(float[] embedding, String modelVersion) {
        return new Face(embedding, modelVersion);
    }

    /**
     * 다른 임베딩과 얼마나 닮았는가 (코사인 유사도, -1 ~ 1).
     *
     * <p><b>계산을 엔티티 안에 두는 이유</b>는 저장해 둔 임베딩을 밖으로 꺼내지 않기 위해서다.
     * 게터로 꺼내 서비스에서 비교하면 생체 특징값이 서비스·DTO·로그로 번질 길이 생긴다.
     * 여기서는 숫자 하나만 나간다.
     *
     * <p>양쪽 다 L2 정규화된 벡터라 내적만으로도 같은 값이 나오지만, 정규화가 깨진 입력이
     * 들어와도 틀린 점수를 내지 않도록 길이로 나눈다. 128 차원이라 비용은 무시할 수준이다.
     *
     * @return 한쪽이라도 길이가 0이면 0 (닮음을 판단할 수 없음)
     */
    public double cosineSimilarityTo(float[] other) {
        double dot = 0, normThis = 0, normOther = 0;
        for (int i = 0; i < embedding.length; i++) {
            dot += (double) embedding[i] * other[i];
            normThis += (double) embedding[i] * embedding[i];
            normOther += (double) other[i] * other[i];
        }

        double denominator = Math.sqrt(normThis) * Math.sqrt(normOther);
        return denominator == 0 ? 0 : dot / denominator;
    }

    /** 같은 모델로 뽑은 값인가. 모델이 다르면 좌표계가 달라 대조 자체가 성립하지 않는다 */
    public boolean isSameModel(String otherModelVersion) {
        return modelVersion.equals(otherModelVersion);
    }
}
