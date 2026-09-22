# YAML Configuration Contract

**Schema version**: 1

Configuration is one YAML 1.2 document parsed with bounded aliases and validated
with a strict Zod schema. Unknown keys and invalid values fail startup. The example
shows every policy-affecting default explicitly.

```yaml
version: 1

upstream:
  transport: stdio
  command: node
  args:
    - ./examples/fake-upstream/dist/index.js
  cwd: .
  envPassthrough: []
  requestTimeoutMs: 30000

provider:
  type: jev
  model: jev-latest
  timeoutMs: 3000
  retry:
    maxRetries: 0
    initialDelayMs: 500
    maxDelayMs: 5000

policy:
  noProviderOutcome: ALLOW
  providerFailureOutcome: DENY
  semanticEligibility:
    includeTools:
      - "*"
    excludeTools: []
  hardRules:
    - id: deny-shell-delete
      description: Block destructive shell deletion tools
      tool: "shell.delete_*"
      arguments: []
      outcome: DENY
  thresholds:
    review:
      destructive: 0.50
      externalConsequence: 0.50
      sensitive: 0.50
      irreversible: 0.50
      highImpact: 0.50
      humanReview: 0.50
    deny:
      destructive: 0.90
      externalConsequence: 0.90
      sensitive: 0.90
      irreversible: 0.90
      highImpact: 0.90
      humanReview: null

sanitization:
  redactKeys:
    - authorization
    - password
    - secret
    - token
    - apiKey
    - credential
  maxDepth: 20
  maxStringLength: 4096
  replacement: "[REDACTED]"

audit:
  sqlitePath: ./data/audit.db
  busyTimeoutMs: 5000

logging:
  level: info

benchmark:
  datasetPath: ./benchmarks/datasets/v0.1.jsonl
  resultsDirectory: ./benchmarks/results
  seed: 1
```

## Validation Rules

### Upstream

- `transport` is exactly `stdio` in v0.1.
- `command` is non-empty; `args` is an array of literal strings.
- `cwd` resolves from the configuration file directory and must exist.
- `envPassthrough` contains unique environment variable names. Values are read only
  when spawning upstream, never logged, audited, or added to provider input.
- `requestTimeoutMs` is an integer from 1 through 300000.

### Provider

- `type` is `none`, `mock`, `jev`, or `laya`. `mock` is rejected in normal gateway
  mode unless an explicit test/benchmark command enables it. Preserve the
  existing `none`/`mock`/`jev` YAML forms; validate Laya as a distinct strict
  variant rather than supplying Jev model/retry defaults to it.
- `jev` requires `TYPESAFE_API_KEY` at startup. The YAML file cannot contain an API
  key or arbitrary request headers.
- `timeoutMs` is 1 through 60000 for both real providers. Jev retains its `model`
  and `retry` fields. Retry counts are 0 through 5; delay values are bounded and
  the maximum cannot be lower than the initial delay. Jev SDK retry values are
  always supplied explicitly.
- Laya accepts only `type: laya`, `timeoutMs`, and optional `modelDir`, `cacheDir`,
  `subfolder`, and `revision`. Paths resolve relative to the YAML file. If
  `modelDir` is set, it names a complete local ONNX bundle and no download/cache
  selection is used; reject combining it with `cacheDir`, `subfolder`, or
  `revision`. Otherwise the package's default English bundle is used unless a
  checkpoint `subfolder` is selected; `revision` may pin a published revision for
  reproducibility. Execution defaults to CPU; arbitrary ONNX session options,
  arbitrary repository IDs, Hugging Face tokens, Jev `model`/`retry`, and any
  provider credential in YAML are unsupported.
- Laya session loading happens once before the gateway serves MCP. `timeoutMs`
  bounds each evaluation, not the potentially long initial model download/load.
  A timed-out native ONNX inference may still finish in the background because
  the package exposes no per-call cancellation. Startup failure aborts startup.
  `--check-config` validates the Laya settings without downloading or opening a
  model.

### Policy

- `noProviderOutcome` and `providerFailureOutcome` are `ALLOW`, `REVIEW`, or `DENY`.
  If `providerFailureOutcome` is omitted, normalization sets and reports `DENY`.
- Tool patterns are bounded glob strings, not regular expressions.
- Hard-rule IDs are unique. Argument predicates use RFC 6901 JSON Pointer and only
  `exists`, `equals`, `oneOf`, or `glob` operators.
- Multiple matching hard rules resolve as `DENY > REVIEW > ALLOW`, then by source
  order. The winner is included in the audit event.
- Every enabled threshold is within 0..1. A deny threshold must be greater than or
  equal to the corresponding review threshold. `null` disables that threshold.
- A tool excluded from semantic evaluation uses `noProviderOutcome` unless a hard
  rule already decided it.

### Sanitization

- Key matching is case-insensitive. Built-in prohibited keys cannot be removed by
  configuration; configured keys only extend the set.
- Maximum depth is 1 through 50 and maximum string length is 1 through 65536.
- Objects beyond bounds are replaced with the configured marker and flagged in
  sanitized metadata; they are never passed through raw.
- Secret-like values use fixed, tested detectors. User-supplied regular expressions
  are not supported in v0.1.

### Audit and Logging

- `sqlitePath` must be a file path or `:memory:` in tests. Parent creation is
  explicit at startup; failure aborts startup.
- `busyTimeoutMs` is 1 through 60000. File databases use WAL and foreign keys.
- Log level is `trace`, `debug`, `info`, `warn`, `error`, `fatal`, or `silent`.
  Normal gateway logs always go to stderr; provider SDK body logging remains off.

### Benchmark

- Benchmark paths resolve relative to the configuration file.
- The results directory must not be the audit database directory.
- `seed` is a non-negative 32-bit integer.
- Jev mode requires its credential. Laya mode requires an explicitly selected
  Laya provider and performs model loading only in an opt-in gateway/benchmark
  run. No-semantic and deterministic-only modes reject accidental provider access
  and must run without credentials, model loading, or inference.

## Secret Resolution

The only provider secret is `TYPESAFE_API_KEY`. The loader validates that it exists
when required but passes the value directly to the provider constructor without
placing it in normalized configuration. Configuration hashes replace all secret
references with their environment variable names and never hash secret values.
Laya has no gateway credential. Do not expose the package's optional Hugging Face
token setting in gateway configuration; a local `modelDir` is the offline path.

## Optional Laya Example

Replace the `provider` block above while retaining the same `policy` block:

```yaml
provider:
  type: laya
  modelDir: ./models/laya-onnx
  timeoutMs: 10000
```

Without `modelDir`, first opt-in startup may download approximately 1.7 GB into
the package cache (override with `cacheDir`); reserve roughly 2 GB-plus RAM.
Neither normal CI nor the default Docker image includes model weights.
