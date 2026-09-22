package com.teacat.server.game.engine.yut;

/**
 * 윷판 29밭의 길.
 *
 * <pre>
 *   바깥 19밭   0..18       0이 첫 밭, 18 다음이 도착(참먹이)이다
 *   모서리      4(5밭째) · 9(10밭째) · 14(15밭째)
 *   지름길 1    19,20 → 중앙 → 22,23 → 모서리 14   (모서리 4에서 진입)
 *   지름길 2    24,25 → 중앙 → 26,27 → 도착        (모서리 9에서 진입)
 *   중앙        21
 *   도착        28
 * </pre>
 *
 * <p>밭은 29개다 — 바깥 20(참먹이 포함) + 지름길 8 + 중앙 1. 말이 <b>머무를 수 있는</b>
 * 바깥 밭은 19개인데, 참먹이에 닿는 것은 머무는 것이 아니라 나는 것이기 때문이다.
 * 그래서 바깥으로만 돌면 정확히 20칸이다.
 *
 * <p>🔴 지름길은 <b>모서리에 정확히 멈췄을 때만</b> 탄다. 지나가는 것은 소용없다. 그래서
 * 길을 "다음 밭" 함수가 아니라 <b>출발 밭마다 도착까지의 전체 경로</b>로 적었다. 다음 밭
 * 함수로 만들면 중앙(21)에서 갈림길이 생긴다 — 지름길 1을 타고 <b>지나가는</b> 중이면
 * 22로 이어져야 하고, 중앙에 <b>멈춰 섰다면</b> 26으로 빠져 도착으로 직행해야 하는데,
 * 다음 밭만 봐서는 그 둘을 구별할 수 없다. 경로를 통째로 쥐면 구별할 필요가 없다.
 *
 * <p>가장 짧은 길은 11칸이다 — 모(5)로 모서리 4에 서고, 걸(3)로 중앙에 서고, 걸(3)로 도착.
 */
public final class YutBoard {

    /** 아직 판에 오르지 않은 말 */
    public static final int HOME = -1;
    public static final int CENTER = 21;
    public static final int GOAL = 28;

    /** 말이 머무를 수 있는 마지막 바깥 밭 */
    private static final int OUTER_LAST = 18;

    /** ROUTES[from] = from 에서 출발했을 때 지나갈 밭들을 순서대로. 마지막은 항상 GOAL */
    private static final int[][] ROUTES = buildRoutes();

    private YutBoard() {
    }

    /**
     * {@code from} 에서 {@code steps} 칸 간 자리.
     *
     * <p>도착을 지나쳐도 완주로 친다 — 윷놀이는 딱 떨어져야 나는 규칙이 아니다.
     *
     * @param from  HOME 이면 판 밖에서 출발한다
     * @param steps 1 이상
     */
    public static int advance(int from, int steps) {
        int[] route = from == HOME ? ROUTES[0] : ROUTES[from];
        // 판 밖에서 출발하면 첫 밭(0)이 1걸음이다. ROUTES[0] 은 0 다음부터라 한 칸 당긴다
        int index = from == HOME ? steps - 2 : steps - 1;
        if (index < 0) {
            return 0;
        }
        return index >= route.length ? GOAL : route[index];
    }

    /** 말이 판 위에 서 있나. 대기 중이거나 완주한 말은 잡거나 업을 수 없다 */
    public static boolean isOnBoard(int position) {
        return position != HOME && position != GOAL;
    }

    /**
     * 여기서 도착까지 남은 칸 수.
     *
     * <p>끝내지 못한 사람끼리 등수를 가릴 때 쓴다. <b>밭 번호를 거리로 쓰면 안 된다</b> —
     * 지름길 밭은 번호가 큰데도 도착이 가깝거나 멀 수 있어서, 번호로 줄 세우면 더 앞선
     * 말이 뒤로 밀린다.
     */
    public static int stepsToGoal(int position) {
        if (position == GOAL) {
            return 0;
        }
        // 판 밖에서는 첫 밭에 오르는 한 걸음이 더 든다
        return position == HOME ? ROUTES[0].length + 1 : ROUTES[position].length;
    }

    /** 가장 먼 자리(판 밖)에서 도착까지의 칸 수 */
    public static int maxSteps() {
        return stepsToGoal(HOME);
    }

    private static int[][] buildRoutes() {
        int[][] routes = new int[GOAL][];

        // 바깥 밭. 모서리 4·9 는 지름길로 빠지고, 나머지는 옆 밭으로 간다
        for (int i = 0; i <= OUTER_LAST; i++) {
            routes[i] = switch (i) {
                case 4 -> concat(new int[]{19, 20, CENTER, 22, 23}, outerFrom(14));
                case 9 -> new int[]{24, 25, CENTER, 26, 27, GOAL};
                default -> outerFrom(i + 1);
            };
        }

        // 지름길 1 — 중앙을 지나 모서리 14 로 나간다
        routes[19] = concat(new int[]{20, CENTER, 22, 23}, outerFrom(14));
        routes[20] = concat(new int[]{CENTER, 22, 23}, outerFrom(14));
        routes[22] = concat(new int[]{23}, outerFrom(14));
        routes[23] = outerFrom(14);

        // 지름길 2 — 중앙을 지나 도착으로 직행한다
        routes[24] = new int[]{25, CENTER, 26, 27, GOAL};
        routes[25] = new int[]{CENTER, 26, 27, GOAL};
        routes[26] = new int[]{27, GOAL};
        routes[27] = new int[]{GOAL};

        // 🔴 중앙에 멈춰 섰으면 언제나 짧은 쪽(지름길 2의 출구)으로 나간다. 지름길 1로
        //    들어왔더라도 마찬가지다 — 그래서 중앙에 서는 것이 이 판에서 가장 좋은 수다
        routes[CENTER] = new int[]{26, 27, GOAL};

        return routes;
    }

    /** start 부터 바깥 마지막 밭까지, 그리고 도착 */
    private static int[] outerFrom(int start) {
        int[] route = new int[OUTER_LAST - start + 2];
        for (int i = 0; i < route.length - 1; i++) {
            route[i] = start + i;
        }
        route[route.length - 1] = GOAL;
        return route;
    }

    private static int[] concat(int[] head, int[] tail) {
        int[] merged = new int[head.length + tail.length];
        System.arraycopy(head, 0, merged, 0, head.length);
        System.arraycopy(tail, 0, merged, head.length, tail.length);
        return merged;
    }
}
