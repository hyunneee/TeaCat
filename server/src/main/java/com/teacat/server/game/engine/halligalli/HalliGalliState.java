package com.teacat.server.game.engine.halligalli;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * 할리갈리 게임판 한 장. game_rooms.state 에 JSON 으로 통째로 들어간다.
 *
 * <p>🔴 <b>{@link #hands} 는 아무에게도 보내면 안 된다.</b> 뒤집기 전의 카드라서, 본인
 * 것이라도 알려주면 종을 언제 칠지 미리 계산할 수 있다. 응답 DTO 는 장수만 싣는다
 * ({@code HalliGalliViewResponse}).
 */
public class HalliGalliState {

    /** 과일 네 종류. 각 과일마다 1·2·3·4·5개짜리 카드가 있다 */
    public static final List<String> FRUITS = List.of("STRAWBERRY", "BANANA", "LIME", "PLUM");

    /** 종을 칠 수 있는 개수 */
    public static final int BELL_COUNT = 5;

    /** 지금 카드를 뒤집을 차례인 자리 */
    public int turn;

    public int players;

    /** [자리] = 엎어 둔 카드 더미. 맨 앞이 다음에 뒤집을 카드다 */
    public List<List<HalliGalliCard>> hands = new ArrayList<>();

    /** [자리] = 펼쳐 놓은 더미. 맨 앞이 지금 보이는 카드다 */
    public List<List<HalliGalliCard>> piles = new ArrayList<>();

    /** 카드가 떨어져 판에서 빠진 자리 */
    public List<Boolean> eliminated = new ArrayList<>();

    /** 빠진 순서. 등수를 거꾸로 매기는 데 쓴다 (마지막까지 남은 사람이 1등) */
    public List<Integer> eliminationOrder = new ArrayList<>();

    public List<String> log = new ArrayList<>();

    public boolean finished;

    /** 방금 종이 울렸나 — 화면에서 효과를 주기 위해서만 쓴다 */
    public Integer lastBellSeat;
    public Boolean lastBellCorrect;

    public static HalliGalliState start(int players, Random random) {
        HalliGalliState state = new HalliGalliState();
        state.players = players;
        state.turn = 0;

        List<HalliGalliCard> deck = newDeck();
        Collections.shuffle(deck, random);

        for (int seat = 0; seat < players; seat++) {
            state.hands.add(new ArrayList<>());
            state.piles.add(new ArrayList<>());
            state.eliminated.add(false);
        }
        // 나눠 떨어지지 않으면 앞자리가 한 장 더 갖는다. 할리갈리는 장수 차이가 유불리가 아니다
        for (int i = 0; i < deck.size(); i++) {
            state.hands.get(i % players).add(deck.get(i));
        }
        return state;
    }

    /** 정품 구성과 같다 — 과일마다 1개 5장, 2개 3장, 3개 3장, 4개 2장, 5개 1장 = 14장 × 4 = 56장 */
    public static List<HalliGalliCard> newDeck() {
        int[] copies = {0, 5, 3, 3, 2, 1};
        List<HalliGalliCard> deck = new ArrayList<>();
        for (String fruit : FRUITS) {
            for (int count = 1; count <= 5; count++) {
                for (int i = 0; i < copies[count]; i++) {
                    deck.add(new HalliGalliCard(fruit, count));
                }
            }
        }
        return deck;
    }

    public boolean isAlive(int seat) {
        return seat >= 0 && seat < eliminated.size() && !Boolean.TRUE.equals(eliminated.get(seat));
    }

    /** 펼쳐진 카드 중 맨 위만. 종을 칠 수 있는지는 이것들로만 판정한다 */
    public List<HalliGalliCard> visibleTops() {
        List<HalliGalliCard> tops = new ArrayList<>();
        for (List<HalliGalliCard> pile : piles) {
            if (!pile.isEmpty()) {
                tops.add(pile.getFirst());
            }
        }
        return tops;
    }

    /** 보이는 카드에서 같은 과일이 정확히 5개인 과일이 있나 */
    public boolean bellIsCorrect() {
        for (String fruit : FRUITS) {
            int sum = 0;
            for (HalliGalliCard card : visibleTops()) {
                if (card.fruit().equals(fruit)) {
                    sum += card.count();
                }
            }
            if (sum == BELL_COUNT) {
                return true;
            }
        }
        return false;
    }

    public int totalCards(int seat) {
        return hands.get(seat).size() + piles.get(seat).size();
    }

    public void addLog(String line) {
        log.add(line);
        while (log.size() > 30) {
            log.removeFirst();
        }
    }
}
