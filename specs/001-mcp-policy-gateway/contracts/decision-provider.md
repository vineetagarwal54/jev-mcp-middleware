# DecisionProvider Contract

**Version**: 1

The provider boundary exposes semantic signals only. Implementations cannot return
a gateway policy outcome and cannot receive the original MCP request.

## Interface

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

interface SanitizedDecisionInput {
  readonly toolName: string;
  readonly toolDescription?: string;
  readonly arguments?: Readonly<Record<string, JsonValue>>;
}

interface RiskSignals {
  readonly destructive: number;
  readonly externalConsequence: number;
  readonly sensitive: number;
  readonly irreversible: number;
  readonly highImpact: number;
  readonly humanReview: number;
}

type ProviderStatus =
  | "SUCCESS"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "INVALID"
  | "ABORTED";

interface ProviderEvaluation {
  readonly provider: string;
  readonly status: ProviderStatus;
  readonly signals?: RiskSignals;
  readonly latencyMs: number;
  readonly requestId?: string;
  readonly model?: string;
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  readonly reasonCode?: string;
}

interface DecisionProvider {
  readonly id: string;
  evaluate(
    input: SanitizedDecisionInput,
    options: { readonly signal: AbortSignal },
  ): Promise<ProviderEvaluation>;
}
```

## Invariants

- `SanitizedDecisionInput` is validated with a strict runtime schema before the
  provider is invoked. Unknown top-level fields are rejected.
- All successful signal values are finite numbers in the inclusive range 0..1.
- `signals` is present if and only if `status` is `SUCCESS`.
- A provider implementation normalizes its expected transport, timeout, abort,
  authentication, and response-validation failures into a non-success evaluation.
  It never converts failure directly into `ALLOW`, `REVIEW`, or `DENY`.
- Unexpected programming defects may reject the promise, but the router catches
  them, emits a sanitized `INVALID` provider result, and applies configured
  failure policy. Raw exception text never enters audit data or client responses.
- Implementations do not log or persist provider input. Instrumentation receives
  only correlation-free latency, status, model, request ID, and usage summaries.
- The TypeSafe credential is private to `JevDecisionProvider` transport setup. It
  is not a field in this interface and cannot enter `input` or `ProviderEvaluation`.

## JevDecisionProvider Mapping

One TypeSafe System One request carries the sanitized input as `state` and six
independent Noul questions. Answer mappings are exact:

| Question ID | `RiskSignals` field |
|-------------|---------------------|
| `destructive` | `destructive` |
| `external_consequence` | `externalConsequence` |
| `sensitive` | `sensitive` |
| `irreversible` | `irreversible` |
| `high_impact` | `highImpact` |
| `human_review` | `humanReview` |

The implementation validates the returned model, answers, probability bounds, and
usage data with Zod before it constructs `ProviderEvaluation`. TypeSafe answer text
or reasoning is not persisted in v0.1.

## MockDecisionProvider Behavior

The mock accepts an ordered script of evaluations or typed failures. Each call
records only the sanitized input it received and consumes one script entry. Tests
can assert call count and exact sanitized input. The mock supports abort and an
injected clock; it performs no network or environment access.

## Compatibility Rule

A future LLM provider may implement this interface, but it must produce the same
six bounded signals and failure statuses. Adding provider-specific fields to the
shared interface requires a contract version change; provider metadata belongs in
an implementation-owned diagnostic object that is not consumed by policy.
