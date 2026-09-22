# Data Model: MCP Policy Gateway v0.1

**Date**: 2026-09-20

This model distinguishes ephemeral protocol data from sanitized persistent data.
Original tool arguments exist only in the active call pipeline and are never
written to logs, audit storage, benchmark results, or provider metadata.

## Entity Relationships

```text
GatewayConfiguration
  |-- selects --> DecisionProvider
  |-- defines --> HardRule[] + PolicyThresholds
  `-- configures --> Upstream MCP connection + AuditRepository

ToolCatalogEntry -- validates --> InterceptedCall
InterceptedCall -- sanitized into --> SanitizedToolCall
SanitizedToolCall -- evaluated by --> DecisionProvider
DecisionProvider -- returns --> ProviderEvaluation
HardRule[] + ProviderEvaluation -- consumed by --> PolicyDecision
InterceptedCall + ProviderEvaluation + PolicyDecision + UpstreamOutcome
  `-- summarized as --> AuditEvent -- persisted by --> AuditRepository

BenchmarkDataset -- contains --> BenchmarkCase[]
BenchmarkCase -- produces --> BenchmarkCaseResult
BenchmarkCaseResult[] -- aggregated into --> BenchmarkRun
```

## GatewayConfiguration

Validated, immutable configuration loaded once during startup.

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `version` | literal `1` | Yes | Reject other versions. |
| `upstream` | `UpstreamConfig` | Yes | v0.1 transport is `stdio`; command must be non-empty. |
| `provider` | `ProviderConfig` | Yes | Mode is `none`, `mock`, `jev`, or `laya`; provider-specific fields are strictly separated. Jev key is referenced only by fixed environment variable name. |
| `policy` | `PolicyConfig` | Yes | Outcomes and all probability thresholds are validated. |
| `sanitization` | `SanitizationConfig` | Yes | Redaction keys and value patterns are bounded and compiled at startup. |
| `audit` | `AuditConfig` | Yes | SQLite path and bounded busy timeout are required. |
| `logging` | `LoggingConfig` | Yes | Level enum only; destination is always stderr. |
| `benchmark` | `BenchmarkConfig` | No | Paths and seed are required when benchmark commands run. |

The normalized configuration receives a SHA-256 `configurationId` computed from
non-secret canonical data. The TypeSafe API key value is never present in this
entity.

The Laya variant has a bounded evaluation timeout and optional local `modelDir`
or cache/checkpoint selection. Its ONNX session and tokenizer are startup-owned
resources, not configuration or audit data. Startup loads them before accepting
MCP requests, and shutdown closes the session. There is no Laya credential or
Jev model/retry setting in this variant.

## ToolCatalogEntry

An immutable snapshot of one upstream tool definition.

| Field | Type | Validation |
|-------|------|------------|
| `name` | string | Non-empty and unique within the snapshot. |
| `title` | string or absent | Preserved from upstream. |
| `description` | string or absent | Preserved publicly and used in sanitized provider state. |
| `inputSchema` | JSON Schema object | Must compile successfully with Ajv at startup. |
| `outputSchema` | JSON Schema object or absent | Preserved but not evaluated in v0.1. |
| `annotations` | JSON object or absent | Preserved without reinterpretation. |

The compiled validator is held beside the entry in memory and is not serialized.
Catalog order is the deterministic order returned by the fully paginated upstream
listing.

## InterceptedCall

Ephemeral representation of one downstream `tools/call` request.

| Field | Type | Validation |
|-------|------|------------|
| `correlationId` | UUID string | Generated once on receipt and unique per invocation. |
| `receivedAt` | timestamp | UTC timestamp from injected clock. |
| `toolName` | string | Must identify a catalog entry. |
| `originalArguments` | JSON object or absent | Must satisfy the tool's compiled input schema. |
| `catalogEntry` | `ToolCatalogEntry` | Required after lookup. |
| `configurationId` | string | Must identify the immutable active configuration. |

`originalArguments` may be read only by validation and the final `ALLOW` forwarding
branch. It is never passed to logging, audit persistence, or the provider.

## SanitizedToolCall

The complete semantic-provider allowlist.

| Field | Type | Validation |
|-------|------|------------|
| `toolName` | string | Copied from the validated catalog entry. |
| `toolDescription` | string or absent | Copied from public catalog metadata. |
| `arguments` | JSON object or absent | Recursively sanitized copy; no prohibited key/value survives. |

No correlation ID, MCP headers or metadata, environment value, gateway or upstream
configuration, audit context, credential, or original request object is allowed.
The complete object is validated by a strict Zod schema before provider use.

## HardRule

A deterministic operator-authored rule.

