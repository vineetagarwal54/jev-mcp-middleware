# MCP Gateway Behavior Contract

**Protocol**: MCP 2026-07-28 with negotiated compatibility supplied by the official
TypeScript SDK v2

**Transport in v0.1**: Downstream stdio and one upstream stdio child process

## Startup

1. Parse and validate YAML configuration.
2. Open SQLite, apply verified migrations, and prepare the audit repository.
3. Start and negotiate the upstream MCP client.
4. Retrieve the complete upstream tool list, following every cursor page.
5. Reject duplicate tool names or schemas that cannot be compiled.
6. Freeze the catalog snapshot and start the downstream stdio server.

Any failure before step 6 is a startup failure. No partially initialized gateway
accepts downstream calls.

## `tools/list`

The gateway returns the frozen upstream catalog in upstream order. For each tool,
it preserves `name`, `title`, `description`, `inputSchema`, `outputSchema`, and
`annotations` when present. The downstream server advertises
`tools.listChanged: false`; upstream catalog changes require gateway restart in
v0.1.

## `tools/call`

Every call follows one route:

```text
receive -> catalog lookup -> JSON Schema validation -> hard rules
        -> optional sanitization/provider -> deterministic policy
        -> ALLOW: upstream call -> unchanged upstream result
        -> REVIEW/DENY: sanitized local error result, no upstream call
        -> create and persist sanitized audit event
```

The official SDK owns JSON-RPC session identifiers on each side of the gateway.
The gateway preserves the downstream request/response lifecycle and correlates the
separate upstream request with an internal UUID. "Unchanged forwarding" means the
upstream receives the exact validated tool name and original argument JSON; no
sanitized copy or policy metadata is substituted.

## Policy Result for `DENY` and `REVIEW`

Both outcomes return a protocol-valid `CallToolResult` and do not call upstream:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Tool call denied by gateway policy."
    }
  ],
  "isError": true,
  "_meta": {
    "dev.jev-mcp-middleware/decision": {
      "schemaVersion": 1,
      "outcome": "DENY",
      "correlationId": "00000000-0000-4000-8000-000000000000",
      "reasonCodes": ["HARD_RULE_DENY"]
    }
  }
}
```

For `REVIEW`, `outcome` is `REVIEW`, the text is "Tool call requires human
review; interactive approval is unavailable in v0.1.", and the reason code is
review-specific. Text and reason codes are closed, sanitized values. They never
contain tool arguments, provider response text, configuration, or raw exceptions.

## Validation and Failure Results

- Unknown tools and invalid arguments return a sanitized `isError: true` result,
  produce a validation-source `DENY` audit event, and do not call the provider or
  upstream.
- Provider failures are converted to the configured policy outcome. The client
  sees only that outcome; provider error details are reduced to reason codes.
- An upstream tool error result is returned unchanged and audited as `TOOL_ERROR`.
- Upstream protocol, transport, timeout, or abort failures return a sanitized
  `isError: true` result and are audited under the corresponding category.
- Cancellation aborts pending provider/upstream work where possible, never retries
  forwarding in the gateway, and still attempts sanitized audit creation. A call
  cancelled before dispatch records `CANCELLATION` / `CALL_CANCELLED` with an
  upstream `NOT_ATTEMPTED` outcome; an aborted upstream attempt records `ABORTED`.
- Audit persistence failure is written as a sanitized operational event to stderr.
  It does not rewrite an upstream result that has already occurred.

## Non-Forwarding Invariant

The only code path with access to `UpstreamMcpClient.callTool` is the explicit
`ALLOW` branch after a `PolicyDecision` has been produced. Integration tests use a
fake upstream invocation counter and cover hard denial, semantic denial, review,
validation denial, provider failure mapped to denial/review, and a small
representative concurrent set. Every case must observe zero upstream calls.

## Stdout and Logging

Stdout contains MCP protocol bytes only. Pino JSON logs and operational failures
go to stderr. Tests fail if a subprocess writes non-protocol content to stdout.
