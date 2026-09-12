import unittest

from pipeline.resolution.resolver import resolve_entities


class TestResolution(unittest.TestCase):
    def test_dedupes_near_duplicates(self):
        records = [
            {"text": "Ramesh Kumar", "type": "Person", "confidence": 0.9,
             "method": "gazetteer", "source_doc_id": "a"},
            {"text": "Ramesh K.", "type": "Person", "confidence": 0.6,
             "method": "regex", "source_doc_id": "b"},
        ]
        out = resolve_entities(records)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["text"], "Ramesh Kumar")
        self.assertEqual(out[0]["type"], "Person")
        self.assertIn("Ramesh K.", out[0]["aliases"])
        self.assertEqual(sorted(out[0]["source_ids"]), ["a", "b"])
        # two distinct docs => backfilled confidence
        self.assertGreaterEqual(out[0]["confidence"], 0.9)

    def test_exact_duplicate_folds_and_keeps_highest_conf_text(self):
        records = [
            {"text": "Sita Devi", "type": "Person", "confidence": 0.7,
             "method": "regex", "source_doc_id": "a"},
            {"text": "Sita Devi", "type": "Person", "confidence": 0.95,
             "method": "spacy", "source_doc_id": "b"},
        ]
        out = resolve_entities(records)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["text"], "Sita Devi")
        self.assertEqual(out[0]["confidence"], 0.95)
        self.assertEqual(sorted(out[0]["source_ids"]), ["a", "b"])

    def test_never_merges_across_types(self):
        records = [
            {"text": "Ravi", "type": "Person", "confidence": 0.9,
             "method": "gazetteer", "source_doc_id": "a"},
            {"text": "Ravi", "type": "Organization", "confidence": 0.5,
             "method": "regex", "source_doc_id": "b"},
        ]
        out = resolve_entities(records)
        self.assertEqual(len(out), 2)
        self.assertEqual({r["type"] for r in out}, {"Person", "Organization"})

    def test_shared_structured_attr_forces_merge_at_low_similarity(self):
        records = [
            {"text": "Ramesh K.", "type": "Person", "confidence": 0.6,
             "method": "regex", "source_doc_id": "a", "phone": "9822001122"},
            {"text": "R K", "type": "Person", "confidence": 0.5,
             "method": "regex", "source_doc_id": "b", "phone": "9822001122"},
        ]
        out = resolve_entities(records)
        self.assertEqual(len(out), 1)

    def test_single_entity_passthrough(self):
        records = [
            {"text": "ABC Taxi", "type": "Vehicle", "confidence": 0.8,
             "method": "gazetteer", "source_doc_id": "d"},
        ]
        out = resolve_entities(records)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["text"], "ABC Taxi")
        self.assertEqual(out[0]["aliases"], [])
        self.assertEqual(out[0]["source_ids"], ["d"])
        # single doc, conf untouched
        self.assertEqual(out[0]["confidence"], 0.8)

    def test_empty_input(self):
        self.assertEqual(resolve_entities([]), [])

    def test_different_docs_bump_confidence(self):
        # even identical-text same entity across docs -> bump to 0.9
        records = [
            {"text": "Ramesh Kumar", "type": "Person", "confidence": 0.8,
             "method": "gazetteer", "source_doc_id": "x"},
            {"text": "Ramesh Kumar", "type": "Person", "confidence": 0.8,
             "method": "gazetteer", "source_doc_id": "y"},
        ]
        out = resolve_entities(records)
        self.assertEqual(len(out), 1)
        self.assertGreaterEqual(out[0]["confidence"], 0.9)


if __name__ == "__main__":
    unittest.main()