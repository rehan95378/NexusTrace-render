"""
CDR Parser - Parse tabular call detail records from text.
"""
import csv
import io


class CDRParser:
    """Parse tabular call detail records"""

    def is_tabular(self, text: str, min_rows: int = 2) -> tuple[bool, str | None]:
        """Check if text looks like tabular data"""
        lines = [l for l in text.strip().splitlines() if l.strip()]
        if len(lines) < min_rows:
            return False, None

        for delim in [",", "\t", "|", ";"]:
            counts = [line.count(delim) for line in lines]
            if counts[0] > 0 and len(set(counts)) == 1:
                return True, delim

        return False, None

    def parse_rows(self, text: str, delimiter: str) -> list[dict]:
        """Parse CDR rows from tabular text"""
        reader = csv.reader(io.StringIO(text.strip()), delimiter=delimiter)
        rows = [r for r in reader if any(cell.strip() for cell in r)]

        if not rows:
            return []

        # Detect header
        header_candidates = {
            "caller", "called", "from", "to", "a_number", "b_number",
            "number", "timestamp", "date", "duration", "time"
        }
        first_row_lower = [c.strip().lower() for c in rows[0]]
        has_header = any(cell in header_candidates for cell in first_row_lower)

        if has_header:
            col_index = {name: i for i, name in enumerate(first_row_lower)}
            caller_idx = col_index.get("caller", col_index.get("from", col_index.get("a_number", 0)))
            called_idx = col_index.get("called", col_index.get("to", col_index.get("b_number", 1)))
            ts_idx = col_index.get("timestamp", col_index.get("date", col_index.get("time")))
            dur_idx = col_index.get("duration")
            data_rows = rows[1:]
        else:
            caller_idx, called_idx, ts_idx, dur_idx = 0, 1, 2, 3
            data_rows = rows

        # Parse data rows
        parsed = []
        for row in data_rows:
            if len(row) <= max(caller_idx, called_idx):
                continue

            caller = row[caller_idx].strip()
            called = row[called_idx].strip()

            if not caller or not called:
                continue

            timestamp = row[ts_idx].strip() if ts_idx is not None and ts_idx < len(row) else None
            duration = row[dur_idx].strip() if dur_idx is not None and dur_idx < len(row) else None

            parsed.append({
                "caller": caller,
                "called": called,
                "timestamp": timestamp,
                "duration": duration
            })

        return parsed
