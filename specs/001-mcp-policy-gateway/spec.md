# Feature Specification: MCP Policy Gateway v0.1

**Feature Branch**: `master`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Build v0.1 of jev-mcp-middleware, an open-source MCP middleware gateway with deterministic policy, advisory semantic evaluation, sanitized audit logging, keyless tests, and comparative benchmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use Upstream Tools Through the Gateway (Priority: P1)

An MCP host connects to the gateway in place of a configured upstream MCP server,
sees the upstream tool catalog, invokes an eligible tool, and receives the same
result it would have received from the upstream server when policy allows the call.

**Why this priority**: Transparent proxy behavior is the minimum useful product.
Without correct discovery, forwarding, and result handling, policy evaluation has
no viable MCP workflow to protect or study.

**Independent Test**: Connect a test MCP host to the gateway and a fake upstream
server, list its tools, invoke an allowed tool, and verify that the fake server
receives exactly one unchanged invocation and that the client receives its
unchanged result.

**Acceptance Scenarios**:

1. **Given** a configured upstream server with a fixed tool catalog, **When** an
   MCP host requests the available tools, **Then** the gateway exposes the
   upstream tools without changing their names, descriptions, or input contracts.
2. **Given** a valid tool call whose final policy result is `ALLOW`, **When** the
   host invokes the tool, **Then** the gateway forwards the original call exactly
   once and returns the upstream result without scanning or changing it.
3. **Given** the upstream server returns a protocol error, **When** an allowed call
   is forwarded, **Then** the host receives a protocol-compatible error and the
   gateway records the upstream failure outcome.

---

### User Story 2 - Stop or Flag Risky Tool Calls (Priority: P1)

A project operator configures hard rules and semantic thresholds so that every
intercepted tool call receives a deterministic `ALLOW`, `REVIEW`, or `DENY`
result before any upstream invocation occurs.

**Why this priority**: The gateway's defining guarantee is that hard policy remains
authoritative and denied calls never reach the upstream server.

**Independent Test**: Run a corpus of allowed, denied, review-required, and
provider-failure calls against a fake upstream server; verify final outcomes,
hard-rule precedence, and the exact upstream invocation count for each case.

**Acceptance Scenarios**:

1. **Given** a call matched by a hard `DENY` rule, **When** the host invokes it,
   **Then** the gateway returns a denial result without consulting a semantic
   provider or sending any invocation to the upstream server.
2. **Given** a hard rule conflicts with a provider's judgment, **When** policy is
   evaluated, **Then** the hard-rule outcome is the final outcome.
3. **Given** an eligible call and provider signals indicating elevated risk,
   **When** configured deterministic thresholds resolve to `REVIEW`, **Then** the
   gateway returns a review-required result and does not forward the call.
4. **Given** an eligible call and provider signals below all configured thresholds,
   **When** policy is evaluated, **Then** the final outcome is determined by policy
   configuration rather than by a provider-supplied allow or deny instruction.
5. **Given** the provider is unavailable, times out, or returns an invalid result,
   **When** the call is evaluated, **Then** the configured failure outcome is used,
   the failure is visible in the decision record, and no implicit fallback occurs.

---

### User Story 3 - Evaluate and Audit Without Leaking Secrets (Priority: P1)

A developer can use a semantic provider and inspect structured audit events while
knowing that provider requests and audit records contain only permitted,
sanitized information.

**Why this priority**: Semantic evaluation and observability are useful only if
they preserve the project's data-minimization boundary and make decisions
explainable.

**Independent Test**: Submit calls containing representative credentials,
authorization values, environment data, nested secrets, and benign values; capture
provider requests and audit events; verify the allowlisted content, required audit
fields, redactions, decision trace, and absence of prohibited data.

**Acceptance Scenarios**:

1. **Given** a call eligible for semantic evaluation, **When** the provider is
   consulted, **Then** it receives only the tool name, public tool description,
   and sanitized arguments.
2. **Given** arguments containing secret-like or explicitly prohibited fields,
   **When** the provider request and audit event are produced, **Then** prohibited
   values are omitted or redacted while the original call remains available only
   for unchanged forwarding after an `ALLOW` outcome.
3. **Given** any intercepted call, **When** processing completes or terminates in
   an error, **Then** exactly one correlated audit event records timing, provider
   status and signals, final policy result, and upstream outcome when applicable.
4. **Given** a mock semantic provider, **When** the core conformance suite runs
   without external credentials or network access, **Then** proxy, policy, audit,
   and failure paths remain fully testable.