| Field | Type | Validation |
|-------|------|------------|
| `id` | string | Non-empty and unique. |
| `description` | string or absent | Operator-facing only; never sent to provider. |
| `tool` | exact name or glob string | Must compile at startup. |
| `arguments` | `ArgumentPredicate[]` | Optional; every predicate must match. |
| `outcome` | `ALLOW`, `REVIEW`, or `DENY` | Required and final when rule wins. |

An `ArgumentPredicate` selects a value by JSON Pointer and uses one bounded
operator: `exists`, `equals`, `oneOf`, or `glob`. Regular expressions and executable
expressions are excluded. If multiple rules match, outcome precedence is
`DENY > REVIEW > ALLOW`; configuration order breaks ties and the winning rule ID
is recorded.

## ProviderEvaluation

Normalized advisory output from any `DecisionProvider`.

| Field | Type | Validation |
|-------|------|------------|
| `provider` | `jev`, `laya`, `mock`, or baseline identifier | Non-empty stable identifier. |
| `status` | `SUCCESS`, `TIMEOUT`, `UNAVAILABLE`, `INVALID`, `ABORTED` | Exactly one terminal status. |
| `signals` | `RiskSignals` or absent | Present only for `SUCCESS`. |
| `latencyMs` | non-negative integer | Measured around the complete provider operation. |
| `requestId` | string or absent | Provider-generated ID; must not contain secrets. |
| `model` | string or absent | Provider-reported model identity. |
| `usage` | token counts or absent | Non-negative integers when available. |
| `reasonCode` | enum or absent | Sanitized failure category, including `PROVIDER_CONTEXT_LIMIT` for an unfit/uncheckable Laya state; never raw exception text. |

`RiskSignals` contains exactly six numbers in the inclusive range 0..1:
`destructive`, `externalConsequence`, `sensitive`, `irreversible`, `highImpact`,
and `humanReview`.

The six Noul IDs and exact instructions are one shared provider-neutral constant.
Both real adapters use the same sanitized state and map their responses to these
six fields. Laya preflights the selected checkpoint's token budget before its one
batched inference; over-limit input is a visible `INVALID` provider evaluation,
not a successful classification of an internally truncated state. Configured
provider-failure policy still owns the final outcome.

## PolicyConfig and PolicyDecision

`PolicyConfig` contains ordered hard rules, semantic eligibility tool globs,
per-signal review and deny thresholds, a no-provider default outcome, and a
provider-failure outcome. Each enabled deny threshold must be greater than or
equal to its review threshold.

`PolicyDecision` is immutable:

| Field | Type | Validation |
|-------|------|------------|
| `outcome` | `ALLOW`, `REVIEW`, or `DENY` | Exactly one final outcome. |
| `source` | `HARD_RULE`, `SEMANTIC_THRESHOLDS`, `NO_PROVIDER`, `PROVIDER_FAILURE`, `VALIDATION`, `CANCELLATION` | Required. |
| `reasonCodes` | non-empty string array | Values come from a closed, documented enum. |
| `hardRuleId` | string or absent | Required when source is `HARD_RULE`. |
| `failureBehavior` | outcome or absent | Required when source is `PROVIDER_FAILURE`. |
| `policyLatencyMs` | non-negative integer | Excludes provider and upstream latency. |
| `configurationId` | string | Required. |

Deterministic evaluation order is:

1. A validation failure returns `DENY` without provider or upstream work.
2. Matching hard rules resolve by fixed precedence and return their outcome.
3. Ineligible or disabled semantic evaluation returns the configured no-provider
   default.
4. A provider failure returns the configured provider-failure outcome.
5. Any successful signal meeting an enabled deny threshold returns `DENY`.
6. Otherwise, any signal meeting an enabled review threshold returns `REVIEW`.
7. Otherwise, return `ALLOW`.

## UpstreamOutcome

| Field | Type | Validation |
|-------|------|------------|
| `status` | `NOT_ATTEMPTED`, `SUCCESS`, `TOOL_ERROR`, `PROTOCOL_ERROR`, `TRANSPORT_ERROR`, `ABORTED` | `NOT_ATTEMPTED` is mandatory for `DENY` and `REVIEW`. |
| `latencyMs` | non-negative integer or absent | Present only if dispatch was attempted. |
| `reasonCode` | enum or absent | Sanitized category only. |

The upstream response body is never persisted. On `ALLOW`, it remains ephemeral
and is returned unchanged to the downstream host.

## AuditEvent

Canonical sanitized event created exactly once per intercepted call.

