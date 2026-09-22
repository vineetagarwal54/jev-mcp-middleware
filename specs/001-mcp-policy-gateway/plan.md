# Implementation Plan: MCP Policy Gateway v0.1

**Branch**: `feat/mcp-policy-gateway-v0.1` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-mcp-policy-gateway/spec.md`

## Summary

Build a single-process Node.js 24/TypeScript MCP stdio gateway that snapshots one
upstream server's tool catalog, validates and intercepts every call, applies hard
rules before optional semantic evaluation, and lets deterministic policy alone
produce `ALLOW`, `REVIEW`, or `DENY`. Use the official split MCP TypeScript SDK v2
for both server and client roles, the official TypeSafe SDK behind a narrow
`DecisionProvider`, optional local `@receptron/laya` behind that same contract,
SQLite for local audit persistence, and a keyless fake-server test and benchmark
path. `ALLOW` forwards the original name and arguments;
`REVIEW` and `DENY` return sanitized tool errors without calling upstream.

## Technical Context

**Language/Version**: Node.js 24 LTS (`>=24 <25`), TypeScript in strict ESM
`NodeNext` mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, and `useUnknownInCatchVariables`

**Primary Dependencies**: `@modelcontextprotocol/server@2.0.0`,
`@modelcontextprotocol/client@2.0.0`, `@typesafe-ai/sdk@0.6.0`, optional
`@receptron/laya` with ONNX Runtime, Zod 4, Ajv,
`yaml` v2, Pino, and `better-sqlite3`; exact resolved versions are committed in
`package-lock.json`

**Storage**: One local SQLite database for sanitized audit events and ordered
schema migrations, accessed only through a small prepared-statement repository
layer; versioned YAML/JSON files hold benchmark datasets and outputs

**Testing**: Vitest unit, contract, integration, subprocess stdio, and benchmark
validation suites; official MCP test transports/handlers, a fake upstream server,
a mock `DecisionProvider`, temporary SQLite databases, fake timers, and fixed IDs

**Target Platform**: Cross-platform Node.js development; Linux Node 24 Debian-slim
container for reproducible execution; downstream and upstream MCP stdio in v0.1

**Project Type**: Single-package, single-process command-line middleware gateway
with no frontend, network service split, or external database

**Performance Goals**: Zero forwarding for all `DENY`/`REVIEW` conformance cases;
measure gateway-added latency for no-semantic and deterministic-only modes; report
p50/p95/p99 provider and total decision latency; separate Laya startup model load
from warm inference; report Jev/Laya macro and per-signal F1 only for successfully
predicted cases with coverage, with 0.80 treated as a research target rather than
a release gate.

**Constraints**: Hard policy always precedes semantic evaluation; semantic output
is advisory; provider state is exactly the sanitized tool name, public description,
and arguments; TypeSafe authentication is transport-only and never enters semantic
state, logs, audit rows, or configuration files; Pino writes to stderr because
stdout carries MCP; provider failure behavior is explicit and defaults to `DENY`;
all phase tests and full typecheck pass before proceeding

**Laya constraints**: Load one local model during startup before serving MCP;
the default bundle is about 1.7 GB and uses roughly 2 GB-plus memory. A local
`modelDir` permits offline startup; a cache-backed first load may download from
Hugging Face. Default CI and Docker builds never load or bundle weights. The
English checkpoint's state context is much smaller than Jev's; reject input
before the package can silently truncate it, with a typed failure and benchmark
context-rejection count.

**Scale/Scope**: One configured upstream per process, one downstream stdio session,
an initial catalog snapshot, append-oriented local audit volume, and versioned
offline benchmark datasets. No OAuth federation, frontend/dashboard, multitenancy,
dynamic catalog refresh, response scanning, Redis, external database, Kubernetes,
or production-security claim

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Gate | Design evidence | Pre-research | Post-design |
|------|-----------------|--------------|-------------|
| Semantic authority | `DecisionProvider` returns six typed probabilities/status only; `PolicyEngine` alone returns final outcomes. | PASS | PASS |
| Hard-rule precedence | Router invokes hard rules before eligibility/provider logic and short-circuits decisive rules. | PASS | PASS |
| Denial boundary | Only the `ALLOW` branch can call `UpstreamMcpClient.callTool`; fake-server tests assert zero calls for `DENY` and `REVIEW`. | PASS | PASS |
| Explicit provider failure | Timeout, transport, invalid, and partial responses normalize to typed failures consumed by configured `ALLOW`/`REVIEW`/`DENY` behavior; default is explicit `DENY`. | PASS | PASS |
| Provider abstraction | Jev, Laya, and mock implementations depend only on the focused `DecisionProvider` contract; TypeSafe/ONNX details do not enter routing or policy. | PASS | PASS |
| Keyless verification | Mock/fake Laya providers, fake MCP server, in-memory/temp SQLite, and subprocess stdio tests require no TypeSafe key, weights, or external service. | PASS | PASS |
| Data minimization | Sanitizer builds an allowlisted DTO; Zod validates the boundary; tests seed nested prohibited values and inspect provider requests and audit rows. | PASS | PASS |
| Credential boundary | Intercepted MCP auth, credentials, environment values, and configuration never reach evaluated state. The provider-owned TypeSafe key is used only by the official SDK as required transport authentication and is never exposed to the model state. | PASS | PASS |
| v0.1 scope | Design contains only proxying, policy, semantic evaluation, audit persistence/logging, tests, and benchmarking. | PASS | PASS |
| TypeScript discipline | Strict compiler flags, explicit boundary schemas/types, and focused modules separate transports, policy, provider, audit, and sanitization. | PASS | PASS |
| Phase gates | Setup, foundational, each user story, and final integration phases must run relevant tests plus `npm run typecheck` before continuation. | PASS | PASS |

No constitutional violations or justified exceptions remain after design.

## Project Structure

### Documentation (this feature)

```text
specs/001-mcp-policy-gateway/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- audit-event.schema.json
|   |-- benchmark-result.schema.json
|   |-- configuration.md
|   |-- decision-provider.md
|   `-- gateway-behavior.md
|-- checklists/
|   `-- requirements.md
`-- tasks.md                         # Generated by /speckit-tasks
```

