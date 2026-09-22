# Quickstart Validation Guide: MCP Policy Gateway v0.1

This guide validates the implemented gateway. It uses the mock provider and fake
upstream for the required keyless path; Jev and Laya validation are optional.

## Prerequisites

- Node.js 24 LTS and npm
- Git
- Docker only for the container validation section
- A TypeSafe API key only for the optional Jev section
- For optional Laya validation: a local ONNX bundle or first-use Hugging
  Face download (approximately 1.7 GB) and roughly 2 GB-plus available RAM

The detailed contracts are in:

- [gateway behavior](contracts/gateway-behavior.md)
- [decision provider](contracts/decision-provider.md)
- [configuration](contracts/configuration.md)
- [audit event schema](contracts/audit-event.schema.json)
- [benchmark result schema](contracts/benchmark-result.schema.json)
- [data model](data-model.md)

## 1. Install and Run Static Gates

From the repository root:

```powershell
npm ci
npm run lint
npm run typecheck
npm run build
```

Expected outcome: every command exits successfully. Dependency installation uses
the committed lockfile, and type checking emits no files.

## 2. Validate Configuration

```powershell
node dist/index.js --config config/example.yaml --check-config
```

Expected outcome: the command reports the normalized configuration ID and exits
on stderr without starting MCP or opening SQLite. It does not print environment values, the TypeSafe key, or
raw configuration content.

Negative validation:

```powershell
npm exec vitest run tests/unit/config
```

Expected outcome: representative invalid YAML, unknown keys, out-of-range settings
and embedded provider credentials fail before the gateway accepts calls.

## 3. Run the Keyless Test Suite

Ensure `TYPESAFE_API_KEY` is unset, then run:

```powershell
Remove-Item Env:TYPESAFE_API_KEY -ErrorAction SilentlyContinue
npm run test:keyless
```

Expected outcome: unit and integration suites pass without external
network access. The run includes:

- upstream catalog snapshot and schema validation;
- exact `ALLOW` forwarding and unchanged result/error return;
- hard-rule precedence;
- semantic threshold decisions from the mock provider;
- representative explicit provider failure and malformed-response behavior;
- zero upstream calls for validation denial, `REVIEW`, and `DENY`;
- nested secret removal from provider input, audit rows, and logs;
- exactly one audit event per intercepted call; and
- stdio subprocess checks proving stdout contains protocol bytes only.

## 4. Prove Representative Concurrent Non-Forwarding

```powershell
npm exec vitest run tests/integration/gateway-policy.test.ts
```

Expected outcome: the fake upstream receives zero calls for representative denied
and review-required invocations, including a small concurrent set and a provider
failure. The test fails on any upstream invocation rather than inferring safety
from the downstream response.

## 5. Validate Audit Persistence

```powershell
npm exec vitest run tests/integration/gateway-semantic-audit.test.ts
```

Expected outcome: an isolated SQLite database stores one sanitized event per call;
forbidden canary values are absent. A separate repository smoke test covers initial
schema creation, insert/read, and an observable insert failure. There is no
exhaustive WAL/reopen test matrix.

## 6. Run Keyless Benchmarks

```powershell
npm run benchmark -- --config config/example.yaml --mode no-semantic-gate
npm run benchmark -- --config config/example.yaml --mode deterministic-only
```

Expected outcome: each command writes a versioned result under
`benchmarks/results/`. Results validate against
`contracts/benchmark-result.schema.json` and identify the dataset hash,
configuration ID, runtime, seed, outcome/forwarding accuracy, error counts, and
p50/p95/p99 latency. Neither mode reads a TypeSafe credential or accesses the
network. No-provider modes report no signal predictions: `signals: {}` and
`macroF1: 0` are not-applicable placeholders, not model-quality scores. In semantic
modes, `semanticEvaluated` counts provider calls, `semanticSkipped` counts cases
without one, `semanticPredicted` counts successful signals, and `providerErrors`
counts failures. Macro F1 covers only successful predictions. The
scripted-provider integration test checks metric calculations separately.

