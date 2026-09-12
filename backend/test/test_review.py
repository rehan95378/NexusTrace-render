import os
import tempfile
import unittest

from pipeline.review import queue


class TestReviewQueue(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
        self.tmp.close()
        os.unlink(self.tmp.name)
        self.path = self.tmp.name
        queue.set_queue_path(self.path)

    def tearDown(self):
        if os.path.exists(self.path):
            os.unlink(self.path)

    def test_confident_relationship_stays_in_graph(self):
        entities = [{"text": "Farhan Sheikh", "type": "Person", "confidence": 0.9}]
        rels = [{
            "source": "Farhan Sheikh", "target": "Sunita Rane",
            "type": "FINANCIAL", "source_type": "FINANCIAL",
            "confidence": 0.85, "weight": 1, "source_doc_id": "a",
        }]
        out = queue.split(entities, rels)
        self.assertEqual(len(out["graph_entities"]), 1)
        self.assertEqual(len(out["graph_relationships"]), 1)
        self.assertEqual(out["review_items"], [])

    def test_loose_association_goes_to_review(self):
        rels = [{
            "source": "Rajesh Gupta", "target": "Kavita Sharma",
            "type": "ASSOCIATION", "source_type": "ASSOCIATION",
            "confidence": 0.4, "weight": 1, "source_doc_id": "a",
        }]
        out = queue.split([], rels)
        self.assertEqual(out["graph_relationships"], [])
        self.assertEqual(len(out["review_items"]), 1)
        self.assertEqual(out["review_items"][0]["kind"], "relationship")
        self.assertEqual(out["review_items"][0]["status"], "pending")

    def test_low_confidence_entity_goes_to_review(self):
        entities = [{"text": "Susp Acct", "type": "Organization", "confidence": 0.2}]
        out = queue.split(entities, [])
        self.assertEqual(out["graph_entities"], [])
        self.assertEqual(len(out["review_items"]), 1)
        self.assertEqual(out["review_items"][0]["kind"], "entity")

    def test_enqueue_assigns_incrementing_ids(self):
        a = queue.enqueue([{"kind": "entity", "text": "x"}])
        b = queue.enqueue([{"kind": "relationship", "text": "y -> z"}])
        self.assertNotEqual(a[0]["item_id"], b[0]["item_id"])
        self.assertEqual(len(queue.list_items()), 2)

    def test_approve_and_reject_transitions(self):
        [item] = queue.enqueue([{"kind": "entity", "text": "x", "confidence": 0.1}])
        approved = queue.resolve(item["item_id"], "approve")
        self.assertEqual(approved["status"], "approved")
        [r2] = queue.enqueue([{"kind": "relationship", "text": "a -> b", "confidence": 0.4}])
        rejected = queue.resolve(r2["item_id"], "reject")
        self.assertEqual(rejected["status"], "rejected")

    def test_resolve_unknown_returns_none(self):
        self.assertIsNone(queue.resolve(99999, "approve"))


if __name__ == "__main__":
    unittest.main()