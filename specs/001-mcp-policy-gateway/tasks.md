# Tasks: MCP Policy Gateway v0.1

**Input**: Design documents from `specs/001-mcp-policy-gateway/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/`, and `quickstart.md`

**Tests**: Tests are required by the specification and constitution. Write each
phase's tests first, observe the relevant failure, then implement. Every phase ends
with passing relevant tests and the full TypeScript typecheck before continuation.

**Organization**: Tasks are grouped by user story. Every task includes an exact
file path and user-story tasks carry their story label.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the Node.js 24, strict TypeScript, test, lint, container,
and package foundation without implementing feature behavior.

- [ ] T001 Initialize the Node.js 24 ESM package, exact runtime dependencies, development dependencies, scripts, and lockfile in `package.json` and `package-lock.json`
- [ ] T002 [P] Configure strict `NodeNext` compilation, declaration output, source maps, and required strictness flags in `tsconfig.json`
- [ ] T003 [P] Configure TypeScript-aware linting and prohibited unsafe boundary patterns in `eslint.config.js`
- [ ] T004 [P] Configure isolated Vitest projects for unit, contract, integration, and benchmark tests in `vitest.config.ts`
- [ ] T005 [P] Ignore build output, coverage, local configuration, SQLite files, benchmark results, and secrets while preserving examples in `.gitignore`
- [ ] T006 [P] Add a Node 24 Debian-slim multi-stage non-root image and build context exclusions in `Dockerfile` and `.dockerignore`
- [ ] T007 Run the setup lint, typecheck, test discovery, and build scripts defined in `package.json`; fix all failures before Phase 2

**Checkpoint**: Package installation is lockfile-reproducible and the empty project
passes lint, typecheck, test discovery, and build.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared configuration, logging, audit persistence, provider
contracts, and keyless fixtures required by every user story.

**CRITICAL**: No user-story implementation begins until this phase passes its gate.

### Tests First

- [ ] T008 [P] Write failing strict-YAML, unknown-key, threshold, hard-rule, path-resolution, and secret-exclusion tests in `tests/unit/config/config.test.ts`
- [ ] T009 [P] Write failing stderr-destination, child-correlation, and defense-in-depth redaction tests in `tests/unit/logging/logger.test.ts`
- [ ] T010 [P] Write failing schema-validation tests for the canonical audit event contract in `tests/contract/audit-event.test.ts`
- [ ] T011 [P] Write failing migration, prepared-insert, uniqueness, WAL/reopen, and observable-write-failure tests in `tests/unit/audit/AuditRepository.test.ts`
- [ ] T012 [P] Write failing interface-invariant and scripted mock-provider tests in `tests/contract/decision-provider.test.ts`

### Shared Implementation

- [ ] T013 Implement strict Zod configuration types, defaults, enums, thresholds, hard-rule predicates, and cross-field refinements in `src/config/schema.ts`
- [ ] T014 Implement bounded single-document YAML parsing, relative-path normalization, non-secret configuration hashing, and startup errors in `src/config/loadConfig.ts`
- [ ] T015 Add a complete non-secret operator example matching the configuration contract in `config/example.yaml`
- [ ] T016 [P] Implement the stderr-only Pino logger, fixed redaction removal paths, and correlation child loggers in `src/logging/logger.ts`
- [ ] T017 [P] Implement JSON value, risk signal, provider status, and provider evaluation runtime schemas/types in `src/decision/types.ts`
- [ ] T018 Define the focused abort-aware `DecisionProvider` interface in `src/decision/DecisionProvider.ts`
- [ ] T019 Implement the isolated scripted and call-recording `MockDecisionProvider` in `src/decision/MockDecisionProvider.ts`
- [ ] T020 [P] Define final outcomes, hard-rule records, policy sources, reason codes, decisions, and upstream outcome types in `src/policy/types.ts`
- [ ] T021 Implement strict AuditEvent v1 schemas/types that reject prohibited and unknown fields in `src/audit/AuditEvent.ts`
- [ ] T022 Add the checksummed initial `audit_events` and `schema_migrations` schema with required indexes in `migrations/001-create-audit-events.sql`
- [ ] T023 Implement ordered atomic SQLite migrations, WAL, foreign keys, and bounded busy-timeout setup in `src/audit/migrations.ts`
- [ ] T024 Implement prepared audit inserts and test-only query helpers without leaking driver types in `src/audit/AuditRepository.ts`
- [ ] T025 Implement canonical event validation, exactly-once insert attempts, and sanitized persistence-failure reporting in `src/audit/auditService.ts`
- [ ] T026 [P] Add deterministic clocks, UUID sources, temporary database helpers, and validated test configuration builders in `tests/fixtures/testConfig.ts`
- [ ] T027 [P] Implement a controllable official-SDK fake upstream MCP server with catalog pagination, invocation recording, results, errors, delays, and disconnects in `tests/fixtures/fakeMcpServer.ts`
- [ ] T028 Run all foundational tests plus lint and full typecheck through scripts in `package.json`; fix every failure before Phase 3

