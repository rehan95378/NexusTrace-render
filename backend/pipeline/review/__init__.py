"""Stage 8 — Review Queue.

Low-confidence entities and relationships are routed here for human review
instead of entering the main graph as verified fact. This is where the
confidence scores computed in Stages 3, 5 and 7 are actually consumed.
"""