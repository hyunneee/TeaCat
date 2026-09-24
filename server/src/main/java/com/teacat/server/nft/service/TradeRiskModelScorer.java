package com.teacat.server.nft.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import tools.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

/**
 * 섀도우 모델 채점기 — 로지스틱 회귀 (AUCTION_FRAUD_DESIGN.md 14-3).
 *
 * <p><b>이 점수를 읽고 분기하는 코드는 없다.</b> 피처 행에 저장만 된다. 모델이 틀려도 사용자에게
 * 아무 일도 일어나지 않는 상태로 한동안 돌린 뒤, 관리자 판정과 맞춰 보고서야 권한을 준다.
 *
 * <h3>왜 파이썬 사이드카가 아니라 계수를 들고 오나</h3>
 * 학습은 파이썬이 한다({@code fds/train.py}). 하지만 <b>채점은 자바 안에서</b> 한다 —
 * 로지스틱 회귀의 채점은 내적 한 번이라 외부 서비스를 부를 이유가 없다. 사이드카를 두면
 * 정산 경로가 다른 프로세스의 생사에 매이고, 그 프로세스가 죽었을 때의 행동을 또 설계해야 한다.
 * 모델이 더 복잡해져 이 방식으로 안 될 때 사이드카로 옮기면 된다.
 *
 * <h3>🔴 절대 정산을 막지 않는다</h3>
 * 모델 파일이 없거나, 망가졌거나, 채점 중 예외가 나면 {@code null} 을 돌려준다. 점수가 없는 것은
 * 정상 상태다 — 이상거래 심사는 규칙만으로도 닫혀 있고, 모델은 아직 아무 결정권이 없다.
 */
@Slf4j
@Component
public class TradeRiskModelScorer {

    /**
     * 로짓의 절댓값 상한 — <b>범위 정보(lo·hi)가 없는 예전 모델에만</b> 적용하는 마지막 방어선이다.
     *
     * <p>🔴 범위가 있는 모델에는 걸지 않는다. 자르기가 이미 z 를 수학적으로 묶기 때문에 이 한도는
     * 보호가 아니라 <b>정상적인 고위험 탐지를 잘라내는 족쇄</b>가 된다. 실제로 15 로 두었더니
     * 합성 데이터의 부정 거래 740건 중 z 가 가장 높은 5건(최대 +15.7)이 "판단 불가" 로 빠졌다 —
     * 가장 확실한 탐지를 버리는 셈이었다.
     */
    private static final double LEGACY_MAX_ABS_Z = 40.0;

    private final ObjectMapper objectMapper;
    private final String resourcePath;
    private final boolean enabled;
    private final double outOfRangeLimit;

    private Model model;
    /** 모든 피처가 lo·hi 를 갖고 있나. 갖고 있으면 자르기가 z 를 묶으므로 로짓 상한을 걸지 않는다 */
    private boolean bounded;