**Checkpoint**: Configuration, logging, audit storage, provider contracts, and
keyless fixtures pass independently with no external service or credential.

---

## Phase 3: User Story 1 - Use Upstream Tools Through the Gateway (Priority: P1)

**Goal**: An MCP host can list one upstream server's frozen tool catalog and an
allowed call reaches that upstream exactly once with unchanged name, arguments,
result, and tool error behavior.

**Independent Test**: Connect an official-SDK test client to the gateway and fake
upstream, list tools, invoke an allowed tool, and assert the fake server received
one identical invocation and the client received the unchanged result or error.

### Tests for User Story 1

- [ ] T029 [P] [US1] Write failing contract tests for paginated catalog preservation and unchanged allowed results/tool errors in `tests/contract/gateway-results.test.ts`
- [ ] T030 [P] [US1] Write a failing end-to-end allowed-call test with the fake upstream and SQLite audit database in `tests/integration/gateway-allow.test.ts`
- [ ] T031 [P] [US1] Write a failing subprocess stdio negotiation, protocol-only stdout, graceful shutdown, and stderr logging test in `tests/integration/gateway-stdio.test.ts`
- [ ] T032 [P] [US1] Write failing upstream connect, pagination, timeout, abort, close, and protocol/transport error tests in `tests/unit/mcp/upstreamClient.test.ts`
- [ ] T033 [P] [US1] Write failing duplicate-name, deterministic-order, schema-compile, unknown-tool, and argument-validation tests in `tests/unit/mcp/toolCatalog.test.ts`
- [ ] T034 [P] [US1] Write failing no-provider default-outcome and deterministic reason-code tests in `tests/unit/policy/policyEngine.test.ts`

### Implementation for User Story 1

- [ ] T035 [US1] Construct official SDK downstream and upstream stdio transports without a custom transport hierarchy in `src/mcp/transportFactories.ts`
- [ ] T036 [US1] Implement upstream lifecycle, complete catalog pagination, timeout/abort propagation, unchanged `callTool`, and explicit close behavior in `src/mcp/upstreamClient.ts`
- [ ] T037 [P] [US1] Implement immutable catalog snapshotting and cached Ajv argument validators in `src/mcp/toolCatalog.ts`
- [ ] T038 [P] [US1] Implement the deterministic no-provider outcome path and stable reason codes in `src/policy/policyEngine.ts`
- [ ] T039 [US1] Implement the validated allowed-call pipeline and upstream outcome mapping in `src/mcp/router.ts`
- [ ] T040 [US1] Register low-level `tools/list` and `tools/call` handlers and preserve upstream result objects in `src/mcp/gatewayServer.ts`
- [ ] T041 [US1] Compose validated config, logger, SQLite audit, upstream client, router, downstream server, signals, and shutdown in `src/index.ts`
- [ ] T042 [US1] Run the US1 unit, contract, integration, and subprocess suites plus full typecheck using `package.json`; fix all failures before Phase 4

