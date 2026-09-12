import unittest

from pipeline.relationships.builder import build_relationships


class TestRelationships(unittest.TestCase):
    def test_financial_trigger_relationship(self):
        sentences = ["Ramesh Kumar transferred funds to Anil Verma."]
        entities = [
            {"text": "Ramesh Kumar", "type": "Person", "confidence": 0.9,
             "method": "regex", "source_doc_id": "d1"},
            {"text": "Anil Verma", "type": "Person", "confidence": 0.9,
             "method": "regex", "source_doc_id": "d1"},
        ]
        out = build_relationships(sentences, entities, "d1")

        self.assertEqual(len(out), 1)
        rel = out[0]
        self.assertEqual(rel["source"], "Ramesh Kumar")
        self.assertEqual(rel["target"], "Anil Verma")
        self.assertEqual(rel["source_type"], "FINANCIAL")
        self.assertGreaterEqual(rel["confidence"], 0.7)
        self.assertEqual(rel["weight"], 1)
        self.assertEqual(rel["source_doc_id"], "d1")

    def test_cooccurrence_without_trigger_is_low_confidence_association(self):
        sentences = ["Ramesh Kumar and Anil Verma were seen together."]
        entities = [
            {"text": "Ramesh Kumar", "type": "Person", "confidence": 0.9,
             "method": "regex", "source_doc_id": "d1"},
            {"text": "Anil Verma", "type": "Person", "confidence": 0.9,
             "method": "regex", "source_doc_id": "d1"},
        ]
        out = build_relationships(sentences, entities, "d1")

        self.assertEqual(len(out), 1)
        rel = out[0]
        self.assertEqual(rel["source_type"], "ASSOCIATION")
        self.assertEqual(rel["confidence"], 0.4)

    def test_weight_accumulates_across_sentences(self):
        sentences = [
            "Ramesh Kumar transferred funds to Anil Verma.",
            "Ramesh Kumar transferred funds to Anil Verma again.",
        ]
        entities = [
            {"text": "Ramesh Kumar", "type": "Person", "confidence": 0.9,
             "method": "regex", "source_doc_id": "d1"},
            {"text": "Anil Verma", "type": "Person", "confidence": 0.9,
             "method": "regex", "source_doc_id": "d1"},
        ]
        out = build_relationships(sentences, entities, "d1")
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["weight"], 2)

    def test_self_pair_skipped(self):
        sentences = ["Ramesh Kumar transferred funds to Ramesh Kumar."]
        entities = [
            {"text": "Ramesh Kumar", "type": "Person", "confidence": 0.9,
             "method": "regex", "source_doc_id": "d1"},
        ]
        out = build_relationships(sentences, entities, "d1")
        self.assertEqual(out, [])

    def test_empty_input(self):
        self.assertEqual(build_relationships([], [], "d1"), [])


if __name__ == "__main__":
    unittest.main()