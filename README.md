# jev-mcp-middleware

A protocol-first MCP stdio gateway for researching semantic tool-call gating.
Connect an MCP host to the gateway instead of directly to an upstream server.
The gateway snapshots tools, validates arguments, applies hard rules, optionally
asks TypeSafe Jev for six risk signals, and makes a deterministic policy decision.

**Developer tooling and research infrastructure—not a production security boundary
or guarantee.** Jev is advisory. Model output never directly authorizes a call.

## Run locally

Requires Node.js **24** and npm. SQLite uses a native addon; systems without a
matching prebuilt binary also need Python and a C++ build toolchain.
The lockfile pins `better-sqlite3` 12.11.1: a clean Windows install of 13.0.3
attempted a native rebuild even though prebuilds were packaged. The repository
API and SQLite architecture are unchanged.

```sh
npm ci
npm run typecheck
npm run lint
npm run test:keyless
npm run build
node dist/index.js --config config/example.yaml --check-config
```

The example uses a local fake upstream and requires no API key. It exposes `echo`
with a required string `text`. Text beginning `DENY ` is denied; `REVIEW ` requires
review and is not forwarded; other text is allowed. Logs go to stderr and audit
events to `data/audit.db`. Configuration paths resolve relative to the YAML file.
`--check-config` validates configuration only; it does not probe upstream or SQLite.

For an MCP host that accepts a `mcpServers` configuration, adapt this example:

```json
{
  "mcpServers": {
    "jev-gateway": {
      "command": "node",
      "args": ["/absolute/path/jev-mcp-middleware/dist/index.js", "--config", "/absolute/path/jev-mcp-middleware/config/example.yaml"]
    }
  }
}
```

Use absolute paths and the Node 24 executable when your host has a different PATH.
Launch `node` directly, not `npm start`, in MCP host configuration: npm's command
banner can corrupt protocol stdout. Set `upstream.command`, literal `args`, `cwd`
and the environment-variable names in `envPassthrough` for your real MCP server.
The SDK also supplies its standard minimal OS environment. Upstream stderr is
discarded to avoid copying untrusted diagnostics or credentials into gateway logs.

## Policy and architecture

```text
MCP host → gateway validation → hard rules → sanitized DecisionProvider input
             → deterministic thresholds/failure policy → ALLOW → upstream
                                                      → REVIEW/DENY → local error
             → one sanitized audit event → stderr + SQLite
```

- `ALLOW` forwards the original tool name and arguments once and returns the
  upstream result unchanged. There are no gateway retries of upstream calls.
- `REVIEW` and `DENY` return an MCP tool error with correlation ID and decision
  metadata. Neither reaches upstream. There is no interactive approval UI.
- Hard rules run first. Matching rules resolve `DENY > REVIEW > ALLOW`, then source
  order. A hard ALLOW is an intentional bypass of semantic evaluation.
- Rule tool patterns and `glob` predicates support only `*` and `?`. Argument
  predicates use JSON Pointer and `exists`, `equals`, `oneOf`, or `glob`.
- Successful semantic signals are compared against configured deny thresholds,
  then review thresholds. Defaults are review `0.5`, deny `0.9`; the `humanReview`
  deny threshold is disabled. `null` disables a threshold. No match means ALLOW.
- `providerFailureOutcome` explicitly defaults to DENY and may be ALLOW or REVIEW.
  It covers timeout, unavailability and invalid provider output. ALLOW is fail-open.
  Disabled/excluded semantic evaluation uses `noProviderOutcome` (default ALLOW).
- Cancellation is never permission to forward, even with fail-open configuration.

Focused modules live in `src/mcp`, `src/policy`, `src/decision`, `src/security`,
`src/audit`, `src/config`, and `src/benchmark`. The `DecisionProvider` interface
returns only six bounded signals and typed failures. Both mock and Jev implement
it; another provider can be added without changing deterministic policy.

## Enable Jev

Copy `config/example.yaml` to an ignored local YAML file. Set:

```yaml
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
```

Keep your desired hard rules under the same `policy` block. Supply
`TYPESAFE_API_KEY` through the gateway process environment, never YAML or arguments.
Normal gateway startup rejects `provider: {type: mock}`; mocks are test/benchmark
injections only. Provider timeout is a total gateway deadline, including SDK retry
backoff; retry count defaults to zero. The SDK's body logging is explicitly off,
and its API URL is fixed to the official HTTPS endpoint.

