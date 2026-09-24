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
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score, confusion_matrix
from sklearn.model_selection import StratifiedKFold

# 규칙 결과에서 나온 것은 피처로 쓰지 않는다. 넣으면 모델이 규칙을 베끼고 끝나
# "모델이 규칙보다 나은가" 라는 질문 자체가 성립하지 않는다.
EXCLUDED = {"flagged", "maxSeverity", "signals"}

QUERY = """
SELECT l.batch_id::text AS batch_id,
       l.scenario,
       l.fraud,
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
        batch, scenario, fraud, features = line.split("\t", 3)
        row = {"batch_id": batch, "scenario": scenario, "fraud": fraud == "t"}
        row.update(json.loads(features))
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
    print("⚠️  사실상 같은 피처 쌍 (상관 |r| >= %.3f)" % threshold)
    for a, b, r in pairs:
        print(f"  {a} ↔ {b}  r={r:+.4f}")
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
    print("⚠️  혼자서 한 대본을 정상과 거의 가르는 피처 (단독 AUC >= %.2f)" % threshold)
    for scenario, name, auc in findings:
        print(f"  {scenario:<18} {name:<30} AUC {auc:.3f}")
    print("  대본이 남긴 흔적인지 진짜 수법인지 반드시 확인하라.")
    print("  확인법: 대본별로 그 피처의 평균을 뽑아 본다 (fds/README.md 참고)")


def main() -> None:
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

    names = sorted(c for c in df.columns
                   if c not in {"batch_id", "scenario", "fraud"} and c not in EXCLUDED)
    x_raw = to_matrix(df, names)

    # 값이 없으면 학습 때의 중앙값으로 채운다. 그 중앙값을 모델 파일에 실어 보내야
    # 서빙 때도 같은 값으로 채울 수 있다
    impute = np.nanmedian(np.where(np.isnan(x_raw), np.nan, x_raw), axis=0)
    impute = np.where(np.isnan(impute), 0.0, impute)
    x = np.where(np.isnan(x_raw), impute, x_raw)

    # 상수 열은 버린다 — 표준편차 0이라 표준화가 안 되고, 계수도 의미가 없다
    std_all = x.std(axis=0)
    keep = std_all > 1e-9
    dropped = [n for n, k in zip(names, keep) if not k]
    names = [n for n, k in zip(names, keep) if k]
    x, impute = x[:, keep], impute[keep]

    # 🔴 극단값을 분위수로 자른 뒤에 표준화한다 (winsorize).
    #    표준화는 "평균에서 몇 칸" 이라, 학습 때 본 적 없는 크기가 들어오면 기여도가 제한 없이 커진다.
    #    실제로 dev 실거래 4건이 전부 1.000 이 나왔다 — 합성 시장의 최근 최대 지출 평균이 215 였는데
    #    실거래에 98,900 이 있었고, 그 한 피처가 z 에 +1710 을 밀어 넣었다.
    #    여기서 자른 범위를 모델 파일에 실어 보내 서빙에서도 같은 범위로 자른다. 안 그러면 그게 skew 다.
    lo = np.percentile(x, args.clip_percentile, axis=0)
    hi = np.percentile(x, 100 - args.clip_percentile, axis=0)
    # 분위수가 겹치면(대부분이 같은 값) 실제 최소·최대로 넓힌다 — 안 그러면 모든 값이 범위 밖이 된다
    degenerate = lo >= hi
    lo = np.where(degenerate, x.min(axis=0), lo)
    hi = np.where(degenerate, x.max(axis=0), hi)
    clipped_cells = int(((x < lo) | (x > hi)).sum())
    x = np.clip(x, lo, hi)

    mean, std = x.mean(axis=0), x.std(axis=0)
    std = np.where(std < 1e-9, 1.0, std)
    z = (x - mean) / std

    # 🔴 같은 값을 두 이름으로 주면 가중치만 쪼개지고, 계수를 읽을 때 사람을 헷갈리게 한다.
    #    실제로 designTradesInWindow 와 priceSamples 가 그랬고, 학습해 보고서야 드러났다
    #    (계수가 완전히 같게 나왔다). 이제는 학습 전에 잡는다.
    warn_duplicates(z, names)
    warn_single_separators(z, y, df["scenario"].to_numpy(), names)

    print(f"표본 {len(y)}건 (부정 {y.sum()} / 정상 {len(y) - y.sum()}), 피처 {len(names)}개")
    print(f"극단값 자름: {clipped_cells}칸 (전체 {len(y) * len(names)}칸의 "
          f"{clipped_cells / max(1, len(y) * len(names)):.1%})")
    if dropped:
        print(f"상수라 제외한 피처: {', '.join(dropped)}")

    # 🔴 학습 데이터로 성능을 재면 안 된다. 배치가 여럿이면 배치 단위로 갈라
    #    "다른 판에서도 통하는가" 를 본다 — 같은 판 안에서 자르면 같은 시장·같은 계정이 양쪽에 섞인다.
    batches = df["batch_id"].unique()
    if len(batches) >= 2:
        holdout = batches[-1]
        split = df["batch_id"].to_numpy() != holdout
        folds = [(np.where(split)[0], np.where(~split)[0])]
        print(f"평가: 배치 {len(batches)}개 중 마지막 판({holdout[:8]}) 을 남겨 검증")
    else:
        folds = list(StratifiedKFold(n_splits=5, shuffle=True, random_state=7).split(z, y))
        print("평가: 배치가 하나뿐이라 5겹 교차검증 (배치를 더 만들면 더 정직해진다)")

    probabilities = np.zeros(len(y))
    for train_idx, test_idx in folds:
        fold = LogisticRegression(C=args.C, max_iter=2000, class_weight="balanced")
        fold.fit(z[train_idx], y[train_idx])
        probabilities[test_idx] = fold.predict_proba(z[test_idx])[:, 1]
    evaluated = np.concatenate([test for _, test in folds])

    y_eval, p_eval = y[evaluated], probabilities[evaluated]
    pr_auc = average_precision_score(y_eval, p_eval)
    roc_auc = roc_auc_score(y_eval, p_eval)
    tn, fp, fn, tp = confusion_matrix(y_eval, (p_eval >= 0.5).astype(int), labels=[0, 1]).ravel()

    print()
    print(f"PR-AUC  {pr_auc:.3f}   ← 부정이 드무니 이쪽을 본다")
    print(f"ROC-AUC {roc_auc:.3f}")
    print(f"임계 0.5: TP {tp}  FN {fn}  FP {fp}  TN {tn}")
    if tp + fp:
        print(f"정밀도 {tp / (tp + fp):.3f}  재현율 {tp / (tp + fn):.3f}")

    print("\n대본별 평균 점수")
    scored = df.iloc[evaluated].assign(score=p_eval)
    for scenario, group in scored.groupby("scenario"):
        print(f"  {scenario:<18} n={len(group):<4} 평균 {group['score'].mean():.3f}")

    # 내보낼 모델은 전체 데이터로 다시 학습한다. 위 숫자는 이 모델이 아니라
    # 같은 절차로 만든 모델들의 성능 추정치다 — 흔히 헷갈리는 지점이라 적어 둔다.
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
            for n, c, m, s, i, lo_, hi_ in zip(names, coefficients, mean, std, impute, lo, hi)
        ],
        "metrics": {"prAuc": round(float(pr_auc), 4), "rocAuc": round(float(roc_auc), 4),
                    "samples": int(len(y)), "positives": int(y.sum())},
    }

    with open(args.out, "w", encoding="utf-8") as fp:
        json.dump(model, fp, ensure_ascii=False, indent=2)
        fp.write("\n")
    print(f"\n{args.out} 에 저장 (version={model['version']})")

    print("\n영향이 큰 피처 (계수 절댓값 순)")
    for name, coef in sorted(zip(names, coefficients), key=lambda kv: -abs(kv[1]))[:12]:
        print(f"  {name:<32} {coef:+.3f}")


if __name__ == "__main__":
    main()