## 7. Run the Gateway Through an MCP Host

Build the project, then configure a local MCP host to launch:

```text
node <absolute-repository-path>/dist/index.js
  --config <absolute-repository-path>/config/example.yaml
```

The host must provide the gateway process with stdin/stdout as its MCP transport.
Use Node directly, not npm, whose command banner can corrupt MCP stdout. The
sample exposes `echo`: text beginning `DENY ` is denied, `REVIEW ` requires review,
and other text is allowed.
Expected outcome:

1. The host lists the fake/configured upstream tools.
2. An allowed call returns the upstream result.
3. A denied call returns the sanitized policy result from the gateway contract.
4. A review-required call is not forwarded and explains that interactive review
   is unavailable in v0.1.
5. JSON logs appear only on stderr, and sanitized rows appear in the configured
   SQLite file.

## 8. Validate Docker Execution

```powershell
docker build --tag jev-mcp-middleware:v0.1 .
docker run --rm jev-mcp-middleware:v0.1 --help
docker run --rm jev-mcp-middleware:v0.1 --config /app/config/example.yaml --check-config
```

Expected outcome: the image builds from the lockfile, runs as a non-root user, and
validates configuration. For real gateway use, launch the image with interactive
stdin and mount the config, upstream executable/resources, and `/app/data` audit
directory explicitly. The image includes the fake upstream for the example config.

## 9. Optional Jev Validation

Use a synthetic/non-secret benchmark dataset only. In PowerShell:

```powershell
$env:TYPESAFE_API_KEY = '<temporary-key>'
npm run benchmark -- --config config/local-jev.yaml --mode jev
Remove-Item Env:TYPESAFE_API_KEY
```

Expected outcome: the result separates six semantic signal metrics from final
deterministic policy accuracy and reports provider/decision latency. Provider
requests contain only tool name, public description, and sanitized arguments. The
key does not appear in stdout, stderr, SQLite, configuration IDs, or benchmark
artifacts. Inspect coverage and error counts: hard-rule cases skip Jev and failed
provider calls have no signal prediction. The tiny synthetic dataset is research
infrastructure, not statistically meaningful security evidence.

## 10. Optional Laya Validation

Normal `npm run test:keyless` and GitHub Actions stay model-free: fake Laya
sessions exercise the adapter without Hugging Face access, weights, ONNX
inference, or a TypeSafe key. Run the following only when a local ONNX bundle is
available or an intentional first-use download is acceptable:

```powershell
# In an ignored local YAML copy, set provider.type: laya and optionally
# provider.modelDir to a complete local ONNX bundle.
npm run benchmark -- --config config/local-laya.yaml --mode laya
```

The gateway loads the model once before serving MCP; the benchmark reports
initialization/load time separately from warm provider p50/p95/p99. Check
`semanticEvaluated`, `semanticSkipped`, `semanticPredicted`, `providerErrors`, and
`contextRejected` before reading macro/per-signal F1. An over-budget state must
be reported as `PROVIDER_CONTEXT_LIMIT`, not scored as a silently truncated
prediction. Jev and Laya use the same dataset, sanitized input, six question
instructions, and policy; hard-rule short circuits remain in both modes. The
12-case synthetic dataset is only an engineering smoke test. Meaningful quality
or speed claims need a larger labelled MCP-specific dataset and repeated measured
runs later.

The default Docker image does not include model weights. To opt in inside Docker,
mount the local bundle/cache, config, and writable audit directory and allocate
sufficient memory; do not bake weights into the image.

## 11. Final Phase Gate

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
docker build --tag jev-mcp-middleware:validation .
```

All commands must pass before implementation is considered complete. Jev network
tests are separately opt-in and are not required for the core CI gate.

Phase 8 validation on 2026-09-22 used Node.js 24.21.0: lint, full typecheck,
`npm run test:keyless` (13 files, 23 tests), and build all passed. The keyless
no-semantic-gate and deterministic-only benchmark commands also completed. No
real Laya model/download benchmark or Jev network benchmark was run.
