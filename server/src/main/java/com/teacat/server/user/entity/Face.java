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
}
