"""
Graph builder for NexusTrace pipeline.

Handles persistence of extracted data to Neo4j using a single atomic write.
Manages the three-phase pipeline output: entities -> relationships -> events -> audit.
"""
import hashlib
from typing import Dict, List, Any
from services.common import schemas
from utils import neo4j_driver as db


class GraphBuilder:
    """Builds the Neo4j graph from pipeline output using a single atomic write"""

    def __init__(self):
        self._driver = None

    @property
    def driver(self):
        if self._driver is None:
            self._driver = db.get_driver()
        return self._driver

    def write_graph(self, case_id: str, resolved: Dict[str, Any],
                   relationships: List[schemas.Relationship],
                   cdr_calls: List[schemas.CDRCall] = None,
                   transactions: List[schemas.Transaction] = None,
                   append_mode: bool = False,
                   source_file: str = None) -> Dict[str, Any]:
        """
        Public entry point: write graph from pipeline output.

        Args:
            case_id: Case identifier
            resolved: Resolved entities from Phase 2
            relationships: Relationships from Phase 3
            cdr_calls: CDR calls from Phase 1 (optional)
            transactions: Transactions from Phase 1 (optional)
            append_mode: Whether to append or clear first

        Returns:
            Dict with statistics about what was written
        """
        # Create raw_extraction wrapper for cdr_calls and transactions
        raw_extraction = schemas.RawExtraction(
            entities={},  # Not used here, we use resolved directly
            cdr_calls=cdr_calls or [],
            transactions=transactions or [],
            source_metadata={"type": "graph_builder", "source_file": source_file}
        )
        return self._build_graph(case_id, raw_extraction, resolved, relationships, append_mode, source_file)

    def _build_graph(self, case_id: str, raw_extraction: schemas.RawExtraction,
                   resolved: Dict[str, Any], relationships: List[schemas.Relationship],
                   append_mode: bool = False, source_file: str = None) -> Dict[str, Any]:
        """
        Build the graph for a case using a single atomic write.
        """
        stats = {
            "entities": {"people": 0, "locations": 0, "organizations": 0,
                        "vehicles": 0, "phones": 0, "bank_accounts": 0},
            "relationships": 0,
            "cdr_calls": 0,
            "transactions": 0,
            "audit_logs": 0
        }

        # Helper to generate deterministic id from case + name (use readable value)
        def make_id(case_id: str, value: str) -> str:
            # Use readable value directly for consistency with edit operations
            return value

        # Create a single session for the entire operation
        with self.driver.session() as session:
            try:
                # Clear existing data if not in append mode
                if not append_mode:
                    self._clear_case_data(session, case_id)

                # Write all data in this transaction
                self._write_entities(session, case_id, resolved, stats, make_id, source_file)
                self._write_relationships(session, case_id, relationships, stats)
                self._write_cdr_calls(session, case_id, raw_extraction.cdr_calls, stats)
                self._write_transactions(session, case_id, raw_extraction.transactions, stats)
                self._write_audit_log(session, case_id, stats)

            except Exception as e:
                raise e

        return stats

    def _clear_case_data(self, session, case_id: str):
        """Clear all data for a case"""
        queries = [
            "MATCH (a:AuditLog {case_id: $case_id}) DETACH DELETE a",
            "MATCH (t:Transaction {case_id: $case_id}) DETACH DELETE t",
            "MATCH (c:CDRCall {case_id: $case_id}) DETACH DELETE c",
            "MATCH (r:Relationship {case_id: $case_id}) DETACH DELETE r",
            "MATCH (e) WHERE (e:Person OR e:Location OR e:Organization OR e:Vehicle OR e:Phone OR e:BankAccount) AND e.case_id = $case_id DETACH DELETE e"
        ]
        for query in queries:
            session.run(query, {"case_id": case_id})

    def _write_entities(self, session, case_id: str, resolved: Dict[str, Any], stats: Dict, make_id, source_file=None):
        """Write all entities to the graph with generated IDs"""
        entities = resolved.get("all_entities", resolved)

        # Source info for display
        source_info = f"File: {source_file}" if source_file else "Manual entry"

        # Write people (with id)
        for person in entities.get("people", []):
            eid = make_id(case_id, person)
            session.run(
                "MERGE (p:Person {id: $id, case_id: $case_id}) "
                "SET p.name = $name, p.source = $source",
                {"id": eid, "case_id": case_id, "name": person, "source": source_info}
            )
            stats["entities"]["people"] += 1

        # Write locations (with id)
        for location in entities.get("locations", []):
            eid = make_id(case_id, location)
            session.run(
                "MERGE (l:Location {id: $id, case_id: $case_id}) "
                "SET l.name = $name, l.source = $source",
                {"id": eid, "case_id": case_id, "name": location, "source": source_info}
            )
            stats["entities"]["locations"] += 1

        # Write organizations (with id)
        for org in entities.get("organizations", []):
            eid = make_id(case_id, org)
            session.run(
                "MERGE (o:Organization {id: $id, case_id: $case_id}) "
                "SET o.name = $name, o.source = $source",
                {"id": eid, "case_id": case_id, "name": org, "source": source_info}
            )
            stats["entities"]["organizations"] += 1

        # Write vehicles (with id) - use plate
        for vehicle in entities.get("vehicles", []):
            eid = make_id(case_id, vehicle)
            session.run(
                "MERGE (v:Vehicle {id: $id, case_id: $case_id}) "
                "SET v.plate = $plate, v.source = $source",
                {"id": eid, "case_id": case_id, "plate": vehicle, "source": source_info}
            )
            stats["entities"]["vehicles"] += 1

        # Write phones (with id) - use number
        for phone in entities.get("phones", []):
            eid = make_id(case_id, phone)
            session.run(
                "MERGE (ph:Phone {id: $id, case_id: $case_id}) "
                "SET ph.number = $number, ph.source = $source",
                {"id": eid, "case_id": case_id, "number": phone, "source": source_info}
            )
            stats["entities"]["phones"] += 1

        # Write bank accounts (with id) - use account_number
        for account in entities.get("bank_accounts", []):
            eid = make_id(case_id, account)
            session.run(
                "MERGE (ba:BankAccount {id: $id, case_id: $case_id}) "
                "SET ba.account_number = $account_number, ba.source = $source",
                {"id": eid, "case_id": case_id, "account_number": account, "source": source_info}
            )
            stats["entities"]["bank_accounts"] += 1

    def _write_relationships(self, session, case_id: str, relationships: List[schemas.Relationship], stats: Dict):
        """Write relationships using name-based MATCH"""
        for rel in relationships:
            source_label = rel.source_type or "Person"
            target_label = rel.target_type or "Person"

            source_prop = "number" if source_label == "Phone" else (
                "account_number" if source_label == "BankAccount" else
                "plate" if source_label == "Vehicle" else "name"
            )
            target_prop = "number" if target_label == "Phone" else (
                "account_number" if target_label == "BankAccount" else
                "plate" if target_label == "Vehicle" else "name"
            )

            session.run(
                f"MATCH (s:{source_label} {{{source_prop}: $source, case_id: $case_id}}),"
                f"(t:{target_label} {{{target_prop}: $target, case_id: $case_id}}) "
                f"MERGE (s)-[r:{rel.relationship_type}]->(t) "
                f"SET r.confidence = $conf, r.case_id = $case_id, r.source_sentence = $sent",
                {
                    "source": rel.source, "target": rel.target,
                    "conf": rel.confidence or 1.0,
                    "case_id": case_id,
                    "sent": rel.source_sentence,
                }
            )
            stats["relationships"] += 1

    def _write_cdr_calls(self, session, case_id: str, cdr_calls: List[schemas.CDRCall], stats: Dict):
        """Write CDR calls using phone number match"""
        for call in cdr_calls:
            session.run(
                "MATCH (caller:Phone {number: $caller, case_id: $case_id}), "
                "(called:Phone {number: $called, case_id: $case_id}) "
                "MERGE (caller)-[c:CALL_MADE]->(called) "
                "SET c.timestamp = $timestamp, c.duration = $duration, c.case_id = $case_id, c.source_sentence = $sent",
                {
                    "caller": call.caller,
                    "called": call.called,
                    "timestamp": call.timestamp,
                    "duration": call.duration,
                    "case_id": case_id,
                    "sent": call.source_sentence,
                }
            )
            stats["cdr_calls"] += 1

    def _write_transactions(self, session, case_id: str, transactions: List[schemas.Transaction], stats: Dict):
        """Write financial transactions (per-transaction, not hit-counter)"""
        for trans in transactions:
            if not trans.from_account or not trans.to_account:
                continue

            session.run(
                "MATCH (from:BankAccount {account_number: $from, case_id: $case_id}), "
                "(to:BankAccount {account_number: $to, case_id: $case_id}) "
                "MERGE (from)-[t:TRANSFERRED_TO {amount: $amount, currency: $currency}]->(to) "
                "SET t.timestamp = $timestamp, t.case_id = $case_id, t.description = $desc, t.transaction_type = $ttype",
                {
                    "from": trans.from_account,
                    "to": trans.to_account,
                    "amount": trans.amount,
                    "currency": trans.currency,
                    "timestamp": trans.timestamp,
                    "case_id": case_id,
                    "desc": trans.description,
                    "ttype": trans.transaction_type,
                }
            )
            stats["transactions"] += 1

    def _write_audit_log(self, session, case_id: str, stats: Dict):
        """Write audit log entry"""
        session.run(
            "MERGE (a:AuditLog {case_id: $case_id}) "
            "SET a.timestamp = timestamp(), a.entities_extracted = $entities_count, "
            "a.relationships_extracted = $relationships_count, a.cdr_calls = $cdr_calls_count, "
            "a.transactions = $transactions_count",
            {
                "case_id": case_id,
                "entities_count": sum(stats["entities"].values()),
                "relationships_count": stats["relationships"],
                "cdr_calls_count": stats["cdr_calls"],
                "transactions_count": stats["transactions"]
            }
        )
        stats["audit_logs"] += 1
