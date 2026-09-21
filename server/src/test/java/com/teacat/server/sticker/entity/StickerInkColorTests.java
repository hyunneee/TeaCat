package com.teacat.server.sticker.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 잉크 색(hex) → 워커가 쓰는 색 이름.
 *
 * <p>🔴 <b>이 변환이 결과 품질을 좌우한다.</b> 2026-09-21 실측: 같은 파란 선 고양이가
 * 색 지정 없이는 연한 세이지로, {@code blue} 를 주면 선명한 파랑으로, {@code pink} 를 주면
 * 선명한 분홍으로 나왔다. 프롬프트 문구만 다섯 판을 고쳐도 안 되던 것이 이름 하나로 풀렸다.
 * 그래서 여기가 틀리면 "색이 왜 이래?" 가 바로 돌아온다.
 */
class StickerInkColorTests {

    @Test
    void 프론트_기본_팔레트의_색을_이름으로_바꾼다() {
        // INK_PALETTE = ['#111111', '#e03131', '#2b6be0', '#f2b800']
        assertThat(StickerInkColor.toChipName("#e03131")).isEqualTo("red");
        assertThat(StickerInkColor.toChipName("#2b6be0")).isEqualTo("blue");
        assertThat(StickerInkColor.toChipName("#f2b800")).isEqualTo("yellow");
    }

    /**
     * 🔴 기본 잉크가 검정이다. 검정으로 그린 낙서를 "검은 스티커" 로 만들면 안 된다 —
     * 색을 안 고른 것으로 보고 모델이 주제에 맞는 색을 고르게 둔다.
     */
    @Test
    void 기본_검정_잉크는_색을_안_고른_것으로_본다() {
        assertThat(StickerInkColor.toChipName("#111111")).isNull();
        assertThat(StickerInkColor.toChipName("#000000")).isNull();
    }

    @Test
    void 회색도_색을_안_고른_것으로_본다() {
        assertThat(StickerInkColor.toChipName("#808080")).isNull();
        assertThat(StickerInkColor.toChipName("#cccccc")).isNull();
    }

    @Test
    void 팔레트에_없는_색도_가장_가까운_이름으로_보낸다() {
        // `+` 로 더한 색은 목록에 없다. 색상환에서 가장 가까운 이름을 고른다
        assertThat(StickerInkColor.toChipName("#00ff00")).isEqualTo("green");
        assertThat(StickerInkColor.toChipName("#ff3399")).isEqualTo("pink");
        assertThat(StickerInkColor.toChipName("#7700ff")).isEqualTo("purple");
        assertThat(StickerInkColor.toChipName("#ff7700")).isEqualTo("orange");
        // 마젠타(#ff00ff, 색상 300)는 purple(280)이 pink(330)보다 가깝다 — 경계값이라 적어 둔다
        assertThat(StickerInkColor.toChipName("#ff00ff")).isEqualTo("purple");
    }

    @Test
    void 색상환의_경계를_넘어도_가까운_쪽을_고른다() {
        // hue 350 은 red(0) 에서 10 만큼 떨어져 있다. 단순 뺄셈이면 pink(330) 를 고른다
        assertThat(StickerInkColor.toChipName("#ff0022")).isEqualTo("red");
    }

    @Test
    void 샵_없이_와도_읽는다() {
        assertThat(StickerInkColor.toChipName("e03131")).isEqualTo("red");
    }

    @Test
    void 형식이_아니면_색을_안_고른_것으로_본다() {
        assertThat(StickerInkColor.toChipName(null)).isNull();
        assertThat(StickerInkColor.toChipName("")).isNull();
        assertThat(StickerInkColor.toChipName("파랑")).isNull();
        assertThat(StickerInkColor.toChipName("#12345")).isNull();
        assertThat(StickerInkColor.toChipName("#gggggg")).isNull();
    }
}
