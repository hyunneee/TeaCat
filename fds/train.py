"""이상거래 섀도우 모델 학습 (server/AUCTION_FRAUD_DESIGN.md 14-3).

피처는 서버가 심사할 때 남긴 것을 그대로 쓴다(nft_trade_risk_features.features).
학습용 조회를 따로 짜지 않는 이유는 서빙 값과 어긋나지 않게 하기 위해서다(training-serving skew).

결과는 계수 JSON 하나다. 채점은 파이썬이 아니라 자바가 한다(TradeRiskModelScorer) —
로지스틱 회귀의 채점은 내적 한 번이라 사이드카를 띄울 이유가 없다.

    python fds/train.py --out server/src/main/resources/fds/model.json

🔴 지금 라벨은 simulation_labels.fraud, 즉 우리가 짠 대본이다. 실사용자 판정이 아니다.
   이 모델의 점수를 "실데이터 기준 정밀도" 라고 말하면 안 된다.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np
import pandas as pd

# 규칙 결과에서 나온 것은 피처로 쓰지 않는다. 넣으면 모델이 규칙을 베끼고 끝나
# "모델이 규칙보다 나은가" 라는 질문 자체가 성립하지 않는다.
EXCLUDED = {"flagged", "maxSeverity", "signals"}

QUERY = """
SELECT l.batch_id::text AS batch_id,
       l.scenario,
       l.fraud,
       f.flagged AS rule_flagged,
       f.features::text AS features
  FROM simulation_labels l
  JOIN nft_trade_risk_features f ON f.trade_id = l.trade_id
 ORDER BY l.trade_id
