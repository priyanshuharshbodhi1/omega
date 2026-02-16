# Antigravity Workspace Rules

Project: Zapfeed / Elastic Agent Implementation

---

## Core Engineering Rule

After every implementation step, ALWAYS:

1. Test the feature using `curl` (or appropriate API call).
2. Check terminal/server logs for:
   - Errors
   - Warnings
   - Unexpected behavior
3. Confirm expected response format.
4. Validate edge cases if applicable.

No feature is considered complete without runtime verification.

---

## Validation Checklist (Mandatory After Every Change)

- [ ] Endpoint responds successfully (HTTP 200 or expected status)
- [ ] Response structure matches specification
- [ ] No errors in terminal logs
- [ ] No unexpected latency spikes
- [ ] Feature works with real input data

---

## Engineering Principle

"Build → Test with curl → Inspect logs → Fix → Re-test"

Never assume correctness without runtime validation.

---

## Scope

This rule applies to:

- Agent Builder changes
- Elasticsearch mappings
- Vector search implementation
- LLM integration (Groq / Gemini / etc.)
- RAG pipelines
- Prompt updates affecting behavior
- Deployment configurations

---

End of Rule File
