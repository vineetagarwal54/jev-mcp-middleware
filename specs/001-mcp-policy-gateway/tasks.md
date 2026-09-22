# Tasks: MCP Policy Gateway v0.1

**Input**: Design artifacts in `specs/001-mcp-policy-gateway/`

**Goal**: Deliver a real, portfolio-quality v0.1 in a few focused coding sessions.
Tests concentrate on observable behavior and critical boundaries rather than
duplicating third-party SDK or implementation-detail coverage.

**Phase gate**: Every phase must pass its relevant tests and full TypeScript
typecheck before the next phase begins.

## Phase 1: Setup

**Purpose**: Establish a strict, reproducible single-package TypeScript project.

- [X] T001 Initialize Node.js 24 ESM dependencies, scripts, package metadata, and the lockfile in `package.json` and `package-lock.json`
- [X] T002 [P] Configure strict `NodeNext` TypeScript and focused lint rules in `tsconfig.json` and `eslint.config.js`
- [X] T003 [P] Configure Vitest for unit and integration suites in `vitest.config.ts`
- [X] T004 [P] Ignore build output, local YAML, SQLite files, benchmark results, coverage, and secrets in `.gitignore`
- [X] T005 Run install, lint, typecheck, test discovery, and build scripts from `package.json`; fix all setup failures before Phase 2

**Checkpoint**: The empty project builds and all static gates pass.

---

## Phase 2: Foundation

**Purpose**: Add only the shared boundaries needed by every user story.

### Tests First

- [X] T006 [P] Write focused tests for valid/invalid YAML configuration and scripted MockDecisionProvider behavior in `tests/unit/config/config.test.ts` and `tests/unit/decision/MockDecisionProvider.test.ts`
- [X] T007 [P] Write a SQLite repository smoke test covering migration, one insert, one read, and an observable insert failure in `tests/unit/audit/AuditRepository.test.ts`

### Shared Implementation

- [X] T008 Implement strict Zod configuration parsing, explicit failure defaults, non-secret environment resolution, and the sample YAML in `src/config/schema.ts`, `src/config/loadConfig.ts`, and `config/example.yaml`
- [X] T009 [P] Define provider inputs, six advisory signals, provider failures, the DecisionProvider interface, and a scripted MockDecisionProvider in `src/decision/types.ts`, `src/decision/DecisionProvider.ts`, and `src/decision/MockDecisionProvider.ts`
- [X] T010 [P] Configure Pino JSON logging to stderr with correlation IDs and basic credential-field removal in `src/logging/logger.ts`
- [X] T011 Implement one initial SQLite audit table, a small prepared-statement repository, and basic audit event/service types in `migrations/001-create-audit-events.sql`, `src/audit/AuditRepository.ts`, `src/audit/AuditEvent.ts`, and `src/audit/auditService.ts`
- [X] T012 [P] Implement a fake official-SDK upstream MCP server with a fixed tool catalog, invocation counter, configurable result, and configurable error in `tests/fixtures/fakeMcpServer.ts`
- [X] T013 Run the foundation tests, lint, and full typecheck through `package.json`; fix all failures before Phase 3

**Checkpoint**: Configuration, mock decisions, audit persistence, logging, and the
fake upstream work without TypeSafe credentials.

---

## Phase 3: User Story 1 - Transparent MCP Proxy (Priority: P1)

**Goal**: An MCP host can list upstream tools and an allowed call is forwarded
once with unchanged tool name, arguments, and result.

**Independent Test**: Connect a test MCP client to the gateway and fake upstream,
list tools, make a valid call, and verify one identical upstream invocation and the
unchanged result; also reject one representative invalid argument payload.

### Tests for User Story 1

- [X] T014 [US1] Write one high-value proxy integration test for `tools/list`, allowed `tools/call`, unchanged results, upstream errors, and basic argument validation in `tests/integration/gateway-proxy.test.ts`
- [X] T015 [P] [US1] Write one end-to-end subprocess stdio test proving host-to-gateway-to-upstream flow and protocol-only stdout in `tests/integration/gateway-stdio.test.ts`

### Implementation for User Story 1

- [X] T016 [US1] Construct official SDK stdio transports and implement upstream connect, list, call, and close behavior in `src/mcp/transportFactories.ts` and `src/mcp/upstreamClient.ts`
- [X] T017 [P] [US1] Snapshot the upstream catalog and compile basic Ajv argument validators in `src/mcp/toolCatalog.ts`
- [X] T018 [US1] Implement the initial validated ALLOW route and upstream outcome capture in `src/mcp/router.ts`
- [X] T019 [US1] Expose low-level `tools/list` and `tools/call` handlers while preserving upstream results in `src/mcp/gatewayServer.ts`
- [X] T020 [US1] Compose configuration, logging, audit persistence, upstream client, router, stdio server, and shutdown handling in `src/index.ts`
- [X] T021 [US1] Run the proxy and stdio integration tests plus lint and full typecheck through `package.json`; fix all failures before Phase 4

