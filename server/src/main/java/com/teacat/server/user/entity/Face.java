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
 * 얼굴 원본 이미지는 서버로 오지 않는다. 클라이언트에서 추출한 512 차원 임베딩만 저장한다.
 */
@Entity
@Table(name = "faces")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Face {

    /** 임베딩 차원 수. 얼굴 인식 모델을 교체하면 이 값과 DB vector(n) 을 함께 바꿔야 한다. */
    public static final int EMBEDDING_DIMENSION = 512;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JdbcTypeCode(SqlTypes.VECTOR)
    @Array(length = EMBEDDING_DIMENSION)
    @Column(name = "embedding", nullable = false)
    private float[] embedding;

    private Face(float[] embedding) {
        this.embedding = embedding;
    }

    public static Face of(float[] embedding) {
        return new Face(embedding);
    }
}