### Source Code (repository root)

```text
src/
|-- index.ts                         # Composition root and process lifecycle
|-- config/
|   |-- schema.ts                    # Strict Zod configuration schema
|   `-- loadConfig.ts                # YAML parsing and startup validation
|-- mcp/
|   |-- gatewayServer.ts             # Low-level downstream MCP handlers
|   |-- upstreamClient.ts            # Official MCP Client wrapper
|   |-- router.ts                    # Ordered interception pipeline
|   |-- transportFactories.ts        # Official SDK stdio construction only
|   `-- toolCatalog.ts               # Snapshot and compiled schema lookup
|-- decision/
|   |-- DecisionProvider.ts
|   |-- types.ts
|   |-- riskQuestions.ts             # Exact shared IDs/instructions
|   |-- createDecisionProvider.ts    # Small async startup factory
|   |-- JevDecisionProvider.ts
|   |-- LayaDecisionProvider.ts
|   `-- MockDecisionProvider.ts
|-- policy/
|   |-- types.ts
|   |-- hardRules.ts
|   `-- policyEngine.ts
|-- security/
|   |-- sanitize.ts
|   `-- redact.ts
|-- audit/
|   |-- AuditEvent.ts
|   |-- AuditRepository.ts
|   |-- migrations.ts
|   `-- auditService.ts
|-- benchmark/
|   |-- dataset.ts
|   |-- metrics.ts
|   `-- runBenchmark.ts
`-- logging/
    `-- logger.ts                    # Pino stderr logger and redaction

tests/
|-- unit/
|   |-- config/
|   |-- decision/
|   |-- policy/
|   |-- security/
|   |-- audit/
|   `-- benchmark/
|-- contract/
|   |-- decision-provider.test.ts
|   |-- audit-event.test.ts
|   `-- gateway-results.test.ts
|-- integration/
|   |-- gateway-allow.test.ts
|   |-- gateway-non-forwarding.test.ts
|   |-- gateway-failures.test.ts
|   |-- gateway-audit.test.ts
|   `-- gateway-stdio.test.ts
`-- fixtures/
    |-- fakeMcpServer.ts
    |-- sensitiveArguments.ts
    |-- benchmarkDataset.ts
    `-- testConfig.ts

benchmarks/
|-- datasets/
|   `-- v0.1.jsonl
`-- results/                         # Generated and gitignored except examples

config/
`-- example.yaml

migrations/
`-- 001-create-audit-events.sql

.github/workflows/
`-- ci.yml

Dockerfile
.dockerignore
package.json
package-lock.json
tsconfig.json
vitest.config.ts
eslint.config.js
```

**Structure Decision**: Use one package and one process. The composition root owns
startup/shutdown; MCP modules own protocol mechanics; the router owns sequencing;
policy remains pure and deterministic; decision providers own provider transport;
security owns data minimization; audit owns the only repository layer; benchmark
code consumes public decision contracts. Official SDK transport interfaces and the
`DecisionProvider` are the only intentional swap boundaries. No service layer,
generic repository framework, dependency-injection container, or microservice is
introduced.

**Laya integration decision**: Introduce only a small async provider factory at
the composition root and benchmark entrypoint. `Laya.load()` runs once before
`serveStdio`; the loaded session is closed on shutdown. The router, policy engine,
audit flow, and `ALLOW`/`REVIEW`/`DENY` outcomes remain unchanged. The adapter
uses the model bundle's tokenizer/config for a conservative state-token preflight:
reserve the checkpoint's full question-head allowance plus four sequence markers
for each of the six fixed Noul questions (`max_len - head_max_len - 4` state
tokens), reject over-budget or uncheckable state before `systemOne`, and
report `PROVIDER_CONTEXT_LIMIT` as a provider failure. This small preflight is
necessary because the package otherwise truncates state without a truncation
flag; it is not a general tokenizer-aware preprocessing subsystem. The package
receives the original sanitized state unchanged when within budget. A fake
session/context probe is injected for keyless tests. The benchmark measures
factory load duration separately, then warm evaluations through the same router
and policy configuration used for Jev. `runBenchmark` may accept the measured
initialization duration from the opt-in CLI/factory so a fake-session test can
check reporting without loading weights. The existing provider deadline can
report a timeout, but `@receptron/laya` does not expose cancellation for an
already-running ONNX inference; the deadline must not be described as stopping
that native work.

## Complexity Tracking

No constitution violations require justification. Ajv is added only because
arbitrary upstream MCP tools advertise JSON Schema that the low-level MCP server
does not validate; it does not replace Zod for application-owned runtime data.