**Checkpoint**: A real transparent MCP proxy works end to end.

---

## Phase 4: User Story 2 - Deterministic Policy and Non-Forwarding (Priority: P1)

**Goal**: Deterministic code owns `ALLOW`, `REVIEW`, and `DENY`; hard rules win;
provider failure is explicit; `REVIEW` and `DENY` never reach upstream.

**Independent Test**: Exercise representative hard-rule, semantic-threshold, and
provider-failure decisions with a mock provider, then verify the fake upstream sees
zero reviewed/denied calls, including a small concurrent set.

### Tests for User Story 2

- [X] T022 [P] [US2] Write focused pure unit tests for hard-rule precedence, semantic thresholds, all three outcomes, and configured provider-failure behavior in `tests/unit/policy/policyEngine.test.ts`
- [X] T023 [US2] Write one zero-forwarding integration test covering hard DENY, semantic DENY, REVIEW, one provider failure, ALLOW control, and representative concurrent calls in `tests/integration/gateway-policy.test.ts`

### Implementation for User Story 2

- [X] T024 [US2] Define policy inputs, outcomes, reason codes, and simple deterministic hard-rule matching in `src/policy/types.ts` and `src/policy/hardRules.ts`
- [X] T025 [US2] Implement hard-rule precedence, semantic thresholds, eligibility, and explicit provider-failure outcomes in `src/policy/policyEngine.ts`
- [X] T026 [P] [US2] Implement sanitized protocol-compatible validation, REVIEW, DENY, provider-failure, and upstream-failure results in `src/mcp/errors.ts`
- [X] T027 [US2] Enforce routing order so only an explicit ALLOW decision can invoke upstream in `src/mcp/router.ts`
- [X] T028 [US2] Return contract-compliant REVIEW and DENY results from the downstream handler in `src/mcp/gatewayServer.ts`
- [X] T029 [US2] Run policy unit tests, the zero-forwarding integration test, prior proxy tests, lint, and full typecheck through `package.json`; fix all failures before Phase 5

**Checkpoint**: ALLOW, REVIEW, and DENY are proven, and REVIEW/DENY have a strong
fake-upstream non-forwarding test.

---

## Phase 5: User Story 3 - Jev, Sanitization, and Audit (Priority: P1)

**Goal**: Jev supplies advisory signals through the DecisionProvider contract;
obvious sensitive data is removed before provider calls and audit persistence.

**Independent Test**: Run representative benign and nested-secret calls with the
mock provider, capture its input and SQLite audit rows, and verify sanitized input,
deterministic final decisions, one audit event per call, and keyless execution.

### Tests for User Story 3

- [X] T030 [P] [US3] Write pure unit tests for recursive sensitive-key redaction, common credential-value redaction, benign-value preservation, and immutability in `tests/unit/security/sanitize.test.ts`
- [X] T031 [US3] Write one integration test covering sanitized mock-provider input, advisory signals, explicit provider failure, and sanitized SQLite audit events in `tests/integration/gateway-semantic-audit.test.ts`
- [X] T032 [P] [US3] Write a focused Jev adapter test for six-signal mapping, malformed-response rejection, and sanitized request state using an injected fake TypeSafe client in `tests/unit/decision/JevDecisionProvider.test.ts`

### Implementation for User Story 3

- [X] T033 [US3] Implement bounded recursive redaction and the allowlisted provider DTO in `src/security/redact.ts` and `src/security/sanitize.ts`
- [X] T034 [US3] Implement JevDecisionProvider with the official TypeSafe SDK, six narrow questions, explicit timeout/retry settings, disabled body logging, and normalized failures in `src/decision/JevDecisionProvider.ts`
- [X] T035 [P] [US3] Complete sanitized audit fields for provider result, policy result, latency, and upstream outcome in `src/audit/AuditEvent.ts` and `src/audit/auditService.ts`
- [X] T036 [US3] Integrate provider selection, TypeSafe key handling, sanitization, deterministic policy, and exactly one audit attempt into `src/config/loadConfig.ts`, `src/mcp/router.ts`, and `src/index.ts`
- [X] T037 [US3] Add and run a network-free keyless suite covering all core tests, then pass lint and full typecheck through `package.json`