"""


def load(container: str, user: str, database: str) -> pd.DataFrame:
    """psql 을 통해 읽는다 — 드라이버를 설치하지 않아도 되고, 어느 기계에서나 같은 방법으로 돈다."""
    result = subprocess.run(
        ["docker", "exec", container, "psql", "-U", user, "-d", database,
         "-t", "-A", "-F", "\t", "-c", QUERY],
        capture_output=True, text=True, encoding="utf-8",
    )
    if result.returncode != 0:
        sys.exit(f"DB 조회 실패:\n{result.stderr}")

    rows = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        batch, scenario, fraud, rule_flagged, features = line.split("\t", 4)
        row = {"batch_id": batch, "scenario": scenario, "fraud": fraud == "t"}
        row.update(json.loads(features))
        row["rule_flagged"] = rule_flagged == "t"
        rows.append(row)
    if not rows:
        sys.exit("학습할 데이터가 없습니다. 시뮬레이션을 먼저 돌리세요.")
    return pd.DataFrame(rows)


def to_matrix(df: pd.DataFrame, names: list[str]) -> np.ndarray:
    """자바 쪽 numeric() 과 같은 규칙으로 숫자로 바꾼다. 여기가 어긋나면 그게 skew 다."""
    out = np.empty((len(df), len(names)), dtype=float)
    for i, name in enumerate(names):
        col = df[name] if name in df.columns else pd.Series([None] * len(df))
        out[:, i] = pd.to_numeric(col.map(lambda v: v if not isinstance(v, bool) else int(v)),
                                  errors="coerce").to_numpy(dtype=float)
    return out


def feature_names(df: pd.DataFrame) -> list[str]:
    """시뮬레이션 정답과 규칙 판정은 모델 입력에서 제외한다."""
    return sorted(c for c in df.columns
                  if c not in {"batch_id", "scenario", "fraud", "rule_flagged"} and c not in EXCLUDED)


@dataclass(frozen=True)
class Preprocessor:
    """학습 행에서만 전처리 기준을 구하고, 검증 행에는 그 기준을 적용한다."""

    names: list[str]
    keep: np.ndarray
    impute: np.ndarray
    lo: np.ndarray
    hi: np.ndarray
    mean: np.ndarray
    std: np.ndarray
    dropped: list[str]

    @classmethod
    def fit(cls, x_train: np.ndarray, names: list[str], clip_percentile: float) -> Preprocessor:
        # 검증 행의 값은 대치값·피처 선택·분위수·표준화 기준 어디에도 쓰지 않는다.
        with np.errstate(all="ignore"):
            impute = np.nanmedian(x_train, axis=0)
        impute = np.where(np.isnan(impute), 0.0, impute)
        x = np.where(np.isnan(x_train), impute, x_train)

        keep = x.std(axis=0) > 1e-9
        dropped = [name for name, selected in zip(names, keep) if not selected]
        kept_names = [name for name, selected in zip(names, keep) if selected]
        if not kept_names:
            raise ValueError("학습 가능한 피처가 없습니다.")
        x = x[:, keep]

        lo = np.percentile(x, clip_percentile, axis=0)
        hi = np.percentile(x, 100 - clip_percentile, axis=0)
        degenerate = lo >= hi
        lo = np.where(degenerate, x.min(axis=0), lo)
        hi = np.where(degenerate, x.max(axis=0), hi)
        x = np.clip(x, lo, hi)
        mean, std = x.mean(axis=0), x.std(axis=0)
        std = np.where(std < 1e-9, 1.0, std)
        return cls(kept_names, keep, impute, lo, hi, mean, std, dropped)

    def transform(self, x_raw: np.ndarray) -> tuple[np.ndarray, int]:
        x = np.where(np.isnan(x_raw), self.impute, x_raw)[:, self.keep]
        clipped_cells = int(((x < self.lo) | (x > self.hi)).sum())
        return (np.clip(x, self.lo, self.hi) - self.mean) / self.std, clipped_cells


def warn_duplicates(z: np.ndarray, names: list[str], threshold: float = 0.999) -> None:
    """거의 완전히 같이 움직이는 피처 쌍을 찾아 알린다.

    라벨 누수를 직접 잡아 주지는 않지만, 누수는 보통 "한 값이 두 군데로 새어 들어온" 모습으로
    나타나기 때문에 먼저 걸리는 그물이 된다. 계정 나이와 첫 충전 시각이 그랬다.
    """
    corr = np.corrcoef(z, rowvar=False)
    pairs = [(names[i], names[j], corr[i, j])
             for i in range(len(names)) for j in range(i + 1, len(names))
             if abs(corr[i, j]) >= threshold]
    if not pairs:
        return
    print()
    print("[WARN] 사실상 같은 피처 쌍 (상관 |r| >= %.3f)" % threshold)
    for a, b, r in pairs:
        print(f"  {a} <-> {b}  r={r:+.4f}")
    print("  둘 중 하나를 없애거나, 시뮬레이터가 같은 값을 두 번 심고 있지 않은지 보라.")


def warn_single_separators(z: np.ndarray, y: np.ndarray, scenarios: np.ndarray,
                           names: list[str], threshold: float = 0.98) -> None:
    """피처 <b>하나만으로</b> 어떤 대본이 정상과 거의 갈리는지 본다.

    🔴 이 검사가 이 파일에서 가장 값어치 있다. 합성 데이터에서 한 피처가 혼자 AUC 0.98 을 넘으면
    대개 수법을 담은 게 아니라 **대본이 남긴 흔적**이다. 실제로 세 번 당했다.

      1차: buyerAccountAgeMinutes — 사기 배우의 가입일을 대본마다 박아 둠
      2차: buyerPriorDeviceLogins — 로그인 이력을 계정 탈취 피해자에게만 심음
      3차: hasSpendHistory       — 사기 배우만 갓 만든 계정이라 거래 이력이 없음

    ⚠️ **대본별로 봐야 한다.** 전체 부정 대 정상으로 재면 놓친다 — 3차 누수는 꾸밈 세탁
       한 대본에서만 완벽하게 갈렸고(60/1630건), 전체로는 평범해 보였다. 실제로 그렇게 짰다가
       검사가 아무것도 못 잡아서 고쳤다.

    진짜 신호도 걸린다(자전 입찰의 단말 일치는 설계상 1.000 이다). 그때는 넘어가면 된다 —
    이 검사는 "보고 판단하라" 는 알림이지 실패가 아니다.
    """
    from sklearn.metrics import roc_auc_score

    normal = scenarios == "NORMAL"
    if not normal.any():
        return
    findings = []
    for scenario in sorted(set(scenarios[y == 1])):
        mask = normal | (scenarios == scenario)
        target = (scenarios[mask] == scenario).astype(int)
        if target.sum() < 5 or target.sum() == len(target):
            continue
        for i, name in enumerate(names):
            column = z[mask, i]
            if np.all(column == column[0]):
                continue
            auc = roc_auc_score(target, column)
            if max(auc, 1 - auc) >= threshold:
                findings.append((scenario, name, auc))
    if not findings:
        return
    print()
    print("[WARN] 혼자서 한 대본을 정상과 거의 가르는 피처 (단독 AUC >= %.2f)" % threshold)
    for scenario, name, auc in findings:
        print(f"  {scenario:<18} {name:<30} AUC {auc:.3f}")
    print("  대본이 남긴 흔적인지 진짜 수법인지 반드시 확인하라.")
    print("  확인법: 대본별로 그 피처의 평균을 뽑아 본다 (fds/README.md 참고)")


def main() -> None:
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import average_precision_score, roc_auc_score, confusion_matrix
    from sklearn.model_selection import StratifiedKFold

    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="server/src/main/resources/fds/model.json")
    parser.add_argument("--container", default="teacat-postgres")
    parser.add_argument("--user", default="teacat")
    parser.add_argument("--database", default="teacat")
    parser.add_argument("--C", type=float, default=0.5, help="L2 규제 역수. 표본이 적으니 세게 건다")
    parser.add_argument("--clip-percentile", type=float, default=1.0,
                        help="극단값을 자를 분위수. 1.0 이면 아래위 1%% 를 눌러 학습·서빙 모두에 적용한다")
    args = parser.parse_args()

    df = load(args.container, args.user, args.database)
    y = df["fraud"].to_numpy(dtype=int)

    names = feature_names(df)
    x_raw = to_matrix(df, names)

    # 🔴 학습 데이터로 성능을 재면 안 된다. 배치가 여럿이면 배치 단위로 갈라
    #    "다른 판에서도 통하는가" 를 본다 — 같은 판 안에서 자르면 같은 시장·같은 계정이 양쪽에 섞인다.
    batches = df["batch_id"].unique()
    if len(batches) >= 2:
        holdout = batches[-1]
        split = df["batch_id"].to_numpy() != holdout
        folds = [(np.where(split)[0], np.where(~split)[0])]
        print(f"평가: 배치 {len(batches)}개 중 마지막 판({holdout[:8]}) 을 남겨 검증")
    else:
        folds = list(StratifiedKFold(n_splits=5, shuffle=True, random_state=7).split(x_raw, y))
        print("평가: 배치가 하나뿐이라 5겹 교차검증 (배치를 더 만들면 더 정직해진다)")

    probabilities = np.zeros(len(y))
    for train_idx, test_idx in folds:
        preprocessing = Preprocessor.fit(x_raw[train_idx], names, args.clip_percentile)
        z_train, _ = preprocessing.transform(x_raw[train_idx])
        z_test, _ = preprocessing.transform(x_raw[test_idx])
        fold = LogisticRegression(C=args.C, max_iter=2000, class_weight="balanced")
        fold.fit(z_train, y[train_idx])
        probabilities[test_idx] = fold.predict_proba(z_test)[:, 1]
    evaluated = np.concatenate([test for _, test in folds])

    y_eval, p_eval = y[evaluated], probabilities[evaluated]
    pr_auc = average_precision_score(y_eval, p_eval)
    roc_auc = roc_auc_score(y_eval, p_eval)
    rule_detected = df["rule_flagged"].to_numpy(dtype=bool)[evaluated]
    model_detected = p_eval >= 0.5

    print()
    print(f"PR-AUC  {pr_auc:.3f}   ← 부정이 드무니 이쪽을 본다")
    print(f"ROC-AUC {roc_auc:.3f}")
    print(f"\n같은 검증 행 {len(evaluated)}건에서 비교 (모델 임계값 0.5, 합집합은 가상 비교)")
    for label, detected in (("규칙", rule_detected), ("모델", model_detected),
                            ("규칙 또는 모델", rule_detected | model_detected)):
        tn, fp, fn, tp = confusion_matrix(y_eval, detected.astype(int), labels=[0, 1]).ravel()
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        print(f"  {label:<10} TP {tp:<4} FN {fn:<4} FP {fp:<4} TN {tn:<4} "
              f"정밀도 {precision:.3f} 재현율 {recall:.3f}")

    print("\n대본별 규칙/모델 탐지 건수와 평균 점수")
    scored = df.iloc[evaluated].assign(score=p_eval, rule_detected=rule_detected,
                                       model_detected=model_detected)
    for scenario, group in scored.groupby("scenario"):
        print(f"  {scenario:<18} n={len(group):<4} 규칙 {group['rule_detected'].sum():<4} "
              f"모델 {group['model_detected'].sum():<4} 평균점수 {group['score'].mean():.3f}")

    # 검증 후 내보낼 모델은 전체 데이터로 전처리 기준부터 다시 학습한다.
    # 위 숫자는 이 모델이 아니라 같은 절차로 만든 모델들의 성능 추정치다.
    preprocessing = Preprocessor.fit(x_raw, names, args.clip_percentile)
    z, clipped_cells = preprocessing.transform(x_raw)
    print(f"\n전체 데이터로 최종 학습: 표본 {len(y)}건 (부정 {y.sum()} / 정상 {len(y) - y.sum()}), "
          f"피처 {len(preprocessing.names)}개")
    print(f"극단값 자름: {clipped_cells}칸 (전체 {len(y) * len(preprocessing.names)}칸의 "
          f"{clipped_cells / max(1, len(y) * len(preprocessing.names)):.1%})")
    if preprocessing.dropped:
        print(f"상수라 제외한 피처: {', '.join(preprocessing.dropped)}")
    # 이 검사는 최종 학습 데이터의 품질 경고다. 검증 배치의 성능 계산에는 쓰지 않는다.
    warn_duplicates(z, preprocessing.names)
    warn_single_separators(z, y, df["scenario"].to_numpy(), preprocessing.names)

    final = LogisticRegression(C=args.C, max_iter=2000, class_weight="balanced").fit(z, y)
    coefficients = final.coef_[0]

    model = {
        "version": f"lr-{datetime.now(timezone.utc):%Y%m%d-%H%M}",
        "type": "logistic_regression",
        "trainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "labelSource": "simulation_labels.fraud (합성 대본 — 실사용자 판정 아님)",
        "intercept": float(final.intercept_[0]),
        "features": [
            {"name": n, "coef": float(c), "mean": float(m), "std": float(s), "impute": float(i),
             "lo": float(lo_), "hi": float(hi_)}
            for n, c, m, s, i, lo_, hi_ in zip(preprocessing.names, coefficients,
                                                preprocessing.mean, preprocessing.std,
                                                preprocessing.impute[preprocessing.keep],
                                                preprocessing.lo, preprocessing.hi)
        ],
        "metrics": {"prAuc": round(float(pr_auc), 4), "rocAuc": round(float(roc_auc), 4),
                    "samples": int(len(y)), "positives": int(y.sum()),
                    "evaluatedSamples": int(len(y_eval)), "evaluatedPositives": int(y_eval.sum())},
    }

    with open(args.out, "w", encoding="utf-8") as fp:
        json.dump(model, fp, ensure_ascii=False, indent=2)
        fp.write("\n")
    print(f"\n{args.out} 에 저장 (version={model['version']})")

    print("\n영향이 큰 피처 (계수 절댓값 순)")
    for name, coef in sorted(zip(preprocessing.names, coefficients), key=lambda kv: -abs(kv[1]))[:12]:
        print(f"  {name:<32} {coef:+.3f}")


if __name__ == "__main__":
    main()