---

### User Story 4 - Compare Gateway Decision Modes (Priority: P2)

A researcher runs the same labelled tool-call dataset through multiple gateway
decision modes and receives comparable correctness, classification-quality, and
latency results.

**Why this priority**: Comparative evidence is central to the project's research
purpose, but it depends on the proxy and decision boundaries from the P1 stories.

**Independent Test**: Run one versioned labelled dataset in no-semantic-gate,
deterministic-only, and Jev modes, then verify that each mode produces a complete,
comparable report and that another provider can later participate through the
same evaluation contract.

**Acceptance Scenarios**:

1. **Given** a labelled dataset and fixed policy configuration, **When** a benchmark
   run completes, **Then** results identify the mode, dataset version, configuration,
   per-label predictions, final outcomes, provider latency, total decision latency,
   and aggregate quality metrics.
2. **Given** no-semantic-gate and deterministic-only modes, **When** they are
   benchmarked, **Then** they run without semantic-provider credentials.
3. **Given** the Jev mode, **When** valid credentials are supplied, **Then** its
   typed risk judgments are measured separately from the deterministic final
   policy outcomes.
4. **Given** a future provider implementing the common decision contract, **When**
   it is selected for a benchmark, **Then** the harness can compare it without
   changing dataset or policy-result definitions.

### Edge Cases

- A request is malformed, lacks a tool name, has invalid arguments, or names a tool
  absent from the exposed catalog.
- A hard rule produces a result that conflicts with every semantic signal.
- The provider times out, is unavailable, returns malformed data, returns only some
  judgments, or exceeds its configured latency limit.
- Arguments contain credentials in nested objects, arrays, free text, encoded
  values, or fields whose names do not obviously identify them as secrets.
- Sanitization removes data required for a useful semantic judgment.
- The upstream disconnects before receipt, after receipt but before response, or
  returns a malformed or oversized result.
- The audit destination cannot accept an event after an upstream action has
  already occurred.
- Multiple calls are processed concurrently or a client retries the same logical
  operation; each intercepted invocation must remain independently correlated.
- The upstream tool catalog changes after the gateway has established its v0.1
  catalog snapshot.
- A result is `REVIEW` even though no interactive reviewer is available.
- A benchmark case has missing labels, contradictory labels, provider errors, or
  no positive examples for a reported classification category.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST accept connections from standards-compatible MCP
  hosts and mediate tool traffic to one configured upstream MCP server per running
  gateway instance.
- **FR-002**: The gateway MUST expose the configured upstream server's initial tool
  catalog while preserving each tool's public name, description, and input
  contract.
- **FR-003**: The gateway MUST intercept every tool invocation before any upstream
  dispatch and assign a correlation identifier used throughout its decision and
  audit records.
- **FR-004**: The gateway MUST deterministically reject malformed invocations and
  calls to unexposed tools before semantic evaluation or upstream dispatch.
- **FR-005**: The gateway MUST evaluate configured hard-policy rules before deciding
  whether semantic evaluation is eligible or necessary.
- **FR-006**: A decisive hard-rule outcome MUST take precedence over all semantic
  signals; a hard `DENY` MUST skip provider evaluation and upstream dispatch.
- **FR-007**: Eligibility for semantic evaluation MUST be deterministic and
  reproducible from the same call metadata and configuration.
- **FR-008**: For eligible calls, the gateway MUST construct a provider request
  containing only the tool name, public tool description, and sanitized arguments.
- **FR-009**: Provider requests MUST exclude secrets, authorization headers,
  credentials, environment variables, raw gateway configuration, and any other
  field not explicitly allowlisted.
- **FR-010**: A semantic provider MUST be able to report narrow typed judgments for
  destructiveness, external consequence, sensitivity, irreversibility, unusual
  impact, and appropriateness for human review, together with evaluation status
  and latency.
- **FR-011**: All semantic providers MUST use one common decision contract so Jev,
  static baselines, mocks, and future LLM-based providers are interchangeable from
  the perspective of policy and benchmarking.
- **FR-012**: The Jev provider MUST return advisory judgments only and MUST NOT
  directly assign or override a final `ALLOW`, `REVIEW`, or `DENY` outcome.
- **FR-013**: A deterministic policy engine MUST combine hard-rule results,
  provider status, typed judgments, configured thresholds, and configured failure
  behavior into exactly one final outcome: `ALLOW`, `REVIEW`, or `DENY`.
- **FR-014**: For identical validated inputs, provider results, and configuration,
  the policy engine MUST produce the same final outcome and reason codes.
