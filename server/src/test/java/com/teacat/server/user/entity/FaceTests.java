package com.teacat.server.user.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * 얼굴 대조 계산.
 *
 * <p>이 값 하나로 "본인이 맞다/아니다" 가 갈리므로, 화면·서버가 같은 답을 내는지가 중요하다.
 * 클라이언트의 {@code cosineSimilarity}(features/face/model/embedding.ts)와 <b>같은 식</b>이고
 * 임계값도 같아야 한다.
 */
class FaceTests {

    private static final String MODEL = "yunet2023mar+sface2021dec-int8@1";

    @Test
    void 같은_벡터는_유사도가_1이다() {
        float[] v = unitVector(0.3f, 0.4f);

        assertThat(face(v).cosineSimilarityTo(v)).isCloseTo(1.0, within(1e-9));
    }

    @Test
    void 반대_방향_벡터는_유사도가_음수다() {
        Face f = face(unitVector(0.6f, 0.8f));

        assertThat(f.cosineSimilarityTo(unitVector(-0.6f, -0.8f))).isCloseTo(-1.0, within(1e-9));
    }

    @Test
    void 직각인_벡터는_유사도가_0이다() {
        Face f = face(axis(0));

        assertThat(f.cosineSimilarityTo(axis(1))).isCloseTo(0.0, within(1e-9));
    }

    /**
     * 정규화가 깨진 값이 들어와도 길이로 나누므로 방향만 본다.
     *
     * <p>내적만 썼다면 길이가 3배인 벡터에서 3이 나와 임계값을 그냥 넘겨 버린다.
     */
    @Test
    void 길이가_달라도_방향이_같으면_유사도가_1이다() {
        float[] v = unitVector(0.6f, 0.8f);
        float[] scaled = new float[v.length];
        for (int i = 0; i < v.length; i++) {
            scaled[i] = v[i] * 3f;
        }

        assertThat(face(v).cosineSimilarityTo(scaled)).isCloseTo(1.0, within(1e-9));
    }

    @Test
    void 길이가_0인_벡터는_판단하지_않고_0을_준다() {
        assertThat(face(axis(0)).cosineSimilarityTo(new float[Face.EMBEDDING_DIMENSION]))
                .isEqualTo(0.0);
    }

    @Test
    void 모델이_다르면_대조_대상이_아니다() {
        Face f = face(axis(0));

        assertThat(f.isSameModel(MODEL)).isTrue();
        assertThat(f.isSameModel("sface@2")).isFalse();
    }

    /**
     * 임계값은 응답의 {@code threshold} 로 내려가 화면의 합격선이 된다.
     *
     * <p>SFace 공식 권장값(0.363)보다 엄격하다 — 입장 통제라 오인이 거절보다 비싸다.
     * 조정할 때 이 테스트도 함께 고치게 해서, 숫자가 조용히 바뀌지 않도록 한다.
     */
    @Test
    void 임계값은_공식_권장값보다_엄격하다() {
        assertThat(Face.SAME_PERSON_THRESHOLD).isEqualTo(0.65);
        assertThat(Face.SAME_PERSON_THRESHOLD).isGreaterThan(0.363);
    }

    private static Face face(float[] embedding) {
        return Face.of(embedding, MODEL);
    }

    /** 앞 두 자리만 채운 128 차원 벡터 */
    private static float[] unitVector(float x, float y) {
        float[] v = new float[Face.EMBEDDING_DIMENSION];
        v[0] = x;
        v[1] = y;
        return v;
    }

    /** i 번째 축만 1 인 벡터 */
    private static float[] axis(int i) {
        float[] v = new float[Face.EMBEDDING_DIMENSION];
        v[i] = 1f;
        return v;
    }
}