**Checkpoint**: User Story 1 is a demonstrable transparent, auditable allowed-call
gateway increment. It is not yet the minimum policy-enforcing v0.1 release.

---

## Phase 4: User Story 2 - Stop or Flag Risky Tool Calls (Priority: P1)

**Goal**: Every valid invocation receives a deterministic outcome; hard rules win,
provider failures use configured behavior, and `REVIEW`/`DENY` can never dispatch
upstream.

**Independent Test**: Run hard-rule conflicts, semantic threshold cases, every
provider failure mode, concurrent calls, and 10,000 denied/reviewed calls against
the fake upstream; assert exact outcomes and zero upstream invocations.

### Tests for User Story 2

- [ ] T043 [P] [US2] Write failing exact/glob tool matching, JSON Pointer predicate, multi-rule precedence, and tie-break tests in `tests/unit/policy/hardRules.test.ts`
- [ ] T044 [P] [US2] Extend failing policy tests for semantic deny/review thresholds, hard-rule precedence, eligibility, invalid signals, and each configured failure outcome in `tests/unit/policy/policyEngine.test.ts`
- [ ] T045 [P] [US2] Write failing contract tests for sanitized `DENY`, `REVIEW`, validation, provider-failure, and upstream-failure MCP results in `tests/contract/gateway-results.test.ts`
- [ ] T046 [P] [US2] Write failing zero-forwarding tests for validation, hard rule, semantic threshold, provider failure, concurrency, retries, and a 10,000-call stress case in `tests/integration/gateway-non-forwarding.test.ts`
- [ ] T047 [P] [US2] Write failing provider timeout/abort/invalid/partial and upstream protocol/transport/abort mapping tests in `tests/integration/gateway-failures.test.ts`

### Implementation for User Story 2

- [ ] T048 [US2] Implement bounded tool globs, RFC 6901 argument predicates, and deterministic `DENY > REVIEW > ALLOW` rule resolution in `src/policy/hardRules.ts`
- [ ] T049 [US2] Complete semantic eligibility, hard-rule short-circuiting, threshold aggregation, and explicit provider-failure outcomes in `src/policy/policyEngine.ts`
- [ ] T050 [P] [US2] Implement closed sanitized gateway result and failure mappings with no raw exception text in `src/mcp/errors.ts`
- [ ] T051 [US2] Enforce validation, hard-rule, provider, policy, and upstream ordering so only the explicit `ALLOW` branch can call upstream in `src/mcp/router.ts`
- [ ] T052 [US2] Return contract-compliant non-forwarding `REVIEW` and `DENY` results with namespaced metadata in `src/mcp/gatewayServer.ts`
- [ ] T053 [US2] Run all US2 tests, the 10,000-call non-forwarding stress case, regression tests, lint, and full typecheck through `package.json`; fix every failure before Phase 5

**Checkpoint**: User Stories 1 and 2 provide the deterministic enforcement boundary,
including a measured zero-forwarding guarantee.

---

## Phase 5: User Story 3 - Evaluate and Audit Without Leaking Secrets (Priority: P1)

**Goal**: Eligible calls can use Jev or a mock provider through one contract, while
provider state, logs, and SQLite audit events contain only allowlisted sanitized
data and every terminal call path creates one correlated event.

**Independent Test**: Send nested, array, free-text, encoded, header-like,
credential-like, and environment-like secrets through all outcomes; capture mock/
Jev requests, stderr logs, and SQLite rows; assert zero prohibited values and all
required decision/latency fields.

### Tests for User Story 3

