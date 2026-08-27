# Project API documentation

- Treat the `apifox_api_docs` MCP server for Apifox project `8679942` as the source of truth for backend API paths, methods, parameters, schemas, and responses.
- Before implementing, changing, diagnosing, or reviewing code that depends on a backend API, use the Apifox MCP refresh tool first, then query the current OpenAPI document and required `$ref` resources instead of relying on memory or stale local notes.
- Never print, commit, or copy `APIFOX_ACCESS_TOKEN` into source code, documentation, logs, or responses.
- Contract approval fields must use `src/utils/approvalStatus.ts`: `0` is rejected, `1` is approved, `2` is pending review, `3` is withdrawn, and every other value is pending submission. Do not apply this mapping to APIs that explicitly define another status protocol.