- **FR-015**: An `ALLOW` outcome MUST forward the original invocation exactly once,
  unchanged, and return the upstream result or error without response scanning or
  semantic modification.
- **FR-016**: A `DENY` outcome MUST return a protocol-compatible denial containing
  a non-sensitive reason code and MUST result in zero upstream invocations.
- **FR-017**: A `REVIEW` outcome MUST be represented in the public decision result,
  return a protocol-compatible review-required response, and MUST result in zero
  upstream invocations in v0.1.
- **FR-018**: Provider timeout, unavailability, invalid output, and partial output
  MUST use a documented configurable failure outcome. The supported outcomes MUST
  be `ALLOW`, `REVIEW`, and `DENY`; the explicit default MUST be `DENY`, and the
  selected behavior MUST appear in the audit event.
- **FR-019**: Every intercepted call MUST produce exactly one sanitized structured
  audit event containing correlation metadata, stage latencies, provider status
  and available judgments, policy outcome and reason codes, and upstream outcome
  when forwarding was attempted.
- **FR-020**: Audit events MUST omit or redact secrets, authorization headers,
  credentials, environment values, raw configuration, and unsanitized arguments.
- **FR-021**: Audit-production failures MUST be observable and MUST NOT be reported
  as successful audit delivery; long-term storage and retention are external to
  v0.1.
- **FR-022**: The project MUST provide a mock decision provider and fake upstream
  MCP server capable of exercising all core behavior without TypeSafe credentials
  or access to external services.
- **FR-023**: The conformance suite MUST cover allowed, reviewed, denied, malformed,
  provider-timeout, provider-error, upstream-error, hard-rule-conflict, and
  prohibited-data cases at the policy and proxy boundaries.
- **FR-024**: The benchmark harness MUST run no-semantic-gate,
  deterministic-policy-only, and Jev modes against the same versioned labelled
  dataset and MUST accept future providers through the common decision contract.
- **FR-025**: Benchmark output MUST separate semantic classifications from final
  policy outcomes and report per-category quality, outcome correctness, provider
  latency, total decision latency, and upstream-forwarding behavior.
- **FR-026**: Each benchmark report MUST identify the dataset version, mode,
  policy configuration, provider identity or absence, run time, and error counts
  needed to reproduce and compare results.
- **FR-027**: v0.1 documentation and output MUST identify the project as developer
  tooling and research infrastructure, not a production security guarantee.
- **FR-028**: v0.1 MUST NOT add OAuth federation, dashboards, SaaS or multitenancy,
  dynamic tool-catalog refresh, token reduction, response scanning, Kubernetes,
  Redis, or claims of production-security assurance.

### Constitution Requirements *(mandatory)*

- **Decision authority**: FR-013 and FR-014 assign every final outcome to a
  deterministic policy engine. FR-012 limits semantic providers to advisory typed
  judgments.
- **Hard-rule precedence**: FR-005 and FR-006 require hard rules to run first and
  make their decisive outcomes authoritative, including skipping provider and
  upstream work for a hard denial.
- **Denial behavior**: FR-016 requires zero upstream invocations. Acceptance tests
  count calls received by a fake MCP server rather than inferring non-forwarding
  from the client response.
- **Provider failure behavior**: FR-018 supports explicit `ALLOW`, `REVIEW`, or
  `DENY` configuration, uses a documented `DENY` default, and records both the
  failure and selected behavior in the audit event.
- **Provider data allowlist**: FR-008 permits only tool name, public tool
  description, and sanitized arguments. FR-009 prohibits all other sensitive or
  configuration data.
- **Provider abstraction**: FR-011 defines one provider contract covering Jev,
  static baselines, mocks, and future LLM providers without changing policy
  semantics.
- **Keyless protocol testing**: FR-022 and FR-023 require a fake MCP server and
  mock provider to cover core proxy, policy, audit, and failure behavior without
  credentials or external services.
- **v0.1 scope fit**: FR-024 through FR-028 limit delivery to MCP proxying,
  deterministic policy, semantic evaluation, audit logging, and benchmarking and
  explicitly exclude the deferred product and infrastructure features.
- **Research limitation**: FR-027 requires every v0.1 description to identify the
  gateway as research/developer tooling without production-security claims.

### Key Entities

- **Tool Catalog Entry**: A tool exposed to the MCP host, including its public name,
  description, and argument contract as supplied by the configured upstream.
