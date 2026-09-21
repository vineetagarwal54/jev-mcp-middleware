# Quickstart Validation Guide: MCP Policy Gateway v0.1

This guide validates the planned gateway after implementation. It uses the mock
provider and fake upstream for the required keyless path; Jev validation is an
optional final step.

## Prerequisites

- Node.js 24 LTS and npm
- Git
- Docker only for the container validation section
- A TypeSafe API key only for the optional Jev section

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
npm run start -- --config config/example.yaml --check-config
```

Expected outcome: the command reports the normalized configuration ID and exits
without starting MCP. It does not print environment values, the TypeSafe key, or
raw configuration content.

Negative validation:

```powershell
npm run test:unit -- tests/unit/config
```

Expected outcome: tests prove that unknown keys, unsafe YAML, invalid thresholds,
invalid hard-rule predicates, missing upstream commands, and embedded provider
credentials fail before the gateway accepts calls.

## 3. Run the Keyless Test Suite

Ensure `TYPESAFE_API_KEY` is unset, then run:

```powershell
Remove-Item Env:TYPESAFE_API_KEY -ErrorAction SilentlyContinue
npm run test:keyless
```

Expected outcome: unit, contract, and integration suites pass without external
network access. The run includes:

- upstream catalog snapshot and schema validation;
- exact `ALLOW` forwarding and unchanged result/error return;
- hard-rule precedence;
- semantic threshold decisions from the mock provider;
- explicit provider timeout, unavailable, invalid, partial, and abort behavior;
- zero upstream calls for validation denial, `REVIEW`, and `DENY`;
- nested secret removal from provider input, audit rows, and logs;
- exactly one audit event per intercepted call; and
- stdio subprocess checks proving stdout contains protocol bytes only.

## 4. Prove Non-Forwarding Under Load

```powershell
npm run test:integration -- tests/integration/gateway-non-forwarding.test.ts
```

Expected outcome: the fake upstream receives zero calls for representative denied
and review-required invocations, including a small concurrent set and a provider
failure. The test fails on any upstream invocation rather than inferring safety
from the downstream response.

## 5. Validate Audit Persistence

```powershell
npm run test:integration -- tests/integration/gateway-audit.test.ts
```

Expected outcome: a temporary file-backed SQLite database is migrated, reopened,
and queried successfully. Rows validate against
`contracts/audit-event.schema.json`; forbidden values are absent. A forced SQLite
write failure produces a sanitized stderr operational event and is not reported as
successful persistence.

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
network.

## 7. Run the Gateway Through an MCP Host

Build the project, then configure a local MCP host to launch:

```text
node <absolute-repository-path>/dist/index.js
  --config <absolute-repository-path>/config/example.yaml
```

The host must provide the gateway process with stdin/stdout as its MCP transport.
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
directory explicitly.

## 9. Optional Jev Validation

Use a synthetic/non-secret benchmark dataset only. In PowerShell:

```powershell
$env:TYPESAFE_API_KEY = '<temporary-key>'
npm run benchmark -- --config config/example.yaml --mode jev
Remove-Item Env:TYPESAFE_API_KEY
```

Expected outcome: the result separates six semantic signal metrics from final
deterministic policy accuracy and reports provider/decision latency. Provider
requests contain only tool name, public description, and sanitized arguments. The
key does not appear in stdout, stderr, SQLite, configuration IDs, or benchmark
artifacts.

## 10. Final Phase Gate

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
docker build --tag jev-mcp-middleware:validation .
```

All commands must pass before implementation is considered complete. Jev network
tests are separately opt-in and are not required for the core CI gate.
