import unittest

from pipeline.validation.metrics import compute_metrics


class TestValidationMetrics(unittest.TestCase):
    def test_empty_set_returns_zeros_no_divzero(self):
        out = compute_metrics({"sentences": []})
        self.assertEqual(out["overall_entities"]["f1"], 0.0)
        self.assertEqual(out["overall_relationships"]["f1"], 0.0)

    def test_runs_over_full_labeled_set(self):
        import json
        from pathlib import Path

        path = Path(__file__).resolve().parent.parent / "data" / "validation" / "validation_set.json"
        with open(path) as fh:
            validation_set = json.load(fh)

        out = compute_metrics(validation_set)
        n = out.get("n_sentences", 0)
        self.assertGreaterEqual(n, 25, "labeled set should be substantial")
        # The full set must include several confident financial/comm/family links,
        # so overall relationship recall should be strictly positive.
        self.assertGreater(out["overall_relationships"]["recall"], 0.0)
        # Sense-check structure
        self.assertIn("per_type_entities", out)
        self.assertIn("Person", out["per_type_entities"])

    def test_key_shape(self):
        out = compute_metrics({"sentences": [{
            "sentence": "Farhan Sheikh transferred funds to Sunita Rane at Nashik.",
            "gold_entities": [["Farhan Sheikh", "Person"], ["Sunita Rane", "Person"], ["Nashik", "Location"]],
            "gold_relationships": [["Farhan Sheikh", "Sunita Rane", "FINANCIAL"]],
        }]})
        for m in ("precision", "recall", "f1"):
            self.assertIn(m, out["overall_entities"])
            self.assertIn(m, out["overall_relationships"])


if __name__ == "__main__":
    unittest.main()