- [ ] T054 [P] [US3] Write failing recursive key/value redaction, bound, immutability, and allowlisted DTO tests with the sensitive corpus in `tests/unit/security/sanitize.test.ts`
- [ ] T055 [P] [US3] Extend failing provider contract tests for six Noul mappings, Zod response validation, explicit timeout/retry, cancellation, SDK logging-off, and sanitized input in `tests/contract/decision-provider.test.ts`
- [ ] T056 [P] [US3] Extend failing audit contract tests for provider/policy/upstream summaries, canonical JSON, and prohibited-value rejection in `tests/contract/audit-event.test.ts`
- [ ] T057 [P] [US3] Write failing exactly-once audit tests across allow, review, deny, validation, provider failure, upstream failure, abort, concurrency, and SQLite failure in `tests/integration/gateway-audit.test.ts`
- [ ] T058 [P] [US3] Write failing provider-request and log capture tests proving sensitive values never cross semantic or logging boundaries in `tests/integration/gateway-sanitization.test.ts`
- [ ] T059 [P] [US3] Extend configuration tests for fixed `TYPESAFE_API_KEY` resolution, missing-key startup failure, no YAML key/header fields, and non-secret hashes in `tests/unit/config/config.test.ts`
- [ ] T060 [P] [US3] Add nested, array, free-text, encoded, header-like, credential-like, and environment-like cases in `tests/fixtures/sensitiveArguments.ts`

### Implementation for User Story 3

- [ ] T061 [US3] Implement fixed sensitive-key and secret-like value detection with bounded replacements in `src/security/redact.ts`
- [ ] T062 [US3] Implement immutable recursive sanitization and strict `SanitizedDecisionInput` construction in `src/security/sanitize.ts`
- [ ] T063 [US3] Implement the official TypeSafe client, six atomic Noul questions, explicit timeout/retry/abort, logging disabled, typed error normalization, and Zod result mapping in `src/decision/JevDecisionProvider.ts`
- [ ] T064 [US3] Resolve the provider-owned TypeSafe key without adding it to normalized config, hashes, or logs in `src/config/loadConfig.ts`
- [ ] T065 [US3] Complete sanitized provider, policy, latency, and upstream summaries plus canonical persistence in `src/audit/AuditEvent.ts` and `src/audit/auditService.ts`
- [ ] T066 [US3] Integrate sanitization, provider selection, cancellation, one terminal decision, and one audit creation across every router path in `src/mcp/router.ts`
- [ ] T067 [US3] Emit sanitized lifecycle/decision summaries and observable audit-write failures without writing protocol bytes outside MCP in `src/logging/logger.ts`
- [ ] T068 [US3] Add a network-free `test:keyless` script that selects all core suites and rejects accidental Jev access in `package.json`
- [ ] T069 [US3] Run the keyless suite, US3 integration tests, all prior regressions, lint, and full typecheck through `package.json`; fix every failure before Phase 6

**Checkpoint**: User Stories 1 through 3 are the minimum constitution-compliant
v0.1 gateway core and run fully without TypeSafe credentials.

---

## Phase 6: User Story 4 - Compare Gateway Decision Modes (Priority: P2)

**Goal**: Researchers can run one labelled dataset through no-semantic-gate,
deterministic-only, Jev, and future provider modes and compare classification,
policy, forwarding, error, and latency metrics reproducibly.

**Independent Test**: Run the same fixed dataset and seed through the two keyless
modes and a scripted provider, validate every result against the result schema,
then verify Jev is opt-in and uses the identical contract and dataset.

### Tests for User Story 4

- [ ] T070 [P] [US4] Write failing dataset version/hash, duplicate ID, complete-label, secret rejection, balance, and deterministic-order tests in `tests/unit/benchmark/dataset.test.ts`
- [ ] T071 [P] [US4] Write failing confusion-matrix, precision, recall, F1, macro-F1, policy-accuracy, and percentile edge-case tests in `tests/unit/benchmark/metrics.test.ts`
- [ ] T072 [P] [US4] Write failing benchmark-result JSON Schema and provider/policy separation tests in `tests/contract/benchmark-result.test.ts`
- [ ] T073 [P] [US4] Write failing reproducibility and no-network tests for no-semantic-gate, deterministic-only, and scripted-provider modes in `tests/integration/benchmark-modes.test.ts`
- [ ] T074 [P] [US4] Write an opt-in failing Jev benchmark contract test that skips without credentials and never exposes them in `tests/integration/benchmark-jev.test.ts`

