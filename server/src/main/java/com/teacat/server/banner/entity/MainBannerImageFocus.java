package com.teacat.server.banner.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 배너 이미지에서 <b>보여줄 한 점</b>.
 *
 * <p>배너 틀은 폰 4:3, 데스크톱 2:1 이다. 올린 그림의 비율이 이와 다르면 남는 쪽이 잘리는데,
 * 무엇을 남길지는 그림마다 다르다 — 얼굴이 위에 있는 포스터는 가운데를 남기면 목만 보인다.
 * 그래서 관리자가 그림을 끌어서 맞추고, 화면은 이 값을 CSS
 * {@code object-position: <x>% <y>%} 로 옮긴다.
 *
 * <p>0 은 왼쪽/위 끝, 50 은 가운데, 100 은 오른쪽/아래 끝이다. 예전에는 아홉 칸 중 하나를
 * 고르는 enum 이었는데, 끌어서 맞추려면 값이 이어져 있어야 해서 점으로 바꿨다
 * (마이그레이션 {@code V20260922_1100}).
 *
 * <p>공연 배너(포스터)에도 걸린다. 3:4 포스터를 2:1 로 자를 때가 가장 많이 잘린다.
 */
@Embeddable
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MainBannerImageFocus {

    private static final int MIN = 0;
    private static final int MAX = 100;
    private static final int MIDDLE = 50;

    @Column(name = "image_focus_x", nullable = false)
    private Integer x;

    @Column(name = "image_focus_y", nullable = false)
    private Integer y;

    private MainBannerImageFocus(int x, int y) {
        this.x = x;
        this.y = y;
    }

    /**
     * 화면이 보낸 값으로 만든다.
     *
     * <p>범위를 여기서 자른다. DTO 의 {@code @Min/@Max} 가 먼저 막지만, 그건 HTTP 로 들어온
     * 경우뿐이다 — 서버 안에서 부르는 곳이 생기면 그 검증을 안 탄다. DB CHECK 까지 가서
     * 500 이 나는 것보다 여기서 자르는 편이 낫다.
     */
    public static MainBannerImageFocus of(Integer x, Integer y) {
        return new MainBannerImageFocus(clamp(x), clamp(y));
    }

    /** 고르지 않았을 때. 지금까지 보이던 것과 같아야 기존 배너가 갑자기 바뀌지 않는다 */
    public static MainBannerImageFocus center() {
        return new MainBannerImageFocus(MIDDLE, MIDDLE);
    }

    private static int clamp(Integer value) {
        if (value == null) {
            return MIDDLE;
        }
        return Math.min(MAX, Math.max(MIN, value));
    }
}
