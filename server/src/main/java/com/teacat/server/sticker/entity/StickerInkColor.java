package com.teacat.server.sticker.entity;

import java.util.Locale;

/**
 * 사용자가 고른 잉크 색(hex)을 워커가 쓰는 색 이름으로 바꾼다.
 *
 * <p>🔴 <b>이 변환이 결과 품질을 좌우한다.</b> 워커 프롬프트에 색을 이름으로 박아 주면
 * ({@code a vivid, fully saturated blue}) 모델이 선명하게 칠한다. 안 주면 "낙서에서 색을
 * 가져와라" 로 떨어지는데, 얇은 선화는 색 신호가 약해 회색빛으로 바랜다.
 * (2026-09-21 실측: 같은 낙서가 지정 없이는 연한 세이지, 이름을 주면 선명하게 나왔다)
 *
 * <p>프론트는 hex 를 보낸다 — 팔레트 기본 4색도 hex 이고 {@code +} 로 더한 색은 목록에 없다.
 * 그래서 색상환에서 <b>가장 가까운 이름</b>을 고른다.
 *
 * <p>🔴 <b>검정·회색은 "색을 안 골랐다"</b> 로 본다. 기본 잉크가 검정이라 대부분의 낙서가
 * 검정으로 그려지는데, 그걸 "검은 스티커" 로 만들면 안 된다. 그 경우 모델이 주제에 맞는
 * 색을 고르게 둔다.
 */
public final class StickerInkColor {

    /** 워커 프롬프트가 아는 색 이름. {@code sticker_worker_qwen.py} 의 CHIPS 와 같아야 한다 */
    private static final String[] NAMES = {"red", "orange", "yellow", "green", "blue", "purple", "pink"};

    /** 각 이름의 대표 색상(hue, 0~360) */
    private static final int[] HUES = {0, 30, 55, 130, 220, 280, 330};

    /** 이보다 채도가 낮으면 무채색으로 본다 (0~1) */
    private static final double MIN_SATURATION = 0.22;

    /** 이보다 어두우면 검정으로 본다 (0~1) */
    private static final double MIN_BRIGHTNESS = 0.18;

    private StickerInkColor() {
    }

    /**
     * {@code #RRGGBB} → 색 이름. 색을 안 골랐다고 볼 값이면 null.
     *
     * @param hex 프론트가 보낸 잉크 색. null·형식 오류·검정·회색이면 null 을 돌려준다
     */
    public static String toChipName(String hex) {
        int[] rgb = parse(hex);
        if (rgb == null) {
            return null;
        }

        // HSV 직접 계산. java.awt 를 끌어오지 않는다 — 서버는 헤드리스이고 색 변환 하나에
        // AWT 를 의존시킬 이유가 없다
        double r = rgb[0] / 255.0, g = rgb[1] / 255.0, b = rgb[2] / 255.0;
        double max = Math.max(r, Math.max(g, b));
        double min = Math.min(r, Math.min(g, b));
        double delta = max - min;

        double saturation = max == 0 ? 0 : delta / max;
        // 채도가 낮거나(회색) 너무 어두우면(검정) 색을 고르지 않은 것으로 본다
        if (saturation < MIN_SATURATION || max < MIN_BRIGHTNESS) {
            return null;
        }

        double raw;
        if (delta == 0) {
            raw = 0;
        } else if (max == r) {
            raw = 60 * (((g - b) / delta) % 6);
        } else if (max == g) {
            raw = 60 * (((b - r) / delta) + 2);
        } else {
            raw = 60 * (((r - g) / delta) + 4);
        }

        int hue = (int) Math.round((raw + 360) % 360);
        int best = 0;
        int bestGap = Integer.MAX_VALUE;
        for (int i = 0; i < HUES.length; i++) {
            int gap = Math.abs(hue - HUES[i]);
            gap = Math.min(gap, 360 - gap);      // 색상환은 원형이라 359 와 1 은 2 만큼 떨어져 있다
            if (gap < bestGap) {
                bestGap = gap;
                best = i;
            }
        }

        return NAMES[best];
    }

    /** {@code #RRGGBB} 또는 {@code RRGGBB} 만 받는다. 그 밖은 null */
    private static int[] parse(String hex) {
        if (hex == null) {
            return null;
        }

        String s = hex.trim().toLowerCase(Locale.ROOT);
        if (s.startsWith("#")) {
            s = s.substring(1);
        }
        if (s.length() != 6 || !s.matches("[0-9a-f]{6}")) {
            return null;
        }

        return new int[]{
                Integer.parseInt(s.substring(0, 2), 16),
                Integer.parseInt(s.substring(2, 4), 16),
                Integer.parseInt(s.substring(4, 6), 16)
        };
    }
}
