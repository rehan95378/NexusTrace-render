# LLM-based Extraction Module

## Purpose
This folder is a placeholder for future LLM-based extraction and relationship building.

## Planned Architecture

```
backend/services/llm/
├── __init__.py
├── llm_client.py         # LLM API client (OpenAI, Anthropic, etc.)
├── entity_extractor.py   # LLM-based entity extraction
├── relationship_extractor.py  # LLM-based relationship extraction
├── prompt_templates.py   # Prompt templates for extraction
└── pipeline.py           # LLM-based orchestration pipeline
```

## Design Goals

1. **Parallel Implementation**: Should work alongside pretrained approach
2. **API Agnostic**: Support multiple LLM providers
3. **Prompt Engineering**: Optimized prompts for entity/relationship extraction
4. **Unstructured Text**: Better handling of complex, unstructured reports
5. **Context Understanding**: Better relationship inference from context

## Implementation Notes

To implement:
1. Choose LLM provider (OpenAI GPT-4, Anthropic Claude, etc.)
2. Implement prompt templates for FIR/CDR text extraction
3. Handle rate limiting and error recovery
4. Integrate with existing Neo4j and audit systems
5. Compare accuracy with pretrained approach

## Current Status
🔴 **Not implemented yet** - Placeholder only