**Checkpoint**: The minimum v0.1 gateway core is complete and fully testable
without a TypeSafe API key.

---

## Phase 6: User Story 4 - Comparative Benchmark (Priority: P2)

**Goal**: Run a small labelled dataset through no semantic gate, deterministic
policy, Jev, and an optional compatible provider while reporting quality and
latency separately from final policy outcomes.

**Independent Test**: Run keyless modes on the same fixed dataset and verify the
report includes predictions, final outcomes, precision, recall, F1, and latency;
Jev remains an opt-in run using the same provider contract.

### Tests for User Story 4

- [X] T038 [P] [US4] Write pure unit tests for confusion counts, precision, recall, F1, macro F1, and latency percentile calculations in `tests/unit/benchmark/metrics.test.ts`
- [X] T039 [US4] Write one benchmark integration test comparing no-gate, deterministic-only, and scripted-provider modes on the same dataset without network access in `tests/integration/benchmark.test.ts`

### Implementation for User Story 4

- [X] T040 [US4] Implement simple validated dataset loading and add a small synthetic labelled corpus with positive and negative examples for each signal in `src/benchmark/dataset.ts` and `benchmarks/datasets/v0.1.jsonl`
- [X] T041 [P] [US4] Implement precision, recall, F1, macro F1, decision accuracy, forwarding counts, and p50/p95/p99 latency summaries in `src/benchmark/metrics.ts`
- [X] T042 [US4] Implement benchmark mode selection, shared DecisionProvider execution, result output, Jev opt-in, and an optional provider slot in `src/benchmark/runBenchmark.ts` and `package.json`
- [X] T043 [US4] Run the keyless benchmark test and modes plus lint and full typecheck through `package.json`; record Jev quality as a research result rather than a release gate

**Checkpoint**: The project produces a useful, reproducible comparison without
turning the benchmark harness into a second product.

---

## Phase 7: Portfolio and Release Polish

**Purpose**: Make the working v0.1 easy to understand, verify, and run.

- [X] T044 [P] Document setup, MCP-host configuration, policy semantics, failure behavior, secret handling, audit output, benchmarks, limitations, and the research-only disclaimer in `README.md` and add the chosen license in `LICENSE`
- [X] T045 [P] Add a minimal GitHub Actions workflow for lockfile install, lint, typecheck, keyless tests, and build in `.github/workflows/ci.yml`
- [X] T046 [P] Add a straightforward Node 24 multi-stage image and build exclusions in `Dockerfile` and `.dockerignore`
- [X] T047 Execute the documented keyless quickstart, build the Docker image, run all tests/lint/typecheck/build, and correct only inaccurate validation instructions in `specs/001-mcp-policy-gateway/quickstart.md`, `package.json`, and `Dockerfile`

**Checkpoint**: v0.1 is working, documented, reproducible, and suitable for a
public GitHub portfolio without making production-security claims.

---

## Phase 8: User Story 5 - Optional Local Laya Provider (Priority: P2)

**Goal**: Add Laya through the existing advisory provider contract without
changing router or policy authority. Real model loading is opt-in; CI stays
model-free. This phase extends the completed 47-task v0.1 baseline.

**Independent Test**: Inject a fake Laya session/context probe, verify one
six-question call and shared Jev wording, then run representative gateway calls
and the same labelled benchmark through scripted providers. Neither fake path
downloads weights or executes ONNX.

### Tests First

- [ ] T048 [US5] Add focused fake-session Laya adapter tests for one batched six-Noul call, shared exact question instructions, bounded signal mapping, and invalid/over-context failure in `tests/unit/decision/LayaDecisionProvider.test.ts`; keep these tests weight-free
- [ ] T049 [US5] Extend one existing gateway policy integration test with a fake Laya provider proving deterministic hard-rule precedence and zero upstream calls for `REVIEW`/`DENY` in `tests/integration/gateway-policy.test.ts`
- [ ] T050 [US5] Extend the existing benchmark integration test with scripted Jev/Laya-equivalent providers to verify identical cases/policy, semantic coverage, context-error visibility, and separate initialization latency in `tests/integration/benchmark.test.ts`

### Implementation and Documentation

