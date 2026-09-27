"""
Shared settings for both pretrained and LLM extraction approaches.

Only non-pattern settings (no regex patterns needed for LLM).
"""
# Shared settings (both approaches)
MAX_FILE_SIZE_MB = 10
SUPPORTED_FILE_TYPES = ["pdf", "txt", "cdr", "csv", "xlsx", "xls"]

# Neo4j settings
NEO4J_BATCH_SIZE = 1000
NEO4J_TIMEOUT_SECONDS = 30

# Fuzzy matching thresholds (shared resolution logic)
FUZZY_MATCH_THRESHOLD = 85
CROSS_CASE_FUZZY_THRESHOLD = 93