Jev answers six narrow questions: destructive, external consequence, sensitive,
irreversible, high impact, and appropriate for human review. See the
[provider contract](specs/001-mcp-policy-gateway/contracts/decision-provider.md).

## Sanitization and audit

Provider state is allowlisted to tool name, public description and recursively
sanitized arguments. Built-in prohibited keys include credentials, authorization,
headers, cookies, environment objects and common secret-key variants. Configured
keys extend—not replace—these protections. Fixed value detectors cover bearer/basic
tokens, JWTs, common API-key formats, credential assignments, private keys and URL
credentials. Depth, string length and traversal are bounded. Original arguments
are retained only for policy checks and forwarding, never substituted with the
redacted copy upstream.

Sanitization is heuristic, not data-loss prevention: arbitrary sensitive prose,
encoded secrets and unknown token formats can evade it. Use synthetic/non-secret
data for research. Public tool metadata also needs operator review.

Each routed call gets one UUID-correlated event with validation, provider signals
when evaluated, deterministic policy, latency, and upstream outcome. SQLite is
behind a prepared-statement repository. Audit rows and logs omit upstream response
bodies and raw exceptions. A failed audit insert emits `audit_write_failed` to
stderr; it cannot undo an already executed upstream action. Secure/rotate the local
audit file yourself; benign argument content is retained after sanitization.

## Benchmarks

```sh
npm run benchmark -- --config config/example.yaml --mode no-semantic-gate
npm run benchmark -- --config config/example.yaml --mode deterministic-only
# Opt-in only: requires TYPESAFE_API_KEY; sends sanitized synthetic cases to Jev.
npm run benchmark -- --config config/example.yaml --mode jev
```

The harness runs a 12-case labelled synthetic dataset through the same router and
an in-memory official-SDK fake upstream; it does not execute real operations.
No-gate disables hard rules and providers. Deterministic-only retains configured
rules without constructing a provider. Jev retains hard rules and evaluates only
eligible cases. Programmatic `runBenchmark({mode: 'PROVIDER', provider, ...})`
supports mocks and future LLM baselines; v0.1 does not ship an LLM adapter.

Results in ignored `benchmarks/results/` contain dataset/config hashes, runtime,
case predictions, actual forwarding counts, policy accuracy, per-signal confusion
counts/precision/recall/F1, macro F1, and p50/p95/p99 latency. Signal classification
uses `0.5`, separately from policy thresholds. Undefined precision/recall/F1 is
reported as zero. Modes with no semantic predictions report `signals: {}` and
`macroF1: 0` as **not applicable**, not as measured model quality. Failed/skipped
provider cases have no signal prediction; inspect coverage and error counts before
comparing scores. `unexpectedForwarding` means forwarding against the dataset's
expected outcome, not forwarding a gateway DENY decision.

Latency is measured in rounded milliseconds without pass/fail performance gates;
fast local stages can read zero. Decision latency excludes upstream call time.
The seed is recorded; cases run in fixed file order. This tiny, hand-labelled
dataset is illustrative, not a statistically meaningful safety evaluation. No
live Jev quality result is claimed by the keyless test suite.

## Tests and Docker

Tests focus on policy/sanitization logic, one proxy integration path, representative
concurrent non-forwarding, semantic/audit behavior, a stdio subprocess path, and
benchmark calculations. Core test workers block fetch/HTTP/TCP and clear the Jev
credential. No provider call is needed for CI.

```sh
docker build -t jev-mcp-middleware:v0.1 .
docker run --rm jev-mcp-middleware:v0.1 --help
docker run --rm jev-mcp-middleware:v0.1 --config config/example.yaml --check-config
docker run --rm -i jev-mcp-middleware:v0.1
```

The last command speaks MCP over stdin/stdout. The image includes the example fake
upstream and runs as the non-root `node` user. Mount a writable `/app/data` for
persistent audit data and mount a custom config/upstream for real use. Do not use
a TTY for MCP. Use `--entrypoint node` and `dist/benchmark/runBenchmark.js` to run
the compiled benchmark in the image. GitHub Actions checks lint, typecheck, keyless
tests, build and Docker build without TypeSafe credentials.

v0.1 supports one downstream stdio session and one upstream stdio server with a
startup-only catalog snapshot. No OAuth federation, dashboard, multitenancy,
response scanning, token optimization, Redis, Kubernetes or production-security
claims. Licensed under [MIT](LICENSE).