    public TradeRiskModelScorer(ObjectMapper objectMapper,
                                @Value("${nft.trade.review.model.enabled:true}") boolean enabled,
                                @Value("${nft.trade.review.model.resource:fds/model.json}") String resourcePath,
                                @Value("${nft.trade.review.model.out-of-range-limit:0.25}") double outOfRangeLimit) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.resourcePath = resourcePath;
        this.outOfRangeLimit = outOfRangeLimit;
    }

    /**
     * 기동 때 한 번 읽는다. 없으면 경고만 남기고 점수 없이 돈다 —
     * 모델을 아직 학습하지 않은 상태가 정상적인 단계이기 때문이다.
     */
    @PostConstruct
    void load() {
        if (!enabled) {
            log.info("이상거래 섀도우 모델이 꺼져 있습니다");
            return;
        }
        ClassPathResource resource = new ClassPathResource(resourcePath);
        if (!resource.exists()) {
            log.warn("이상거래 섀도우 모델 파일이 없어 점수 없이 돕니다 resource={}", resourcePath);
            return;
        }
        try (InputStream in = resource.getInputStream()) {
            Model loaded = objectMapper.readValue(in, Model.class);
            if (loaded.version() == null || loaded.features() == null || loaded.features().isEmpty()) {
                log.warn("이상거래 섀도우 모델이 비어 있어 점수 없이 돕니다 resource={}", resourcePath);
                return;
            }
            this.model = loaded;
            this.bounded = loaded.features().stream().allMatch(f -> f.lo() != null && f.hi() != null);
            log.info("이상거래 섀도우 모델 적재 version={} 피처={}개 범위정보={}",
                    loaded.version(), loaded.features().size(), bounded ? "있음" : "없음");
        } catch (Exception e) {
            log.warn("이상거래 섀도우 모델을 읽지 못해 점수 없이 돕니다 resource={}", resourcePath, e);
        }
    }

    public String version() {
        return model == null ? null : model.version();
    }

    /**
     * 이 점수가 왜 나왔는지 — 피처별 기여도를 큰 것부터 돌려준다 (관리자 화면용).
     *
     * <p>🔴 <b>추측이 아니라 계산이다.</b> 로지스틱 회귀의 점수는 각 피처 기여의 단순 합이라
     * 한 항씩 그대로 떼어낼 수 있다. 설명 가능한 모델을 기준선으로 고른 값이 여기서 나온다 —
     * 같은 계산이 학습 과정에서 누수 4건을 찾아내기도 했다(14-2 누수 절).
     *
     * <p>⚠️ 지금 적재된 모델로 다시 계산한다. 채점 당시와 모델이 다르면 설명과 저장된 점수가
     * 어긋나므로, 호출하는 쪽이 {@code model_version} 을 대조해서 같을 때만 보여줘야 한다.
     *
     * @param limit 상위 몇 개까지
     */
    public List<Contribution> explain(Map<String, Object> features, int limit) {
        if (model == null || features == null || features.isEmpty()) {
            return List.of();
        }
        try {
            List<Contribution> all = new java.util.ArrayList<>();
            for (Feature f : model.features()) {
                double raw = numeric(features.get(f.name()), f.impute());
                double capped = clamp(raw, f);
                double std = f.std() == null || f.std() == 0 ? 1 : f.std();
                double mean = f.mean() == null ? 0 : f.mean();
                double contribution = f.coef() * ((capped - mean) / std);
                if (Math.abs(contribution) < 0.01) {
                    continue; // 0에 가까운 항은 설명이 되지 않는다
                }
                all.add(new Contribution(f.name(), TradeRiskFeatureLabels.of(f.name()),
                        Math.round(contribution * 100) / 100.0));
            }
            all.sort((a, b) -> Double.compare(Math.abs(b.contribution()), Math.abs(a.contribution())));
            return all.size() <= limit ? List.copyOf(all) : List.copyOf(all.subList(0, limit));
        } catch (Exception e) {
            log.warn("이상거래 섀도우 모델 기여도 계산 실패 version={}", model.version(), e);
            return List.of();
        }
    }

    /**
     * 피처 하나가 이 점수에 보탠 몫.
     *
     * @param contribution 양수면 부정 쪽으로, 음수면 정상 쪽으로 밀었다는 뜻
     */
    public record Contribution(String feature, String label, double contribution) {}

    /**
     * 부정 확률 0~1. 모델이 없거나, 채점이 실패하거나, <b>학습 범위 밖이면</b> null.
     *
     * <p>피처가 비어 있으면(심사가 꺼져 있거나 맥락을 못 읽은 경우) 채점하지 않는다 —
     * 전부 대치값으로 채운 점수는 "모르는 것" 이지 "정상" 이 아니다.
     *
     * <h3>🔴 왜 값을 자르고, 왜 멈추기까지 하나</h3>
     * 2026-09-23 dev 에서 실거래 4건이 <b>전부 1.000</b> 이 나왔다. 규칙이 정상이라 본 1원짜리
     * 거래까지 "부정 확률 100%" 였다. 원인은 모델이 틀려서가 아니라 <b>한 번도 본 적 없는 크기</b>가
     * 들어와서다 — 합성 시장의 최근 최대 지출 평균이 215 였는데 실거래에는 98,900 이 있었고,
     * 그 한 피처가 z 에 +1710 을 밀어 넣었다. 표준화는 "평균에서 몇 칸" 이라 학습 범위를 벗어나면
     * 기여도가 제한 없이 커진다.
     *
     * <p>그래서 두 겹으로 막는다.
     * <ol>
     *   <li><b>자르기</b> — 학습 때의 분위수 범위{@code [lo, hi]} 로 눌러 한 피처가 점수를 독점하지 못하게 한다.
     *       학습 때도 같은 범위로 자르고 배웠으므로 서빙에서만 다르게 굴지 않는다.</li>
     *   <li><b>멈추기</b> — 잘린 피처가 너무 많으면 이 거래는 모델이 아는 세상 밖이다.
     *       억지로 점수를 내는 것보다 "판단 불가" 가 정직하다.</li>
     * </ol>
     *
     * <p>⚠️ 이 로그가 계속 찍히면 모델이 현실과 안 맞는다는 뜻이다 — 재학습 신호로 읽는다.
     */
    public Double score(Map<String, Object> features) {
        if (model == null || features == null || features.isEmpty()) {
            return null;
        }
        try {
            double z = model.intercept();
            int outOfRange = 0;
            for (Feature f : model.features()) {
                double raw = numeric(features.get(f.name()), f.impute());
                double capped = clamp(raw, f);
                if (capped != raw) {
                    outOfRange++;
                }
                double std = f.std() == null || f.std() == 0 ? 1 : f.std();
                double mean = f.mean() == null ? 0 : f.mean();
                z += f.coef() * ((capped - mean) / std);
            }
            if (outOfRange > outOfRangeLimit * model.features().size()) {
                log.info("이상거래 섀도우 모델: 학습 범위 밖 피처가 {}/{}개라 채점하지 않습니다 version={}",
                        outOfRange, model.features().size(), model.version());
                return null;
            }
            // 🔴 범위 정보가 없는 예전 모델에서는 위의 자르기가 아무것도 하지 않는다.
            //    그런 모델이 배포돼 있어도 터무니없는 점수(2026-09-23 dev 회귀의 z=+1744)는 막는다.
            //    범위가 있는 모델은 자르기가 이미 묶으므로 이 검사를 건너뛴다.
            if (!Double.isFinite(z) || (!bounded && Math.abs(z) > LEGACY_MAX_ABS_Z)) {
                log.info("이상거래 섀도우 모델: 점수가 정상 범위를 벗어나 채점하지 않습니다 z={} version={}",
                        z, model.version());
                return null;
            }
            double p = 1.0 / (1.0 + Math.exp(-z));
            // 제약(0~1)에 걸리지 않도록 부동소수 오차를 잘라 낸다
            return Math.min(1.0, Math.max(0.0, Math.round(p * 100_000) / 100_000.0));
        } catch (Exception e) {
            log.warn("이상거래 섀도우 모델 채점 실패 version={}", model.version(), e);
            return null;
        }
    }

    /** 학습 때 본 범위로 누른다. lo·hi 가 없는 예전 모델 파일이면 그대로 둔다 */
    private static double clamp(double raw, Feature f) {
        double capped = raw;
        if (f.lo() != null) {
            capped = Math.max(f.lo(), capped);
        }
        if (f.hi() != null) {
            capped = Math.min(f.hi(), capped);
        }
        return capped;
    }

    /**
     * 학습 때와 <b>같은 규칙</b>으로 값을 숫자로 바꾼다. 여기가 어긋나면 training-serving skew 다.
     * 불리언은 1/0, 없거나 null 이면 학습 때 계산해 둔 대치값(중앙값)을 쓴다.
     */
    private static double numeric(Object value, Double impute) {
        double fallback = impute == null ? 0 : impute;
        if (value == null) {
            return fallback;
        }
        if (value instanceof Boolean b) {
            return b ? 1 : 0;
        }
        if (value instanceof Number n) {
            double d = n.doubleValue();
            return Double.isFinite(d) ? d : fallback;
        }
        return fallback;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Model(String version, double intercept, List<Feature> features) {}

    /**
     * @param mean   학습 데이터의 평균 (표준화용). 아래 lo·hi 로 자른 뒤 계산한 값이다
     * @param std    학습 데이터의 표준편차. 0이면 1로 본다
     * @param impute 값이 없을 때 쓸 대치값. 학습 때의 중앙값
     * @param lo     학습 때 본 하한(분위수). 이보다 작으면 이 값으로 누른다. 없으면 자르지 않는다
     * @param hi     학습 때 본 상한(분위수). 이보다 크면 이 값으로 누른다
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Feature(String name, double coef, Double mean, Double std, Double impute, Double lo, Double hi) {}
}