- [ ] T051 [US5] Pin `@receptron/laya` (and its tokenizer package as a direct dependency only if the context preflight imports it) in `package.json`/`package-lock.json`; add the distinct strict `laya` provider configuration variant plus path resolution/validation in `src/config/schema.ts` and `src/config/loadConfig.ts`, preserving existing provider config behavior
- [ ] T052 [US5] Extract the six existing Jev question IDs and unchanged instruction strings into `src/decision/riskQuestions.ts`; make Jev consume the shared definition without changing its request state or answer mapping
- [ ] T053 [US5] Implement `LayaDecisionProvider` with one loaded reusable session, one six-question `systemOne` call, normalized `ProviderEvaluation`, and a conservative tokenizer/config preflight that returns `PROVIDER_CONTEXT_LIMIT` before inference instead of allowing silent state truncation in `src/decision/LayaDecisionProvider.ts` and `src/decision/types.ts`
- [ ] T054 [US5] Add a small async provider factory and startup/shutdown wiring so Laya loads once before `serveStdio`, startup load failure aborts service, and sessions close cleanly; keep the router and policy engine unchanged in `src/decision/createDecisionProvider.ts` and `src/index.ts`
- [ ] T055 [US5] Add opt-in `LAYA` benchmark mode and CLI selection, reuse the identical dataset/sanitizer/policy/questions, measure model initialization separately from warm provider p50/p95/p99, and report coverage/provider/context errors and policy/macro/per-signal quality in `src/benchmark/runBenchmark.ts`
- [ ] T056 [US5] Update `README.md` with opt-in Laya startup/benchmark instructions, local model/cache and memory needs, context-rejection behavior, model-free CI/default Docker image, and the synthetic-dataset limitation; do not bundle weights or add GPU infrastructure
- [ ] T057 [US5] Run lint, full typecheck, `npm run test:keyless`, and build; confirm no model download/Hugging Face/ONNX call in CI, document real Laya smoke execution as optional only, and record validation results in `specs/001-mcp-policy-gateway/quickstart.md`

**Checkpoint**: Jev and Laya remain advisory alternatives with one shared semantic
question contract; deterministic policy and non-forwarding remain unchanged.

---

## Dependencies & Execution Order

```text
Setup -> Foundation -> US1 Proxy -> US2 Policy -> US3 Jev/Audit -> US4 Benchmark
                                                               -> Release Polish
                                                               -> US5 Local Laya
```

- US1 establishes the real MCP path.
- US2 closes that path with deterministic decisions and the non-forwarding guard.
- US3 adds sanitized semantic evaluation and complete audit events.
- US4 reuses the DecisionProvider and policy boundaries; it does not add a second
  decision architecture.
- Release polish follows the working core; README, CI, and Docker tasks can proceed
  in parallel after command names stabilize.
- US5 follows the completed v0.1 core. Its adapter/config/factory/benchmark work
  reuses existing boundaries; tests remain model-free by default.

## Parallel Opportunities

- T002-T004 can run in parallel after package initialization.
- T006-T007 can be written in parallel; T009, T010, and T012 touch independent
  foundation modules.
- US1 stdio testing T015 and catalog work T017 can proceed alongside the main proxy
  integration path after the official SDK setup exists.
- US2 policy tests T022 and sanitized result mapping T026 are independent before
  router integration.
- US3 sanitizer tests T030, Jev adapter tests T032, and audit work T035 can proceed
  in parallel before T036 integrates them.
- US4 metric work T038/T041 can proceed alongside dataset and harness work T039/T040.
- README/license, CI, and Docker tasks T044-T046 can run in parallel.
- US5 test design T048-T050 may proceed together; shared questions T052 and
  configuration T051 precede adapter/factory integration T053-T055.

## Implementation Strategy

1. **Working proxy**: Complete Setup, Foundation, and US1.
2. **Policy proof**: Add US2 and demonstrate zero forwarding for REVIEW/DENY.
3. **Minimum v0.1 core**: Add US3 and run the complete keyless suite.
4. **Research value**: Add the compact US4 benchmark.
5. **Portfolio finish**: Complete README, CI, Docker, and final validation.
6. **Optional local comparison**: Complete US5 without changing policy/router
   semantics; pass keyless tests and full typecheck before any opt-in real-model
   smoke run.

## Test Scope

- Use unit tests only for configuration parsing, policy logic, sanitization, the
  Jev/Laya adapter mappings and context preflight, and benchmark math.
- Use one strong proxy integration test, one non-forwarding policy integration
  test, one semantic/audit integration test, one benchmark integration test, and
  one stdio end-to-end test.
- Test observable gateway behavior; do not reproduce MCP SDK, TypeSafe SDK,
  SQLite, Pino, Docker, or Node.js test suites.
- Keep provider failure coverage representative: prove configured behavior once at
  the policy boundary and once through the gateway.
- Do not add load testing, exhaustive combinatorial matrices, exact wall-clock
  gates, or redundant contract tests for behavior already covered end to end.
- Do not run real Laya inference or download weights in the keyless suite; use one
  fake-session adapter test and extend existing integration coverage.
