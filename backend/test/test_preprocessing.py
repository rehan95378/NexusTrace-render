import unittest

from pipeline.preprocessing.cleaner import collapse_whitespace, split_sentences


class TestCollapseWhitespace(unittest.TestCase):
    def test_collapses_runs_to_single_space(self):
        self.assertEqual(
            collapse_whitespace("Shri  Ramesh    Kumar"),
            "Shri Ramesh Kumar",
        )

    def test_collapses_newlines_and_tabs(self):
        self.assertEqual(
            collapse_whitespace("He was\n\tfound\tat the spot."),
            "He was found at the spot.",
        )

    def test_strips_leading_trailing_space(self):
        self.assertEqual(collapse_whitespace("   text   "), "text")

    def test_removes_ocr_junk_keeping_intratoken_punct(self):
        self.assertEqual(
            collapse_whitespace("Rs.5000 /- and value 5.5% (nos. 45)"),
            "Rs.5000 /- and value 5.5% (nos. 45)",
        )

    def test_empty_string(self):
        self.assertEqual(collapse_whitespace(""), "")


class TestSplitSentences(unittest.TestCase):
    def test_splits_on_period(self):
        self.assertEqual(
            split_sentences("First sentence. Second sentence."),
            ["First sentence.", "Second sentence."],
        )

    def test_splits_on_question_and_exclamation(self):
        self.assertEqual(
            split_sentences("Is he there? Yes! Hurry."),
            ["Is he there?", "Yes!", "Hurry."],
        )

    def test_shri_ramesh_kumar_not_split(self):
        self.assertEqual(
            split_sentences("Shri Ramesh Kumar resides at Pune."),
            ["Shri Ramesh Kumar resides at Pune."],
        )

    def test_abbreviations_not_split(self):
        # Dr./Smt. are abbreviations: neither should split mid-word nor split
        # the single sentence apart.
        text = "Dr Sharma and Smt Ramesh Kumar reported the matter."
        self.assertEqual(split_sentences(text), [text])

    def test_multi_sentence_with_leaders(self):
        self.assertEqual(
            split_sentences("Shri Ramesh went. He returned at 5 pm."),
            ["Shri Ramesh went.", "He returned at 5 pm."],
        )

    def test_abbreviation_followed_by_capital_not_split(self):
        # "No." followed by a capital is the abbreviation "number" case and must
        # not split mid-way per spec.
        self.assertEqual(
            split_sentences("Total is No. Next line begins."),
            ["Total is No. Next line begins."],
        )

    def test_abbreviation_at_very_end_can_split(self):
        # "No." as the final token with no following capital starts a fresh
        # sentence boundary on the next punctuation.
        self.assertEqual(
            split_sentences("First sentence. No."),
            ["First sentence.", "No."],
        )

    def test_normalizes_to_single_spaces(self):
        self.assertEqual(
            split_sentences("He   was\nfound!  Go."),
            ["He was found!", "Go."],
        )

    def test_empty_string(self):
        self.assertEqual(split_sentences(""), [])


if __name__ == "__main__":
    unittest.main()