| Field | Type | Required |
|-------|------|----------|
| `schemaVersion` | literal `1` | Yes |
| `eventId` | UUID string | Yes |
| `correlationId` | UUID string | Yes |
| `occurredAt` | UTC timestamp | Yes |
| `toolName` | string | Yes |
| `sanitizedArguments` | JSON object or absent | No |
| `validationStatus` | enum | Yes |
| `providerEvaluation` | sanitized summary or absent | No |
| `policyDecision` | sanitized `PolicyDecision` | Yes |
| `upstreamOutcome` | `UpstreamOutcome` | Yes |
| `totalLatencyMs` | non-negative integer | Yes |
| `configurationId` | string | Yes |

The event schema rejects unknown fields. It cannot contain original arguments,
raw errors, response bodies, headers, environment values, credentials, or raw
configuration. SQLite stores JSON subobjects as canonical JSON text.

### SQLite `audit_events` mapping

| Column | SQLite type | Constraint |
|--------|-------------|------------|
| `event_id` | TEXT | PRIMARY KEY |
| `correlation_id` | TEXT | NOT NULL, UNIQUE |
| `occurred_at` | TEXT | NOT NULL, ISO-8601 UTC |
| `tool_name` | TEXT | NOT NULL |
| `sanitized_arguments_json` | TEXT | nullable, valid canonical JSON |
| `validation_status` | TEXT | NOT NULL, checked enum |
| `provider_json` | TEXT | nullable, valid canonical JSON |
| `policy_json` | TEXT | NOT NULL, valid canonical JSON |
| `upstream_json` | TEXT | NOT NULL, valid canonical JSON |
| `total_latency_ms` | INTEGER | NOT NULL, non-negative |
| `configuration_id` | TEXT | NOT NULL |
| `schema_version` | INTEGER | NOT NULL, equals 1 |

Indexes cover `occurred_at`, `correlation_id`, `tool_name`, and policy outcome.
Migration metadata is held in `schema_migrations(version, name, checksum,
applied_at)`.

## BenchmarkCase and BenchmarkRun

`BenchmarkCase` contains a stable case ID, dataset version, public tool definition,
sanitized arguments, expected six boolean labels, expected final outcome where
defined, and tags. Dataset validation rejects secrets, duplicate IDs, missing
labels, and categories without enough positive/negative examples.

`BenchmarkCaseResult` contains case ID, mode, provider evaluation or absence,
policy decision, expected values, forwarding result, per-stage latency, and a
sanitized error category.

`BenchmarkRun` contains:

- schema, dataset, configuration, provider, runtime, and run identifiers;
- start/end timestamps and deterministic seed;
- aggregate case/error/forwarding counts;
- per-signal confusion matrix, precision, recall, and F1;
- macro F1 across the six signals;
- final policy accuracy; and
- p50, p95, and p99 provider and total decision latency.
- for Laya, startup model initialization/load time apart from warm per-case
  provider latency, plus a count of context-limit rejections (case results carry
  `PROVIDER_CONTEXT_LIMIT`).

Semantic coverage distinguishes cases skipped before provider evaluation,
provider evaluations that returned no signals, and successful predictions.
Macro/per-signal F1 uses only successful predictions; policy accuracy uses the
full dataset. The 12 synthetic cases are a smoke/engineering dataset, not
evidence that one provider is better or faster.

Benchmark artifacts contain no TypeSafe key, raw environment, headers, original
unsanitized calls, or provider request bodies.

## Call State Transitions

```text
RECEIVED
  -> VALIDATION_DENIED -> POLICY_DECIDED(DENY)
  -> VALIDATED
       -> HARD_RULE_DECIDED(ALLOW|REVIEW|DENY)
       -> PROVIDER_SKIPPED -> POLICY_DECIDED(default)
       -> PROVIDER_PENDING
            -> PROVIDER_SUCCEEDED -> POLICY_DECIDED(thresholds)
            -> PROVIDER_FAILED -> POLICY_DECIDED(configured failure outcome)

POLICY_DECIDED(ALLOW) -> UPSTREAM_PENDING
  -> UPSTREAM_SUCCESS|TOOL_ERROR|PROTOCOL_ERROR|TRANSPORT_ERROR|ABORTED
POLICY_DECIDED(REVIEW|DENY) -> UPSTREAM_NOT_ATTEMPTED

Every terminal path -> AUDIT_CREATED -> AUDIT_PERSISTED|AUDIT_PERSIST_FAILED
```

No transition from `REVIEW`, `DENY`, or validation denial reaches
`UPSTREAM_PENDING`. Audit persistence failure is emitted as a sanitized Pino
operational error and never rewritten as successful persistence.
Cancellation before dispatch records a cancellation-source `DENY` with upstream
`NOT_ATTEMPTED`; it does not represent invalid arguments or provider failure.
