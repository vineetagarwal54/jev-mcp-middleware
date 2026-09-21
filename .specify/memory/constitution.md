<!--
Sync Impact Report
- Version change: unversioned template -> 1.0.0
- Modified principles: N/A (initial ratification)
- Added principles:
  - I. Semantic Signals, Not Security Authority
  - II. Deterministic Policy Owns Decisions
  - III. Hard Rules Take Precedence
  - IV. Denial Is a Non-Forwarding Guarantee
  - V. Failure Behavior Is Explicit
  - VI. Decision Providers Are Pluggable
  - VII. Protocol Tests Are Keyless
  - VIII. Secrets Never Reach Semantic Providers
  - IX. Research Tooling, Not a Security Guarantee
  - X. v0.1 Scope Is Deliberately Small
  - XI. Strict, Focused TypeScript
  - XII. Every Phase Has Quality Gates
- Added sections:
  - Security, Protocol, and Scope Constraints
  - Development Workflow and Quality Gates
- Removed sections: placeholder principle and section slots
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ✅ .specify/templates/commands/*.md (directory absent; no update required)
- Runtime guidance reviewed: no README.md, docs/quickstart.md, or agent guidance file present
- Follow-up TODOs: none
-->
# jev-mcp-middleware Constitution

## Core Principles

### I. Semantic Signals, Not Security Authority
Jev and every other semantic evaluator MUST provide advisory signals, supporting
evidence, or scores only. A semantic provider MUST NOT be treated as the final
security authority and MUST NOT directly authorize or block an MCP tool call.
This boundary prevents probabilistic output from becoming an implicit access
control decision.

### II. Deterministic Policy Owns Decisions
Deterministic, locally testable policy code MUST produce the final `ALLOW`,
`REVIEW`, or `DENY` outcome. The mapping from provider signals and request context
to that outcome MUST be explicit, version-controlled, and reproducible. Identical
inputs and configuration MUST produce identical policy decisions.

### III. Hard Rules Take Precedence
Hard policy rules MUST be evaluated as authoritative constraints and MUST take
precedence over semantic judgments. A provider recommendation MUST NOT weaken,
bypass, or override a hard rule. Tests MUST cover conflicts between hard rules
and semantic signals and prove that the hard-rule outcome wins.

### IV. Denial Is a Non-Forwarding Guarantee
A tool call with a final `DENY` outcome MUST NOT reach the upstream MCP server.
The proxy MUST short-circuit the request before any upstream invocation or side
effect. Integration tests using a fake upstream server MUST prove non-forwarding,
not merely assert that a denial response was returned.

### V. Failure Behavior Is Explicit
Jev and other provider failures MUST follow an explicit, configurable failure
mode. Supported behavior and defaults MUST be documented, typed, audited, and
tested. The middleware MUST NOT silently infer, change, or fall back to an
`ALLOW`, `REVIEW`, or `DENY` behavior.

### VI. Decision Providers Are Pluggable
Semantic evaluation MUST sit behind a `DecisionProvider` interface. Jev, static
rules, mocks, and LLM baselines MUST be substitutable without changing proxy or
policy semantics. Provider-specific transport, credentials, and response parsing
MUST remain outside deterministic policy modules so implementations can be
compared through the same contract.

### VII. Protocol Tests Are Keyless
Core MCP proxy, policy, audit, and failure behavior MUST be testable without a
TypeSafe API key or any external semantic service. Contract and integration tests
MUST use fake MCP servers and a mock `DecisionProvider` to exercise allowed,
reviewed, denied, malformed, timeout, and provider-failure paths deterministically.

### VIII. Secrets Never Reach Semantic Providers
Secrets, authorization headers, environment variables, credentials, and raw
configuration values MUST NOT be sent to Jev or any other semantic provider.
Provider input MUST be constructed from an explicit allowlist of sanitized fields.
Tests MUST verify both included fields and prohibited-field omission at the
provider boundary.

### IX. Research Tooling, Not a Security Guarantee
The initial release MUST be described as developer tooling and research
infrastructure, not as a production security boundary or guarantee. Documentation,
examples, and benchmarks MUST state this limitation and MUST NOT make unsupported
claims about attack prevention, safety, or production readiness.

### X. v0.1 Scope Is Deliberately Small
Version 0.1 MUST focus on MCP proxying, deterministic policy, semantic evaluation,
audit logging, and benchmarking. Dashboards, enterprise RBAC, token optimization,
and multi-tenant SaaS capabilities are out of scope. Any proposal to add an
excluded capability requires a constitutional amendment or deferral to a later
release before implementation begins.

### XI. Strict, Focused TypeScript
Production and test code MUST use TypeScript strict mode, explicit boundary types,
and small modules with one focused responsibility. Policy and proxy boundaries
MUST have direct tests. Unchecked casts, broad untyped payloads, and modules that
mix provider transport, policy evaluation, and upstream forwarding require
documented justification and review.

### XII. Every Phase Has Quality Gates
Every implementation phase MUST pass its relevant automated tests and the full
TypeScript type check before work proceeds to the next phase. Failures MUST be
fixed; they MUST NOT be ignored, muted, or deferred across a phase boundary.
Plans and task lists MUST include these gates explicitly.

## Security, Protocol, and Scope Constraints

- The MCP request and response lifecycle MUST preserve protocol identifiers,
  ordering, error semantics, and transport behavior unless an explicit middleware
  policy outcome requires a documented response substitution.
- Policy evaluation MUST occur before upstream dispatch. Audit records MUST capture
  the final outcome, applicable hard rule, provider status, configured failure
  mode, and correlation metadata without capturing prohibited secrets.
- Provider payloads MUST be minimal and allowlisted. Adding any provider-visible
  field requires a documented need and a test proving sensitive fields are absent.
- Benchmarks MUST exercise providers through the `DecisionProvider` contract and
  report enough configuration to make comparisons reproducible.
- v0.1 work MUST remain within the scope defined by Principle X. Scope exclusions
  are constraints, not backlog requirements implied by this constitution.

## Development Workflow and Quality Gates

1. Each feature specification MUST identify affected MCP flows, deterministic
   rules, provider inputs, explicit failure behavior, audit effects, and scope fit.
2. Each implementation plan MUST demonstrate how hard-rule precedence, denial
   short-circuiting, secret minimization, and provider substitution remain intact.
3. Tasks MUST include tests at the policy and proxy boundaries. Features affecting
   forwarding MUST use a fake upstream server; features affecting evaluation MUST
   use a mock provider and cover provider failure behavior.
4. At the end of every phase, the relevant test suite and full type check MUST pass
   before the next phase begins. The command results are review evidence.
5. Reviews MUST reject behavior that grants semantic providers final authority,
   forwards denied calls, leaks prohibited data, hides failure defaults, weakens a
   hard rule, or expands v0.1 beyond its ratified scope.

## Governance

This constitution supersedes conflicting project practices, plans, specifications,
and task lists. Amendments require a documented proposal, rationale, impact on
existing behavior and templates, migration steps when applicable, and approval by
the project maintainers before dependent implementation proceeds.

Constitution versions follow semantic versioning: MAJOR for incompatible governance
or principle removals and redefinitions, MINOR for new principles or materially
expanded obligations, and PATCH for non-semantic clarifications. Every amendment
MUST update the version, amendment date, and Sync Impact Report.

Every feature plan and code review MUST verify constitutional compliance. Any
non-compliance MUST be resolved or approved through a constitutional amendment
before merge. Release reviews MUST confirm that tests and type checking pass, v0.1
scope remains bounded, documentation preserves the research-tooling disclaimer,
and audit output contains no prohibited secrets.

**Version**: 1.0.0 | **Ratified**: 2026-09-20 | **Last Amended**: 2026-09-20
