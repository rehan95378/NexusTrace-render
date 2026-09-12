import unittest
from pathlib import Path

from pipeline.ingestion.loader import load_file, ingest_directory

SAMPLE = Path(__file__).resolve().parent.parent / "data" / "raw"


class TestIngestion(unittest.TestCase):
    def test_csv_output_contract(self):
        records = load_file(SAMPLE / "sample_cdr.csv")
        self.assertEqual(len(records), 3)
        for r in records:
            self.assertEqual(set(r.keys()), {"source_type", "raw_content", "timestamp", "source_doc_id"})
            self.assertEqual(r["source_type"], "cdr")
            self.assertTrue(r["source_doc_id"])

    def test_json_output_contract(self):
        records = load_file(SAMPLE / "sample_fir.json")
        self.assertEqual(len(records), 2)
        # assert the output contract, not a hard-coded old fixture value
        self.assertTrue(records[0]["raw_content"].strip())
        self.assertEqual(set(records[0].keys()),
                         {"source_type", "raw_content", "timestamp", "source_doc_id"})
        self.assertEqual(records[0]["source_type"], "fir")

    def test_doc_id_is_stable(self):
        a = load_file(SAMPLE / "sample_fir.json")
        b = load_file(SAMPLE / "sample_fir.json")
        self.assertEqual(a[0]["source_doc_id"], b[0]["source_doc_id"])

    def test_detects_unsupported(self):
        p = SAMPLE.parent / "README.txt"
        p.write_text("x")
        with self.assertRaises(NotImplementedError):
            load_file(p)
        p.unlink()

    def test_ingest_directory_skips_unknown(self):
        records = ingest_directory(SAMPLE)
        self.assertEqual(len(records), 5)


if __name__ == "__main__":
    unittest.main()