- **Intercepted Call**: One inbound tool invocation, including its correlation
  metadata, original forwarding form, validation status, and sanitized evaluation
  representation.
- **Provider Evaluation**: Advisory typed judgments, provider status, reason data,
  and latency returned for an eligible sanitized call.
- **Policy Decision**: The deterministic final outcome, reason codes, applicable
  hard rule, thresholds, provider-failure behavior, and configuration identity.
- **Audit Event**: The sanitized, correlated record of processing stages, timing,
  provider evaluation, policy decision, forwarding attempt, and upstream outcome.
- **Benchmark Case**: A sanitized tool-call example with dataset version, expected
  classifications, and expected policy or forwarding behavior.
- **Benchmark Run**: A collection of case results for one decision mode and fixed
  configuration, with aggregate correctness, classification, and latency metrics.
- **Gateway Configuration**: The selected upstream, hard rules, semantic eligibility
  rules, provider, thresholds, provider-failure outcome, and audit destination.

### Scope Boundaries

The v0.1 product includes a single-upstream MCP gateway, initial tool-catalog
exposure, pre-dispatch validation and policy, optional semantic evaluation,
non-forwarding `REVIEW` and `DENY` outcomes, structured audit events, keyless test
doubles, and a comparative benchmark harness.

OAuth federation, dashboards, SaaS and multitenancy, dynamic refresh of an upstream
tool catalog, token reduction, response scanning, Kubernetes, Redis, interactive
human-approval UI, implementation of an LLM provider, and production-security
assurance are deferred beyond v0.1.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across the protocol conformance suite, 100% of `ALLOW` cases reach the
  fake upstream exactly once with an unchanged invocation and return its unchanged
  result or protocol error.
- **SC-002**: Across the conformance suite and a stress run of at least 10,000
  denied or review-required calls, zero `DENY` or `REVIEW` calls reach the fake
  upstream server.
- **SC-003**: In 100% of labelled conflict cases, decisive hard-rule outcomes match
  the final policy outcomes regardless of semantic-provider judgments.
- **SC-004**: 100% of intercepted conformance cases produce one correlated audit
  event with all applicable required fields; audit-delivery failures are reported
  rather than counted as successful delivery.
- **SC-005**: Provider-request and audit-event tests find zero prohibited values
  across a corpus covering nested, array-based, free-text, encoded, header-like,
  credential-like, and environment-like sensitive data.
- **SC-006**: Every benchmark mode reports case counts, errors, forwarding accuracy,
  policy accuracy, and p50, p95, and p99 provider and total decision latency using
  the same dataset and configuration identity.
- **SC-007**: On the versioned labelled evaluation dataset, the Jev mode achieves
  macro F1 of at least 0.80 across the six typed judgment categories, with at least
  30 positive and 30 negative examples available for each reported category.
- **SC-008**: 100% of core proxy, deterministic-policy, failure, sanitization, and
  audit conformance tests run successfully without TypeSafe credentials or network
  access to a semantic provider.
- **SC-009**: A new contributor following project documentation can run the keyless
  conformance suite and the no-semantic and deterministic-only benchmarks within
  15 minutes on a supported development machine.
- **SC-010**: A release-scope review finds all nine named exclusions absent and no
  documentation or benchmark output presenting v0.1 as a production security
  guarantee.

## Assumptions

- One configured upstream MCP server is supported per running gateway instance in
  v0.1; multiple instances may be used for multiple upstreams.
- The upstream tool catalog is captured for the gateway session. Automatic
  refresh and tool-list change notifications are part of the excluded dynamic
  discovery scope.
- `REVIEW` is intentionally non-forwarding in v0.1. A later human-approval system
  may consume the outcome but is not part of this feature.
- Provider-failure behavior is configurable among all three policy outcomes and
  defaults explicitly to `DENY`; configurations choosing `ALLOW` accept the
  associated research risk and remain visible in audit data.
- Audit events are handed to a configured local or process-level destination.
  Durable delivery, retention periods, search, and dashboards are external to
  v0.1, but emission failure remains observable.
- The labelled benchmark dataset contains synthetic or approved non-secret data,
  stable ground-truth labels, and enough balanced cases to calculate the required
  category metrics.
- Jev credentials are supplied only to the Jev integration boundary. They are
  never part of provider evaluation payloads, audit events, benchmark cases, or
  benchmark reports.
- Upstream tool results are returned without semantic inspection because response
  scanning is explicitly out of scope.
- MCP hosts and upstream servers used with v0.1 support the common tool listing and
  invocation behavior required by the conformance scenarios.
