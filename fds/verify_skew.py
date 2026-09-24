"""자바가 찍은 점수와 파이썬이 같은 피처로 다시 계산한 점수를 대조한다.

왜 이걸 따로 보나: 학습은 파이썬이 하고 채점은 자바가 한다. 두 쪽의 전처리가
한 군데라도 어긋나면(불리언 변환, 결측 대치, 표준화) 모델은 학습 때와 다른 입력을 받는다.
이게 training-serving skew 이고, 성능이 조용히 나빠질 뿐 아무도 에러를 보지 못한다.

    python fds/verify_skew.py --model server/src/main/resources/fds/model.json
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys

import numpy as np

QUERY = """
SELECT f.trade_id, f.model_score, f.features::text
  FROM nft_trade_risk_features f
 WHERE f.model_score IS NOT NULL AND f.model_version = '%s'
 ORDER BY f.trade_id
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="server/src/main/resources/fds/model.json")
    parser.add_argument("--container", default="teacat-postgres")
    parser.add_argument("--user", default="teacat")
    parser.add_argument("--database", default="teacat")
    args = parser.parse_args()

    with open(args.model, encoding="utf-8") as fp:
        model = json.load(fp)

    result = subprocess.run(
        ["docker", "exec", args.container, "psql", "-U", args.user, "-d", args.database,
         "-t", "-A", "-F", "\t", "-c", QUERY % model["version"]],
        capture_output=True, text=True, encoding="utf-8",
    )
    if result.returncode != 0:
        sys.exit(f"DB 조회 실패:\n{result.stderr}")

    diffs, worst = [], None
    rows = 0
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        trade_id, java_score, features_json = line.split("\t", 2)
        features = json.loads(features_json)

        z = model["intercept"]
        for f in model["features"]:
            value = features.get(f["name"])
            if isinstance(value, bool):
                raw = float(value)
            elif isinstance(value, (int, float)):
                raw = float(value)
            else:
                raw = f["impute"]
            # 자바와 같은 순서로: 대치 → 자르기 → 표준화. 한 단계라도 어긋나면 그게 skew 다
            if f.get("lo") is not None:
                raw = max(f["lo"], raw)
            if f.get("hi") is not None:
                raw = min(f["hi"], raw)
            std = f["std"] or 1.0
            z += f["coef"] * ((raw - f["mean"]) / std)
        python_score = 1.0 / (1.0 + np.exp(-z))

        diff = abs(python_score - float(java_score))
        diffs.append(diff)
        if worst is None or diff > worst[1]:
            worst = (trade_id, diff, float(java_score), python_score)
        rows += 1

    if not rows:
        sys.exit(f"{model['version']} 로 채점된 행이 없습니다. 서버에 모델을 얹고 거래를 만드세요.")

    diffs = np.array(diffs)
    print(f"모델 {model['version']} · 대조 {rows}건")
    print(f"평균 차이 {diffs.mean():.8f}   최대 차이 {diffs.max():.8f}")
    print(f"가장 어긋난 거래 tradeId={worst[0]} 자바 {worst[2]:.5f} vs 파이썬 {worst[3]:.5f}")

    # 자바가 소수점 5자리에서 반올림하므로 그 한계(0.000005)보다 커지면 전처리가 다른 것이다
    if diffs.max() <= 1e-5:
        print("\n✅ skew 없음 — 차이가 자바의 반올림 한계 안이다")
    else:
        print("\n❌ 전처리가 어긋난다. 불리언 변환·결측 대치·표준화 순서를 맞춰 보라")
        sys.exit(1)


if __name__ == "__main__":
    main()