### Implementation for User Story 4

- [ ] T075 [US4] Implement strict JSONL case loading, schema/secret/balance validation, stable hashing, and seeded ordering in `src/benchmark/dataset.ts`
- [ ] T076 [P] [US4] Implement classification matrices, per-signal metrics, macro F1, policy accuracy, forwarding counts, and percentile calculations in `src/benchmark/metrics.ts`
- [ ] T077 [US4] Implement mode selection, shared pipeline execution, runtime/config metadata, sanitized case results, schema validation, and atomic result writes in `src/benchmark/runBenchmark.ts`
- [ ] T078 [P] [US4] Add deterministic benchmark builders and scripted provider results for tests in `tests/fixtures/benchmarkDataset.ts`
- [ ] T079 [US4] Curate the synthetic/non-secret six-signal labelled v0.1 corpus with at least 30 positive and 30 negative cases per category in `benchmarks/datasets/v0.1.jsonl`
- [ ] T080 [US4] Add benchmark scripts and no-semantic, deterministic-only, Jev, and generic-provider CLI options in `package.json`
- [ ] T081 [US4] Run all US4 tests and keyless modes, validate produced result files, then run lint and full typecheck through `package.json`; fix every failure before final polish

**Checkpoint**: All four stories work through common contracts; keyless benchmark
modes are reproducible and Jev evaluation remains explicitly opt-in.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete open-source documentation, CI/container reproducibility,
security regression coverage, performance evidence, and final scope validation.

- [ ] T082 [P] Document installation, MCP-host configuration, policy/failure semantics, secret boundary, audit operations, benchmarks, and the research-only disclaimer in `README.md`
- [ ] T083 [P] Add the selected open-source license text and align package metadata in `LICENSE` and `package.json`
- [ ] T084 [P] Add SHA-pinned GitHub Actions jobs for lockfile install, lint, typecheck, keyless tests, build, and Docker build with minimum permissions in `.github/workflows/ci.yml`
- [ ] T085 Finalize the digest-pinned multi-stage image, health-free stdio entrypoint, non-root ownership, and mounted `/app/data` behavior in `Dockerfile` and `.dockerignore`
- [ ] T086 [P] Add regression cases for malformed/oversized inputs, sanitization depth/length limits, concurrent retries, catalog changes, and stdout contamination in `tests/integration/gateway-edge-cases.test.ts`
- [ ] T087 [P] Add the 10 ms p95 local-overhead check and stable latency-report validation without exact wall-clock assertions in `tests/integration/gateway-performance.test.ts`
- [ ] T088 Record the nine excluded capabilities, dependency inspection, production-claim review, and constitutional release evidence in `specs/001-mcp-policy-gateway/checklists/release.md`
- [ ] T089 Execute every scenario in `specs/001-mcp-policy-gateway/quickstart.md` and update only inaccurate commands or expected outcomes in that file
- [ ] T090 Run lint, full typecheck, all keyless tests, build, benchmark schema validation, and Docker build through `package.json` and `Dockerfile`; do not complete v0.1 while any gate fails

**Checkpoint**: The repository is reproducible, documented, scope-checked, and all
required gates pass. Live Jev tests remain optional and separately credentialed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** has no dependencies.
- **Phase 2 (Foundational)** depends on Phase 1 and blocks all user stories.
- **Phase 3 (US1)** depends on Phase 2 and establishes the real MCP route.
- **Phase 4 (US2)** depends on US1 because it closes the route with deterministic
  enforcement and non-forwarding results.
- **Phase 5 (US3)** depends on US2 because it inserts sanitized provider evaluation
  and complete audit production into the already enforced route.
- **Phase 6 (US4)** depends on US2 for keyless policy modes and US3 for Jev mode.
- **Phase 7 (Polish)** depends on all selected user stories.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 -> US2 -> US3
                              |      |
                              `------v
                                    US4 -> Polish
```

