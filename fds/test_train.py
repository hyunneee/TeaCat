"""학습/검증 전처리 경계의 회귀 테스트."""

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
import pandas as pd

from fds.train import Preprocessor, feature_names, load, main, warn_duplicates, warn_single_separators


class PreprocessorTests(unittest.TestCase):
    def test_training_exports_model_with_cp949_output(self) -> None:
        fraud = np.array([False, True] * 15)
        data = pd.DataFrame({
            "batch_id": ["training"] * 20 + ["holdout"] * 10,
            "scenario": np.where(fraud, "CIRCULAR_RING", "NORMAL"),
            "fraud": fraud,
            "rule_flagged": [False] * 30,
            "priceRatio": np.where(fraud, 2.0, 1.0) + np.arange(30) / 100,
        })
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.json"
            output = io.TextIOWrapper(io.BytesIO(), encoding="cp949", errors="strict")
            with patch("fds.train.load", return_value=data), \
                    patch.object(sys, "argv", ["train.py", "--out", str(path)]), \
                    redirect_stdout(output):
                main()
            output.flush()
            model = json.loads(path.read_text(encoding="utf-8"))

        self.assertEqual(model["metrics"]["evaluatedSamples"], 10)
        self.assertEqual([feature["name"] for feature in model["features"]], ["priceRatio"])

    def test_diagnostic_warnings_can_be_printed_on_cp949_console(self) -> None:
        output = io.TextIOWrapper(io.BytesIO(), encoding="cp949", errors="strict")
        z = np.array([[0.0, 0.0], [0.0, 0.0], [0.0, 0.0],
                      [1.0, 1.0], [1.0, 1.0], [1.0, 1.0]])
        with redirect_stdout(output):
            warn_duplicates(z, ["signal_a", "signal_b"])
            warn_single_separators(z, np.array([0, 0, 0, 1, 1, 1]),
                                   np.array(["NORMAL"] * 3 + ["CIRCULAR_RING"] * 3),
                                   ["signal_a", "signal_b"])
        output.flush()

    def test_rule_result_is_loaded_for_comparison_but_excluded_from_features(self) -> None:
        result = SimpleNamespace(returncode=0, stderr="", stdout=(
            'batch-1\tNORMAL\tf\tf\t{"priceRatio":1.0}\n'
            'batch-1\tCIRCULAR_RING\tt\tt\t{"priceRatio":2.0}\n'))
        with patch("fds.train.subprocess.run", return_value=result):
            data = load("teacat-postgres", "teacat", "teacat")

        self.assertEqual(data["rule_flagged"].tolist(), [False, True])
        self.assertEqual(data["fraud"].tolist(), [False, True])
        self.assertEqual(feature_names(data), ["priceRatio"])

    def test_holdout_outlier_does_not_change_training_statistics_or_features(self) -> None:
        training = np.array([[1.0, 7.0], [2.0, 7.0], [3.0, 7.0], [4.0, 7.0]])
        holdout = np.array([[100_000.0, 999.0]])

        preprocessing = Preprocessor.fit(training, ["spend", "constant_in_training"], 1.0)
        z_training, _ = preprocessing.transform(training)
        z_holdout, clipped = preprocessing.transform(holdout)

        self.assertEqual(preprocessing.names, ["spend"])
        self.assertEqual(preprocessing.dropped, ["constant_in_training"])
        self.assertLess(preprocessing.hi[0], holdout[0, 0])
        self.assertEqual(clipped, 1)
        self.assertEqual(z_holdout.shape, (1, 1))
        np.testing.assert_allclose(preprocessing.transform(training)[0], z_training)

    def test_missing_value_uses_training_median_on_holdout(self) -> None:
        training = np.array([[1.0, 7.0], [3.0, np.nan], [5.0, 9.0]])
        holdout = np.array([[2.0, np.nan], [1_000.0, 9_999.0]])

        preprocessing = Preprocessor.fit(training, ["price_ratio", "spend_ratio"], 1.0)
        z_holdout, clipped = preprocessing.transform(holdout)

        self.assertEqual(preprocessing.impute[1], 8.0)
        self.assertEqual(clipped, 2)
        np.testing.assert_allclose(z_holdout[0] * preprocessing.std + preprocessing.mean,
                                   [2.0, 8.0])


if __name__ == "__main__":
    unittest.main()
