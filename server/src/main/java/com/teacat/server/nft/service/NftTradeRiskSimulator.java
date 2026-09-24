package com.teacat.server.nft.service;

import com.teacat.server.common.exception.BusinessException;
import com.teacat.server.nft.dto.request.TradeSimulationRequest;
import com.teacat.server.nft.dto.response.TradeSimulationResponse;
import com.teacat.server.nft.exception.NftErrorCode;
import jakarta.persistence.EntityManager;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 이상거래 학습 데이터를 만드는 시뮬레이터 (AUCTION_FRAUD_DESIGN.md 14-2).
 *
 * <p>실사용자가 없는 동안 모델에 먹일 데이터를 채우기 위한 <b>개발용 도구</b>다.
 * 가짜 사용자가 시장을 이루고, 그중 일부에게 사기 대본(자전 입찰·순환 거래·매집·계정 탈취)을 준다.
 *
 * <h3>왜 HTTP 를 타지 않고 DB 에 직접 심나</h3>
 * 정산은 체인을 탄다 — 거래 한 건이 CAT 전송·NFT 전송·영수증 확인으로 트랜잭션 여러 개다.
 * 수천 건을 실제 API 로 만들면 블록체인 서비스를 띄워 두고 한참 기다려야 한다.
 * 대신 행을 심고 <b>심사만 운영과 똑같은 경로로 태운다</b> — {@link NftTradeSettlementWriter#screen}
 * 를 그대로 부르므로 규칙이 보는 맥락도, 저장되는 피처도 운영과 같은 코드가 만든다.
 * 학습 데이터를 따로 조회해 만들면 서빙 때 값과 어긋난다(training-serving skew).
 *
 * <h3>🔴 운영에서 돌리지 않는다</h3>
 * 만들어진 거래는 {@code COMPLETED} 로 들어가 시세 중앙값·거래량·인기 포토카드 순위에 그대로 섞인다.
 * 그래서 {@code nft.trade.simulator.enabled} 가 기본 false 이고, 배포 설정에서 켜지 않는다.
 *
 * <h3>🔴 라벨을 관리자 판정과 섞지 않는다</h3>
 * 대본 라벨은 {@code simulation_labels} 에만 넣는다. 합성은 학습용, 실데이터는 평가용이다.
 */
@Slf4j
@Service
public class NftTradeRiskSimulator {

    static final String NORMAL = "NORMAL";
    static final String SHILL = "SHILL_BIDDING";
    static final String CIRCULAR_PAIR = "CIRCULAR_PAIR";
    static final String CIRCULAR_RING = "CIRCULAR_RING";
    static final String HOARDING = "HOARDING";
    static final String TAKEOVER = "ACCOUNT_TAKEOVER";
    static final String DECOR_LAUNDERING = "DECOR_LAUNDERING";

    /** 로컬 체인. 심사는 체인을 보지 않으므로 값 자체에 의미는 없고 지갑 유니크 제약만 맞추면 된다 */
    private static final int CHAIN_ID = 31337;
    /** 시장 기준가(CAT). 규칙 R4 는 이 값의 중앙값 대비 배율로 판단한다 */
    private static final long BASE_PRICE = 200;
    /** 도안 발행량. R7 은 발행량이 10 미만이면 아예 판단하지 않는다 */
    private static final int SUPPLY = 20;
    /** 매집범이 쓸어 담는 장수. 6장째(6/20 = 0.3)부터 R7 이 걸린다 */
    private static final int HOARD_BUYS = 9;

    private final JdbcTemplate jdbc;
    private final NftTradeSettlementWriter writer;
    private final EntityManager entityManager;
    private final TransactionTemplate tx;
    private final boolean enabled;

    public NftTradeRiskSimulator(JdbcTemplate jdbc, NftTradeSettlementWriter writer, EntityManager entityManager,
                                 PlatformTransactionManager transactionManager,
                                 @Value("${nft.trade.simulator.enabled:false}") boolean enabled) {
        this.jdbc = jdbc;
        this.writer = writer;
        this.entityManager = entityManager;
        this.tx = new TransactionTemplate(transactionManager);
        this.enabled = enabled;
    }

    public TradeSimulationResponse simulate(TradeSimulationRequest request) {
        if (!enabled) {
            throw new BusinessException(NftErrorCode.SIMULATOR_DISABLED);
        }
        Run run = new Run(request);
        run.execute();
        TradeSimulationResponse report = run.report();
        log.info("이상거래 시뮬레이션 완료 batchId={} 심사={}건 적중={}건 TP={} FN={} FP={}",
                report.batchId(), report.screenedTrades(), report.flaggedTrades(),
                report.truePositives(), report.falseNegatives(), report.falsePositives());
        return report;
    }

    private enum Kind { AUCTION_NATURAL, AUCTION_BUY_NOW, LISTING }

    private record Device(String ip, String uaHash) {}

    private record Actor(long userId, String phone, long walletId, Device device) {}

    /** 심사에 태울 거래 한 건의 재료 */
    private record Sale(Kind kind, long photocardId, Actor seller, Actor buyer, Actor runnerUp,
                        long price, LocalDateTime requestAt, LocalDateTime closedAt) {}

    /**
     * 한 판. 대본마다 트랜잭션을 따로 연다 — 거래를 심고, 심사하고, 완료시키는 세 단계가
     * 한 트랜잭션 안에서 끝나야 정산 스케줄러가 중간 상태({@code PENDING})를 보고 체인으로 보내지 않는다.
     */
    private final class Run {

        private final TradeSimulationRequest request;
        private final UUID batchId = UUID.randomUUID();
        private final Random random;
        private final LocalDateTime now;

        private int seq;
        private final List<Actor> traders = new ArrayList<>();
        private final List<Long> designs = new ArrayList<>();
        private final Map<Long, List<Long>> designCards = new HashMap<>();
        private final Map<Long, Actor> cardOwner = new HashMap<>();
        /** 정상 표본이 우연히 규칙에 걸리지 않도록, 이미 엮인 두 사람과 이 카드를 가져 본 사람을 기억한다 */
        private final Set<String> tradedPairs = new HashSet<>();
        private final Map<Long, Set<Long>> cardPastOwners = new HashMap<>();

        private Run(TradeSimulationRequest request) {
            this.request = request;
            this.random = request.seed() == null ? new Random() : new Random(request.seed());
            // 규칙의 기간 계산은 DB 시각을 쓴다. 심는 시각도 같은 시계여야 "30일 안" 이 어긋나지 않는다
            this.now = jdbc.queryForObject("SELECT now()::timestamp", LocalDateTime.class);
        }

        /**
         * 🔴 대본을 <b>섞어서</b> 돌린다. 종류별로 몰아 돌리면 시장 거래량이 단조롭게 늘어나
         * "거래량 = 몇 번째로 만들어졌나" 가 되고, 그게 곧 정답 표지가 된다.
         *
         * <p>실제로 그렇게 짰다가 baselineVolume·designTradesInWindow·recentVolume 이
         * <b>모든 대본에서 단독 AUC 0.98 이상</b>으로 나왔다. 모델이 수법이 아니라 생성 순서를
         * 배우고 있었던 것이다 (train.py 의 단독 분리력 검사가 잡았다).
         *
         * <p>섞으면 현실에도 가까워진다 — 사기는 정상 거래 사이에 끼어서 일어나지, 몰아서 일어나지 않는다.
         */
        private void execute() {
            tx.executeWithoutResult(s -> buildMarket());

            List<Runnable> cases = new ArrayList<>();
            for (int i = 0; i < request.normalTradesOr(); i++) cases.add(this::normalSale);
            for (int i = 0; i < request.shillCasesOr(); i++) cases.add(this::shillCase);
            for (int i = 0; i < request.circularCasesOr(); i++) cases.add(this::circularCase);
            for (int i = 0; i < request.hoardingCasesOr(); i++) cases.add(this::hoardingCase);
            for (int i = 0; i < request.takeoverCasesOr(); i++) cases.add(this::takeoverCase);
            for (int i = 0; i < request.decorCasesOr(); i++) cases.add(this::decorLaunderingCase);
            java.util.Collections.shuffle(cases, random);

            for (Runnable one : cases) {
                tx.executeWithoutResult(s -> one.run());
            }
        }

        // ---------------------------------------------------------------- 시장

        /**
         * 서로 모르는 사람들이 시세대로 주고받아 온 시장을 만든다.
         *
         * <p>과거 거래는 <b>심사에 태우지 않는다</b> — 피처 수집을 켜기 전에 이미 있던 거래라는 뜻이고,
         * 실제로도 그렇다. 이 거래들의 쓸모는 R4 의 시세 중앙값과 R6 의 거래량 기준선을 만드는 것이다.
         * 그래서 기준 기간(now-34d ~ now-9d)에만 흩뿌리고 최근 7일은 비워 둔다.
         */
        private void buildMarket() {
            // 거래 수보다 사람이 넉넉해야 한다 — 같은 두 사람이 다시 엮이면 정상 표본이 R3 에 걸려
            // 오탐으로 잡히고, pickCounterparty 가 상대를 못 찾아 표본이 그냥 줄어든다
            int tradeBudget = request.historyPerDesignOr() * request.designsOr() + request.normalTradesOr();
            int traderCount = Math.max(16, tradeBudget / 3);
            for (int i = 0; i < traderCount; i++) {
                traders.add(newActor());
            }
            for (int d = 0; d < request.designsOr(); d++) {
                long designId = newDesign("시장도안");
                designs.add(designId);
                List<Long> cards = new ArrayList<>();
                for (int c = 0; c < SUPPLY; c++) {
                    Actor owner = pick(traders);
                    cards.add(newCard(designId, owner));
                }
                designCards.put(designId, cards);
                for (int h = 0; h < request.historyPerDesignOr(); h++) {
                    long cardId = pick(cards);
                    Actor seller = cardOwner.get(cardId);
                    Actor buyer = pickCounterparty(seller, cardId);
                    if (buyer == null) {
                        continue;
                    }
                    pastTrade(cardId, seller, buyer, jitter(BASE_PRICE),
                            between(now.minusDays(34), now.minusDays(9)));
                }
            }
        }

        // ---------------------------------------------------------------- 대본

        /** 서로 모르는 두 사람이 시세대로 한 번 주고받는다. 규칙에 걸리면 그게 오탐이다 */
        private void normalSale() {
            long designId = pick(designs);
            long cardId = pick(designCards.get(designId));
            Actor seller = cardOwner.get(cardId);
            Actor buyer = pickCounterparty(seller, cardId);
            if (buyer == null) {
                return;
            }
            Kind kind = switch (random.nextInt(3)) {
                case 0 -> Kind.AUCTION_NATURAL;
                case 1 -> Kind.AUCTION_BUY_NOW;
                default -> Kind.LISTING;
            };
            Actor runnerUp = kind == Kind.AUCTION_NATURAL ? pickCounterparty(seller, cardId) : null;
            LocalDateTime at = between(now.minusDays(6), now.minusHours(2));
            // 🔴 정상 거래의 일부도 꾸며진 카드다. 안 그러면 "꾸밈 = 사기" 가 되어
            //    모델이 꾸민 사람을 전부 의심한다. 다만 꾸민 지 한참 지난 뒤에 판다
            if (random.nextInt(10) < 3) {
                // 🔴 대부분은 한참 전에 꾸몄지만 일부는 판매 직전에 꾸민다. 정상에도 짧은 간격이 있어야
                //    "꾸민 뒤 몇 분" 이 완벽한 구분선이 되지 않는다 — 완벽한 구분선은 언제나 대본의 흔적이다
                LocalDateTime decoratedAt = random.nextInt(10) < 2
                        ? at.minusMinutes(20 + random.nextInt(600))
                        : between(now.minusDays(30), now.minusDays(7));
                decorate(cardId, seller, 1 + random.nextInt(5), decoratedAt);
            }
            long tradeId = sale(new Sale(kind, cardId, seller, buyer, runnerUp,
                    jitter(BASE_PRICE), at.minusHours(3), at));
            label(tradeId, NORMAL, false, List.of(), null);
        }

        /**
         * 자전 입찰 — 판매자가 공범 계정으로 값을 올리고, 진짜 구매자가 부풀려진 값에 낙찰받는다.
         * 공범은 <b>같은 사람</b>이라 단말도 전화번호도 판매자와 같다(R1·R2). 값이 시세의 5배라 R4 도 걸린다.
         */
        private void shillCase() {
            Device shared = newDevice();
            String phone = newPhone();
            Actor seller = newActor(shared, phone);
            Actor accomplice = newActor(shared, phone);
            seedTradeHistory(seller);
            seedTradeHistory(accomplice);
            long designId = pick(designs);
            // 판매자가 카드를 갖고 있어야 경매에 올릴 수 있다. 시장에서 사 온 것으로 둔다
            Long cardId = giveCard(seller, designId, now.minusDays(20));
            if (cardId == null) {
                return;
            }
            Actor victim = pickCounterparty(seller, cardId);
            if (victim == null) {
                return;
            }

            LocalDateTime closedAt = between(now.minusDays(5), now.minusHours(2));
            long tradeId = sale(new Sale(Kind.AUCTION_NATURAL, cardId, seller, victim, accomplice,
                    BASE_PRICE * 5, closedAt.minusHours(6), closedAt));
            label(tradeId, SHILL, true,
                    List.of(TradeRiskSameDeviceRule.CODE, TradeRiskSamePhoneRule.CODE, TradeRiskPriceOutlierRule.CODE),
                    "공범이 판매자와 같은 단말·전화번호로 2위 입찰");
        }

        /**
         * 순환 거래 두 가지를 한 쌍으로 만든다.
         *
         * <p><b>2단(A→B→A)</b> 은 R3 이 되돌아온 것을 보고 잡는다.
         * <b>3단(A→B→C→A)</b> 은 <b>규칙이 원리적으로 못 잡는다</b> — R3 의 순환 판정이
         * "이 두 사람 사이" 로 한정돼 있어서, 마지막 구간(C→A)에서 보면 C 와 A 는 처음 거래하는 사이다.
         * 일부러 남겨 둔 구멍이고, 모델을 붙일 이유가 바로 여기다.
         */
        private void circularCase() {
            long designId = pick(designs);
            Actor a = newActor();
            Actor b = newActor();
            Actor c = newActor();
            seedTradeHistory(a);
            seedTradeHistory(b);
            seedTradeHistory(c);

            Long pairCard = giveCard(a, designId, now.minusDays(20));
            if (pairCard == null) {
                return;
            }
            long hop1 = sale(new Sale(Kind.LISTING, pairCard, a, b, null,
                    jitter(BASE_PRICE), now.minusDays(6), now.minusDays(6)));
            label(hop1, CIRCULAR_PAIR, true, List.of(), "순환의 첫 구간 — 되돌아오기 전이라 규칙이 볼 것이 없다");
            long hop2 = sale(new Sale(Kind.LISTING, pairCard, b, a, null,
                    jitter(BASE_PRICE), now.minusDays(2), now.minusDays(2)));
            label(hop2, CIRCULAR_PAIR, true, List.of(TradeRiskRepeatedPairRule.CODE), "카드가 원래 주인에게 되돌아옴");

            Long ringCard = giveCard(a, designId, now.minusDays(19));
            if (ringCard == null || ringCard.equals(pairCard)) {
                return;
            }
            long r1 = sale(new Sale(Kind.LISTING, ringCard, a, b, null,
                    jitter(BASE_PRICE), now.minusDays(6), now.minusDays(6)));
            long r2 = sale(new Sale(Kind.LISTING, ringCard, b, c, null,
                    jitter(BASE_PRICE), now.minusDays(4), now.minusDays(4)));
            long r3 = sale(new Sale(Kind.LISTING, ringCard, c, a, null,
                    jitter(BASE_PRICE), now.minusDays(2), now.minusDays(2)));
            label(r1, CIRCULAR_RING, true, List.of(), "3단 순환 1/3");
            label(r2, CIRCULAR_RING, true, List.of(), "3단 순환 2/3");
            label(r3, CIRCULAR_RING, true, List.of(),
                    "3단 순환 3/3 — R3 은 두 사람 사이만 보므로 C→A 를 첫 거래로 본다");
        }

        /**
         * 매집 — 한 계정이 한 도안을 쓸어 담아 품귀를 만든다.
         * 지분이 30% 를 넘는 순간부터 R7 이, 거래량이 기준선의 3배를 넘으면서 R6 이 함께 걸린다.
         * 앞쪽 몇 건은 아직 지분이 낮아 걸리지 않는다 — 그게 이 대본의 진짜 어려운 부분이다.
         */
        private void hoardingCase() {
            long designId = newDesign("매집도안");
            List<Long> cards = new ArrayList<>();
            for (int i = 0; i < SUPPLY; i++) {
                cards.add(newCard(designId, pick(traders)));
            }
            // 거래량 기준선. 이게 없으면 R6 은 "판단하지 않음" 으로 빠진다
            for (int h = 0; h < 8; h++) {
                long cardId = pick(cards);
                Actor seller = cardOwner.get(cardId);
                Actor buyer = pickCounterparty(seller, cardId);
                if (buyer == null) {
                    continue;
                }
                pastTrade(cardId, seller, buyer, jitter(BASE_PRICE), between(now.minusDays(29), now.minusDays(8)));
            }
            Actor hoarder = newActor();
            seedTradeHistory(hoarder);
            for (int i = 0; i < HOARD_BUYS; i++) {
                Long cardId = cards.stream()
                        .filter(id -> cardOwner.get(id).userId() != hoarder.userId())
                        .findFirst().orElse(null);
                if (cardId == null) {
                    return;
                }
                // 🔴 예전에는 12시간 간격이었다. 실제 매집은 몰아서 산다 — 간격을 분 단위로 좁혀야
                //    속도 피처(buyerTrades10m·1h)가 지분이 차기 전에 먼저 움직인다
                LocalDateTime at = now.minusDays(5).plusMinutes(i * 18L);
                long tradeId = sale(new Sale(Kind.AUCTION_BUY_NOW, cardId, cardOwner.get(cardId), hoarder, null,
                        jitter(BASE_PRICE), at, at));
                label(tradeId, HOARDING, true,
                        i + 1 >= 6 ? List.of(TradeRiskHoardingRule.CODE) : List.of(),
                        "%d/%d 장째 매집".formatted(i + 1, HOARD_BUYS));
            }
        }

        /**
         * 계정 탈취 — 평소 쓰던 단말이 아닌 곳에서 로그인한 직후 평소의 몇 배를 쓴다.
         * 세 조건(다른 단말 이력 있음 · 새 단말 첫 로그인 30분 안 · 평소 최대 지출의 2배 이상)이 모두 맞아야 R8 이다.
         */
        private void takeoverCase() {
            Actor victim = newActor(); // 주 단말 로그인 이력은 newActor 가 이미 남긴다
            long designId = pick(designs);
            // 평소 지출. 이게 없으면 R8 은 "몇 배" 를 말할 수 없어 빠진다
            if (giveCard(victim, designId, now.minusDays(10), 100) == null) {
                return;
            }

            long targetCard = pick(designCards.get(designId));
            Actor seller = cardOwner.get(targetCard);
            if (seller.userId() == victim.userId()) {
                return;
            }
            Device attacker = newDevice();
            login(victim, attacker, now.minusMinutes(10));
            Actor hijacked = new Actor(victim.userId(), victim.phone(), victim.walletId(), attacker);
            long tradeId = sale(new Sale(Kind.AUCTION_BUY_NOW, targetCard, seller, hijacked, null,
                    BASE_PRICE * 2, now.minusMinutes(5), now.minusMinutes(5)));
            label(tradeId, TAKEOVER, true, List.of(TradeRiskAccountTakeoverRule.CODE),
                    "처음 보는 단말 로그인 5분 뒤 평소 최대 지출의 4배 결제");
        }

        /**
         * 꾸밈을 알리바이로 쓴 가격 조작 (설계문서 14-2-3).
         *
         * <p><b>규칙이 하나도 걸지 못하도록</b> 짰다. 공범은 판매자와 다른 단말·다른 전화번호를 쓰고,
         * 둘은 처음 거래하는 사이이며, 계정도 오래됐다. 값은 시세의 10배지만 R4 는 꾸민 카드를
         * 판단하지 않으므로 빠진다 — 즉 <b>지금 규칙으로는 원리적으로 못 잡는다.</b>
         *
         * <p>남는 단서는 행동뿐이다. 꾸민 지 몇 분 만에 팔았고, 꾸민 사람이 곧 파는 사람이다.
         * 애정을 담아 꾸민 카드를 5분 만에 파는 사람은 드물다 — 그 차이를 모델이 배워야 한다.
         */
        private void decorLaunderingCase() {
            Actor seller = newActor();
            seedTradeHistory(seller);
            long designId = pick(designs);
            Long cardId = giveCard(seller, designId, now.minusDays(12));
            if (cardId == null) {
                return;
            }
            // 공범은 기존 트레이더다 — 갓 만든 계정을 쓰면 "이력 없음" 이 곧 정답 표지가 된다
            Actor accomplice = pickCounterparty(seller, cardId);
            if (accomplice == null) {
                return;
            }

            LocalDateTime decoratedAt = between(now.minusDays(4), now.minusHours(3));
            decorate(cardId, seller, 2 + random.nextInt(6), decoratedAt);
            // 꾸미자마자 판다 — 이 짧은 간격이 정상 꾸밈(며칠~몇 주)과 갈리는 지점이다
            LocalDateTime soldAt = decoratedAt.plusMinutes(3 + random.nextInt(25));

            long tradeId = sale(new Sale(Kind.LISTING, cardId, seller, accomplice, null,
                    BASE_PRICE * 10, soldAt, soldAt));
            label(tradeId, DECOR_LAUNDERING, true, List.of(),
                    "꾸민 지 몇 분 만에 시세 10배로 판매 — R4 는 꾸민 카드를 판단하지 않는다");
        }

        /**
         * 🔴 새로 만든 배우에게 <b>평범한 거래 이력</b>을 심는다.
         *
         * <p>세 번째로 같은 함정에 빠져서 넣었다. 사기 대본은 배우를 그 자리에서 만들고 정상 거래는
         * 기존 트레이더를 쓰니, 모델이 수법이 아니라 <b>"이력 없으면 사기"</b> 를 배웠다
         * (hasSpendHistory 가 꾸밈 세탁에서 0.00, 정상에서 0.79). 앞선 두 번은 가입 시각과
         * 로그인 이력이었다 — 전부 "대본이 만든 배우는 정상과 다르게 생겼다" 는 한 가지 문제다.
         *
         * <p>현실의 사기꾼도 갓 만든 계정만 쓰지 않는다. 오히려 <b>묵혀 둔 계정</b>을 쓴다.
         */
        private void seedTradeHistory(Actor actor) {
            if (designs.isEmpty()) {
                return;
            }
            for (int i = 0; i < 1 + random.nextInt(3); i++) {
                long cardId = pick(designCards.get(pick(designs)));
                Actor owner = cardOwner.get(cardId);
                if (owner == null || owner.userId() == actor.userId()) {
                    continue;
                }
                pastTrade(cardId, owner, actor, jitter(BASE_PRICE),
                        between(now.minusDays(33), now.minusDays(10)));
            }
        }

        /**
         * 배우에게 이 도안의 카드를 하나 쥐여 준다. 못 구하면 null.
         *
         * <p>🔴 <b>이미 그 배우가 가진 카드는 고르지 않는다.</b> 자기 자신에게 파는 거래가 되어
         * {@code chk_nft_photocard_trades_parties} 에 걸린다 — seedTradeHistory 를 넣자마자
         * 배우가 시장 카드를 이미 갖고 있는 경우가 생겨 실제로 터졌다.
         */
        private Long giveCard(Actor actor, long designId, LocalDateTime at) {
            return giveCard(actor, designId, at, jitter(BASE_PRICE));
        }

        /** @param price 이 매입의 가격. 탈취 대본은 "평소 지출" 기준선을 만들어야 해서 값을 고정한다 */
        private Long giveCard(Actor actor, long designId, LocalDateTime at, long price) {
            List<Long> cards = designCards.get(designId);
            int start = random.nextInt(cards.size());
            for (int i = 0; i < cards.size(); i++) {
                long cardId = cards.get((start + i) % cards.size());
                Actor owner = cardOwner.get(cardId);
                if (owner != null && owner.userId() != actor.userId()) {
                    pastTrade(cardId, owner, actor, price, at);
                    return cardId;
                }
            }
            return null;
        }

        /** 카드에 꾸밈을 얹는다. 한 카드에 하나뿐이라 이미 있으면 갱신한다 */
        private void decorate(long cardId, Actor owner, int stickers, LocalDateTime at) {
            String placements = java.util.stream.IntStream.range(0, stickers)
                    .mapToObj(i -> "{\"stickerId\":%d,\"x\":%d,\"y\":%d}".formatted(i, i * 10, i * 7))
                    .collect(Collectors.joining(",", "[", "]"));
            jdbc.update("""
                    INSERT INTO photocard_decorations (photocard_id, user_id, image_key, placements,
                                                       created_at, updated_at)
                    VALUES (?, ?, ?, ?::jsonb, ?, ?)
                    ON CONFLICT (photocard_id) DO UPDATE
                        SET user_id = EXCLUDED.user_id, placements = EXCLUDED.placements,
                            updated_at = EXCLUDED.updated_at
                    """, cardId, owner.userId(), "simulation/decor-" + cardId + ".png", placements, at, at);
        }

        // ---------------------------------------------------------------- 거래 만들기

        /**
         * 거래 한 건을 심고 <b>운영과 같은 심사 경로</b>({@link NftTradeSettlementWriter#screen})에 태운다.
         *
         * <p>심사가 끝나면 체인을 타지 않고 바로 완료시킨다. 같은 트랜잭션 안에서 끝내므로
         * 정산 스케줄러가 {@code PENDING} 상태를 보고 블록체인으로 보내는 일이 없다.
         * HOLD 모드에서 보류된 거래는 완료시키지 않는다 — 그게 그 모드의 동작이다.
         */
        private long sale(Sale s) {
            long tradeId = s.kind() == Kind.LISTING ? listingTrade(s) : auctionTrade(s);
            boolean held = writer.screen(tradeId);
            // 🔴 순서가 중요하다. screen() 이 건드린 거래 엔티티가 영속성 컨텍스트에 남아 있으면
            //    커밋 때 Hibernate 가 전체 컬럼을 되써서 아래 JDBC UPDATE 의 COMPLETED 를 덮는다.
            entityManager.flush();
            entityManager.clear();
            if (!held) {
                complete(tradeId, s.photocardId(), s.buyer(), s.closedAt());
            }
            return tradeId;
        }

        private long auctionTrade(Sale s) {
            boolean buyNow = s.kind() == Kind.AUCTION_BUY_NOW;
            long step = Math.max(1, s.price() / 10);
            long startPrice = Math.max(1, buyNow ? s.price() / 2 : s.price() - 3 * step);
            Long auctionId = jdbc.queryForObject("""
                            INSERT INTO nft_auctions (photocard_id, seller_id, start_price, buy_now_price,
                                                      current_price, bid_count, ends_at, status, winner_id,
                                                      created_at, updated_at, closed_at, client_ip, user_agent_hash)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 'SOLD', ?, ?, ?, ?, ?, ?) RETURNING id
                            """, Long.class, s.photocardId(), s.seller().userId(), startPrice,
                    buyNow ? s.price() : null, s.price(), buyNow ? 0 : 3, s.closedAt(), s.buyer().userId(),
                    s.requestAt(), s.closedAt(), s.closedAt(),
                    s.seller().device().ip(), s.seller().device().uaHash());

            if (!buyNow) {
                // 구매자가 "돈을 걸기로 한 시각" 은 첫 입찰이고 단말은 최고 입찰의 것이다 (NftTradeRiskQueryRepository)
                bid(auctionId, s.buyer(), s.price() - 2 * step, s.requestAt());
                if (s.runnerUp() != null) {
                    bid(auctionId, s.runnerUp(), s.price() - step, s.requestAt().plusMinutes(10));
                }
                long topBidId = bid(auctionId, s.buyer(), s.price(), s.closedAt().minusMinutes(1));
                jdbc.update("UPDATE nft_auctions SET top_bid_id = ? WHERE id = ?", topBidId, auctionId);
            }
            return insertTrade(s, auctionId, null, buyNow ? "AUCTION_BUY_NOW" : "AUCTION_BID",
                    buyNow ? s.buyer().device() : null);
        }

        private long listingTrade(Sale s) {
            Long listingId = jdbc.queryForObject("""
                            INSERT INTO nft_photocard_listings (photocard_id, seller_id, price, description, status,
                                                                listed_at, closed_at, client_ip, user_agent_hash)
                            VALUES (?, ?, ?, '시뮬레이션 판매', 'SOLD', ?, ?, ?, ?) RETURNING id
                            """, Long.class, s.photocardId(), s.seller().userId(), s.price(),
                    s.requestAt(), s.closedAt(), s.seller().device().ip(), s.seller().device().uaHash());
            return insertTrade(s, null, listingId, null, s.buyer().device());
        }

        /** @param buyerDevice 거래 행에 남길 구매자 단말. 자연 낙찰은 입찰 행에서 읽으므로 null 이다 */
        private long insertTrade(Sale s, Long auctionId, Long listingId, String holdType, Device buyerDevice) {
            return jdbc.queryForObject("""
                            INSERT INTO nft_photocard_trades
                                (photocard_id, seller_id, buyer_id, price, idempotency_key, auction_id, listing_id,
                                 chain_status, payment_hold_ref_type, client_ip, user_agent_hash,
                                 created_at, updated_at)
                            VALUES (?, ?, ?, ?, gen_random_uuid(), ?, ?, 'PENDING',
                                    ?::cat_money_hold_ref_type, ?, ?, ?, ?)
                            RETURNING id
                            """, Long.class, s.photocardId(), s.seller().userId(), s.buyer().userId(), s.price(),
                    auctionId, listingId, holdType,
                    buyerDevice == null ? null : buyerDevice.ip(),
                    buyerDevice == null ? null : buyerDevice.uaHash(),
                    s.requestAt(), s.requestAt());
        }

        private void complete(long tradeId, long photocardId, Actor buyer, LocalDateTime at) {
            jdbc.update("""
                    UPDATE nft_photocard_trades
                       SET chain_status = 'COMPLETED', completed_at = ?, traded_at = ?, updated_at = ?
                     WHERE id = ?
                    """, at, at, at, tradeId);
            transfer(photocardId, buyer);
        }

        /**
         * 심사에 태우지 않는 과거 거래. 시세·거래량의 표본이 될 뿐이다.
         *
         * <p>거래는 경매나 고정가 중 정확히 하나에서 나와야 한다({@code chk_nft_photocard_trades_source}).
         * 과거 거래의 출처는 규칙이 보지 않으므로 더 단순한 고정가로 둔다.
         */
        private void pastTrade(long cardId, Actor seller, Actor buyer, long price, LocalDateTime at) {
            Long listingId = jdbc.queryForObject("""
                    INSERT INTO nft_photocard_listings (photocard_id, seller_id, price, description, status,
                                                        listed_at, closed_at, client_ip, user_agent_hash)
                    VALUES (?, ?, ?, '시뮬레이션 과거 판매', 'SOLD', ?, ?, ?, ?) RETURNING id
                    """, Long.class, cardId, seller.userId(), price, at, at,
                    seller.device().ip(), seller.device().uaHash());
            jdbc.update("""
                    INSERT INTO nft_photocard_trades
                        (photocard_id, seller_id, buyer_id, price, idempotency_key, listing_id, chain_status,
                         completed_at, traded_at, created_at, updated_at, risk_screened_at)
                    VALUES (?, ?, ?, ?, gen_random_uuid(), ?, 'COMPLETED', ?, ?, ?, ?, ?)
                    """, cardId, seller.userId(), buyer.userId(), price, listingId, at, at, at, at, at);
            transfer(cardId, buyer);
        }

        private void transfer(long cardId, Actor buyer) {
            Actor seller = cardOwner.get(cardId);
            if (seller != null) {
                tradedPairs.add(pairKey(seller.userId(), buyer.userId()));
            }
            jdbc.update("UPDATE nft_photocards SET owner_id = ?, wallet_id = ? WHERE id = ?",
                    buyer.userId(), buyer.walletId(), cardId);
            cardOwner.put(cardId, buyer);
            cardPastOwners.computeIfAbsent(cardId, k -> new HashSet<>()).add(buyer.userId());
        }

        private long bid(long auctionId, Actor bidder, long amount, LocalDateTime at) {
            return jdbc.queryForObject("""
                    INSERT INTO nft_auction_bids (auction_id, bidder_id, amount, created_at,
                                                  client_ip, user_agent_hash)
                    VALUES (?, ?, ?, ?, ?, ?) RETURNING id
                    """, Long.class, auctionId, bidder.userId(), amount, at,
                    bidder.device().ip(), bidder.device().uaHash());
        }

        /**
         * 🔴 <b>모든</b> 배우가 로그인 이력을 갖는다 — 주 단말 여러 번에 부단말 한둘.
         *
         * <p>처음에는 계정 탈취 피해자에게만 로그인을 남겼더니, 모델이 "로그인 기록이 있으면 탈취" 를
         * 배웠다(buyerPriorDeviceLogins 계수가 buyerDeviceSeenBefore 와 완전히 같게 나왔다).
         * 현실에서는 누구나 로그인하므로, 여기서도 누구나 남겨야 탈취의 진짜 신호
         * — <b>처음 보는 단말에서 방금</b> 로그인했다는 것 — 만 남는다.
         */
        private void seedLogins(Actor actor) {
            for (int i = 0; i < 4 + random.nextInt(14); i++) {
                login(actor, actor.device(), between(now.minusDays(60), now.minusDays(2)));
            }
            for (int d = 0; d < 1 + random.nextInt(2); d++) {
                Device other = newDevice();
                for (int i = 0; i < 1 + random.nextInt(4); i++) {
                    login(actor, other, between(now.minusDays(60), now.minusDays(2)));
                }
            }
        }

        private void login(Actor actor, Device device, LocalDateTime at) {
            jdbc.update("""
                    INSERT INTO user_login_events (user_id, client_ip, user_agent_hash, created_at)
                    VALUES (?, ?, ?, ?)
                    """, actor.userId(), device.ip(), device.uaHash(), at);
        }

        // ---------------------------------------------------------------- 재료 만들기

        private Actor newActor() {
            return newActor(newDevice(), newPhone());
        }

        /**
         * 🔴 가입 시각은 <b>대본과 무관하게</b> 같은 분포에서 뽑는다.
         *
         * <p>처음에는 대본마다 가입일을 박아 뒀다(매집범 35일 전, 순환 46~50일 전, 일반 60~180일 전).
         * 그랬더니 모델이 PR-AUC 1.000 을 냈는데, 수법을 배운 게 아니라 <b>"계정이 어리면 사기"</b> 를
         * 배운 것이었다 — 시뮬레이터가 만든 흔적이지 현실의 신호가 아니다.
         * 합성 데이터로 학습할 때 가장 흔한 함정이고, 성능이 너무 좋으면 먼저 이걸 의심해야 한다.
         */
        private LocalDateTime randomSignupAt() {
            return now.minusDays(30 + random.nextInt(150)).minusHours(random.nextInt(24));
        }

        private Actor newActor(Device device, String phone) {
            LocalDateTime createdAt = randomSignupAt();
            String tag = tag();
            Long userId = jdbc.queryForObject("""
                            INSERT INTO users (email, name, phone, nickname, role, created_at, updated_at)
                            VALUES (?, ?, ?, ?, 'USER', ?, ?) RETURNING id
                            """, Long.class, "sim-" + tag + "@simulation.local", "시뮬" + tag, phone, "sim-" + tag,
                    createdAt, createdAt);
            Long ownerId = jdbc.queryForObject("""
                    INSERT INTO wallet_owners (user_id, derivation_index, owner_address, key_version, status)
                    VALUES (?, 0, ?, 1, 'ACTIVE') RETURNING id
                    """, Long.class, userId, address(tag + "-owner"));
            Long walletId = jdbc.queryForObject("""
                    INSERT INTO wallets (owner_id, chain_id, type, address, status, deployed)
                    VALUES (?, ?, 'SMART_ACCOUNT', ?, 'ACTIVE', true) RETURNING id
                    """, Long.class, ownerId, CHAIN_ID, address(tag + "-wallet"));
            // R5(신규 계정 급행)가 판단할 수 있도록 첫 충전을 남긴다.
            // 🔴 가입 직후로 고정하면 minutesSinceFirstDeposit 이 계정 나이의 복사본이 된다 —
            //    실제로 학습해 보니 두 피처의 계수가 완전히 같게 나왔다. 며칠 범위로 흩뿌린다
            LocalDateTime depositAt = createdAt.plusMinutes(10 + random.nextInt(5 * 24 * 60));
            jdbc.update("""
                            INSERT INTO cat_transactions (user_id, wallet_id, direction, reason, amount,
                                                          operation_key, status, created_at, updated_at, settled_at)
                            VALUES (?, ?, 'MINT', 'DEPOSIT', 100000, ?, 'CONFIRMED', ?, ?, ?)
                            """, userId, walletId, "sim-deposit-" + tag, depositAt, depositAt, depositAt);
            Actor actor = new Actor(userId, phone, walletId, device);
            seedLogins(actor);
            return actor;
        }

        /**
         * 도안은 공연에 매인 것이거나 뽑기풀이어야 한다({@code chk_nft_photocard_designs_pool}).
         * 공연을 만들려면 공연장·좌석배치까지 따라와야 해서, 시뮬레이션은 뽑기풀 도안으로 둔다 —
         * 심사 규칙은 공연을 보지 않고 발행량과 거래 이력만 본다.
         */
        private long newDesign(String prefix) {
            String tag = tag();
            return jdbc.queryForObject("""
                    INSERT INTO nft_photocard_designs (name, image_url, total_supply, issued_supply, chain_status,
                                                       draw_pool, group_name, grade)
                    VALUES (?, ?, ?, ?, 'REGISTERED', true, '시뮬레이션', 'COMMON') RETURNING id
                    """, Long.class, prefix + "-" + tag, "https://simulation.local/" + tag, SUPPLY, SUPPLY);
        }

        private long newCard(long designId, Actor owner) {
            Long cardId = jdbc.queryForObject("""
                    INSERT INTO nft_photocards (design_id, owner_id, wallet_id, status, minted_at)
                    VALUES (?, ?, ?, 'MINTED', now()) RETURNING id
                    """, Long.class, designId, owner.userId(), owner.walletId());
            cardOwner.put(cardId, owner);
            cardPastOwners.computeIfAbsent(cardId, k -> new HashSet<>()).add(owner.userId());
            return cardId;
        }

        private void label(long tradeId, String scenario, boolean fraud, List<String> expected, String note) {
            String json = expected.stream().map(r -> "\"" + r + "\"").collect(Collectors.joining(",", "[", "]"));
            jdbc.update("""
                    INSERT INTO simulation_labels (trade_id, batch_id, scenario, fraud, expected_rules, note)
                    VALUES (?, ?, ?, ?, ?::jsonb, ?)
                    """, tradeId, batchId, scenario, fraud, json, note);
        }

        // ---------------------------------------------------------------- 고르기·값 만들기

        /**
         * 정상 표본이 우연히 규칙에 걸리지 않도록 상대를 고른다.
         * 이미 거래한 적 있는 사람(R3 반복 거래쌍)과 이 카드를 가져 본 적 있는 사람(R3 순환)은 제외한다.
         * 대본이 아닌 곳에서 규칙이 걸리면 그건 대본의 실수지 규칙의 오탐이 아니다.
         */
        private Actor pickCounterparty(Actor seller, long cardId) {
            Set<Long> pastOwners = cardPastOwners.getOrDefault(cardId, Set.of());
            List<Actor> candidates = traders.stream()
                    .filter(t -> t.userId() != seller.userId())
                    .filter(t -> !pastOwners.contains(t.userId()))
                    .filter(t -> !tradedPairs.contains(pairKey(seller.userId(), t.userId())))
                    .toList();
            return candidates.isEmpty() ? null : pick(candidates);
        }

        private String pairKey(long a, long b) {
            return Math.min(a, b) + ":" + Math.max(a, b);
        }

        private <T> T pick(List<T> list) {
            return list.get(random.nextInt(list.size()));
        }

        /** 시세 언저리로 흔든다. R4 는 중앙값의 4배부터 보므로 ±25% 는 안전하다 */
        private long jitter(long base) {
            return Math.max(1, Math.round(base * (0.75 + random.nextDouble() * 0.5)));
        }

        private LocalDateTime between(LocalDateTime from, LocalDateTime to) {
            long span = Math.max(1, Duration.between(from, to).toMinutes());
            return from.plusMinutes(random.nextInt((int) Math.min(span, Integer.MAX_VALUE)));
        }

        private String tag() {
            return batchId.toString().substring(0, 8) + "-" + (seq++);
        }

        private Device newDevice() {
            String tag = tag();
            String ip = "10.%d.%d.%d".formatted(random.nextInt(256), random.nextInt(256), 1 + random.nextInt(254));
            return new Device(ip, sha256(tag));
        }

        private String newPhone() {
            return "010%08d".formatted(random.nextInt(100_000_000));
        }

        private String address(String seed) {
            return "0x" + sha256(seed).substring(0, 40);
        }

        // ---------------------------------------------------------------- 성적표

        private TradeSimulationResponse report() {
            Map<String, Integer> byScenario = new LinkedHashMap<>();
            int[] matrix = new int[4]; // TP, FN, FP, TN
            jdbc.query("""
                    SELECT l.scenario, l.fraud, coalesce(f.flagged, false) AS flagged, count(*) AS n
                      FROM simulation_labels l
                      LEFT JOIN nft_trade_risk_features f ON f.trade_id = l.trade_id
                     WHERE l.batch_id = ?
                     GROUP BY 1, 2, 3
                    """, rs -> {
                boolean fraud = rs.getBoolean("fraud");
                boolean flagged = rs.getBoolean("flagged");
                int n = rs.getInt("n");
                byScenario.merge(rs.getString("scenario"), n, Integer::sum);
                matrix[fraud ? (flagged ? 0 : 1) : (flagged ? 2 : 3)] += n;
            }, batchId);

            Map<String, Integer> ruleHits = new LinkedHashMap<>();
            jdbc.query("""
                    SELECT s->>'rule' AS rule, count(*) AS n
                      FROM simulation_labels l
                      JOIN nft_trade_risk_features f ON f.trade_id = l.trade_id,
                           LATERAL jsonb_array_elements(f.signals) s
                     WHERE l.batch_id = ?
                     GROUP BY 1 ORDER BY 2 DESC
                    """, rs -> {
                // 블록으로 둬야 한다 — 값을 돌려주는 람다는 RowCallbackHandler 와 ResultSetExtractor 양쪽에 걸린다
                ruleHits.put(rs.getString("rule"), rs.getInt("n"));
            }, batchId);

            List<TradeSimulationResponse.Miss> misses = jdbc.query("""
                    SELECT l.trade_id, l.scenario, l.note
                      FROM simulation_labels l
                      LEFT JOIN nft_trade_risk_features f ON f.trade_id = l.trade_id
                     WHERE l.batch_id = ? AND l.fraud AND coalesce(f.flagged, false) = false
                     ORDER BY l.trade_id
                    """, (rs, i) -> new TradeSimulationResponse.Miss(
                    rs.getLong("trade_id"), rs.getString("scenario"), rs.getString("note")), batchId);

            int tp = matrix[0];
            int fn = matrix[1];
            int fp = matrix[2];
            int tn = matrix[3];
            Double precision = (tp + fp) == 0 ? null : round(tp / (double) (tp + fp));
            Double recall = (tp + fn) == 0 ? null : round(tp / (double) (tp + fn));
            return new TradeSimulationResponse(batchId, tp + fn + fp + tn, tp + fp,
                    byScenario, ruleHits, tp, fn, fp, tn, precision, recall, misses);
        }

        private double round(double value) {
            return Math.round(value * 1000) / 1000.0;
        }
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(64);
            for (byte b : digest) {
                hex.append("%02x".formatted(b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
