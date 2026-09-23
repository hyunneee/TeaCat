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

    private final ObjectMapper objectMapper;
    private final String resourcePath;
    private final boolean enabled;

    private Model model;

    public TradeRiskModelScorer(ObjectMapper objectMapper,
                                @Value("${nft.trade.review.model.enabled:true}") boolean enabled,
                                @Value("${nft.trade.review.model.resource:fds/model.json}") String resourcePath) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.resourcePath = resourcePath;
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
            log.info("이상거래 섀도우 모델 적재 version={} 피처={}개", loaded.version(), loaded.features().size());
        } catch (Exception e) {
            log.warn("이상거래 섀도우 모델을 읽지 못해 점수 없이 돕니다 resource={}", resourcePath, e);
        }
    }

    public String version() {
        return model == null ? null : model.version();
    }

    /**
     * 부정 확률 0~1. 모델이 없거나 채점이 실패하면 null.
     *
     * <p>피처가 비어 있으면(심사가 꺼져 있거나 맥락을 못 읽은 경우) 채점하지 않는다 —
     * 전부 대치값으로 채운 점수는 "모르는 것" 이지 "정상" 이 아니다.
     */
    public Double score(Map<String, Object> features) {
        if (model == null || features == null || features.isEmpty()) {
            return null;
        }
        try {
            double z = model.intercept();
            for (Feature f : model.features()) {
                double raw = numeric(features.get(f.name()), f.impute());
                double std = f.std() == null || f.std() == 0 ? 1 : f.std();
                double mean = f.mean() == null ? 0 : f.mean();
                z += f.coef() * ((raw - mean) / std);
            }
            double p = 1.0 / (1.0 + Math.exp(-z));
            // 제약(0~1)에 걸리지 않도록 부동소수 오차를 잘라 낸다
            return Math.min(1.0, Math.max(0.0, Math.round(p * 100_000) / 100_000.0));
        } catch (Exception e) {
            log.warn("이상거래 섀도우 모델 채점 실패 version={}", model.version(), e);
            return null;
        }
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
     * @param mean   학습 데이터의 평균 (표준화용)
     * @param std    학습 데이터의 표준편차. 0이면 1로 본다
     * @param impute 값이 없을 때 쓸 대치값. 학습 때의 중앙값
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Feature(String name, double coef, Double mean, Double std, Double impute) {}
}