- **US1** is independently testable as a transparent allowed-call proxy increment.
- **US2** is independently testable with the fake upstream and mock provider once
  the US1 route exists; it proves policy outcomes and non-forwarding.
- **US3** is independently testable with captured provider inputs, stderr logs, and
  temporary SQLite databases; live Jev access is not required.
- **US4** is independently testable in keyless modes and with a scripted provider;
  the live Jev comparison is opt-in.

### Within Each Phase

1. Write the phase's tests and confirm they fail for the intended missing behavior.
2. Implement pure models and validation before I/O components.
3. Implement services and protocol integration after their boundaries exist.
4. Run the phase-specific suite and all regressions.
5. Pass lint and the full TypeScript typecheck before continuing.

## Parallel Opportunities

- Setup configuration files T002-T006 can proceed in parallel after T001.
- Foundational test tasks T008-T012 are independent; logger, decision types, policy
  types, and test fixtures can proceed in parallel where their listed tests exist.
- US1 tests T029-T034 can be written together; T037 and T038 can be implemented in
  parallel after their tests while upstream transport work proceeds sequentially.
- US2 tests T043-T047 can be written together; sanitized error mapping T050 can run
  in parallel with hard-rule and policy work T048-T049.
- US3 tests T054-T060 can be written together; Jev integration T063 can proceed in
  parallel with audit work T065 after shared sanitization contracts are fixed.
- US4 tests T070-T074 can be written together; metric implementation T076 and test
  fixture work T078 can proceed in parallel with dataset loading T075.
- Documentation, license, CI, and independent regression suites T082-T087 can run
  in parallel before the final scope and quality gates.

## Parallel Execution Examples

### User Story 1

```text
Parallel: T029 gateway result contract, T030 allowed integration, T031 stdio,
          T032 upstream lifecycle, T033 catalog validation, T034 policy default
Then:     T035 -> T036; T037 || T038; T039 -> T040 -> T041 -> T042
```

### User Story 2

```text
Parallel: T043 hard rules, T044 policy, T045 result contract,
          T046 non-forwarding, T047 failures
Then:     T048 -> T049; T050 in parallel; T051 -> T052 -> T053
```

### User Story 3

```text
Parallel: T054 sanitizer, T055 provider, T056 audit contract,
          T057 audit integration, T058 boundary capture, T059 config, T060 corpus
Then:     T061 -> T062; T063 || T064 || T065; T066 -> T067 -> T068 -> T069
```

### User Story 4

```text
Parallel: T070 dataset, T071 metrics, T072 result contract,
          T073 keyless modes, T074 opt-in Jev
Then:     T075 || T076 || T078; T077 -> T079 -> T080 -> T081
```

## Implementation Strategy

### First Demonstrable Increment

1. Complete Setup and Foundation.
2. Complete US1.
3. Demonstrate transparent catalog listing and unchanged allowed forwarding.
4. Do not describe this increment as a policy gateway release yet.

### Minimum Constitution-Compliant v0.1 Core

1. Complete US1 transparent proxying.
2. Complete US2 deterministic policy and non-forwarding outcomes.
3. Complete US3 sanitized semantic evaluation and audit persistence.
4. Run the complete keyless suite and all phase gates.

### Full v0.1 Research Release

1. Add US4 comparative benchmarks.
2. Complete open-source documentation, CI, Docker, security/performance regression,
   quickstart, and scope review tasks.
3. Run the final gate; live Jev validation remains opt-in and separately reported.

## Notes

- `[P]` means the task changes different files and has no dependency on unfinished
  tasks in its parallel group.
- Tests precede implementation and must fail for the expected reason before code is
  added.
- Original MCP arguments are accessible only to validation and the final `ALLOW`
  forwarding branch; no task may persist or log them.
- Only `src/mcp/router.ts` may invoke the upstream call path after an `ALLOW`
  decision.
- Every implementation phase ends with relevant tests, lint, and full typecheck.
- Commit after each task or cohesive task group while preserving phase gates.
