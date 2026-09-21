# Phase 0 Research: MCP Policy Gateway v0.1

**Date**: 2026-09-20

All technical unknowns from the implementation plan are resolved below. Sources
are primary project documentation or repositories current at the research date.

## Runtime and Module System

**Decision**: Standardize development, CI, and containers on Node.js 24 LTS,
declare `engines.node` as `>=24 <25`, and use ESM with TypeScript `NodeNext`
module and resolution settings. Pin the exact Node 24 patch in reproducible
environments.

**Rationale**: Node 24 is the active LTS line, satisfies the current MCP SDK,
TypeSafe SDK, Vitest, and SQLite driver requirements, and avoids a known abort
regression observed with the TypeSafe SDK on Node 20/22.

**Alternatives considered**: Node 22 has less remaining support life and retains
the TypeSafe cancellation risk. Node 26 remains Current rather than LTS at the
research date.

**Sources**: [Node release status](https://nodejs.org/en/about/previous-releases),
[Node packages](https://nodejs.org/api/packages.html),
[TypeScript TSConfig](https://www.typescriptlang.org/tsconfig/).

## Official MCP SDK and Protocol Line

**Decision**: Use the official stable v2 packages
`@modelcontextprotocol/server@2.0.0` and
`@modelcontextprotocol/client@2.0.0`, targeting MCP 2026-07-28. Add
`@modelcontextprotocol/node` only if an HTTP transport is implemented later.

**Rationale**: v2 is the stable package line and separates server/client concerns.
The gateway needs both roles. The older monolithic `@modelcontextprotocol/sdk`
targets the previous protocol generation and is not appropriate for a new v0.1.

**Alternatives considered**: The v1 monolithic SDK remains temporarily maintained
but would start the project on a compatibility line already superseded for new
development.

**Sources**: [server package](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/server/README.md),
[package guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/get-started/packages.md),
[v2 migration](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md),
[SDK roadmap](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/ROADMAP.md).

## MCP Gateway Shape and Transports

**Decision**: Build the downstream side with the low-level SDK `Server`, registering
`tools/list` and `tools/call` handlers. Serve downstream stdio with `serveStdio`.
Connect upstream with the SDK `Client` and `StdioClientTransport`. v0.1 supports
one stdio upstream and one downstream stdio session. Small transport factories
construct official SDK transports directly; no custom transport abstraction is
introduced.

**Rationale**: The low-level server can relay arbitrary upstream JSON Schema tool
definitions, while the high-level server API is optimized for statically authored
tools. `serveStdio` negotiates both current protocol eras. Limiting v0.1 to stdio
keeps scope small while preserving a clear place to add official HTTP transports.

**Alternatives considered**: High-level `McpServer.registerTool` would require
re-authoring arbitrary tools. Streamable HTTP and legacy SSE add runtime and test
surface without a v0.1 requirement.

**Sources**: [v2 migration](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md),
[protocol support](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28.md),
[client connections](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/clients/connect.md),
[tools specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/tools.mdx).

## Tool Validation and Proxy Errors

**Decision**: Cache upstream tool definitions at startup, compile each advertised
`inputSchema` with Ajv, and validate tool arguments before policy evaluation.
Return sanitized `CallToolResult` values with `isError: true` for `DENY`, `REVIEW`,
and safely mapped gateway failures. Forward the exact tool name and original
arguments only after `ALLOW`; return the upstream `CallToolResult` unchanged.

**Rationale**: The low-level MCP server validates protocol envelopes but does not
enforce arbitrary relayed tool input schemas. Ajv validates JSON Schema directly;
Zod remains responsible for application-owned configuration and provider data.
Tool-result errors are visible to MCP hosts without leaking exception details.

**Alternatives considered**: Converting arbitrary upstream schemas to Zod is lossy
and unnecessary. Forwarding thrown exceptions risks exposing transport or provider
details. Protocol-level errors remain appropriate only for malformed MCP requests,
not policy outcomes.

**Sources**: [wire schemas](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/advanced/wire-schemas.md),
[server errors](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/servers/errors.md),
[client calling examples](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/examples/guides/clients/calling.examples.ts).

## TypeSafe Jev Integration

**Decision**: Use exact-pinned `@typesafe-ai/sdk@0.6.0` behind
`JevDecisionProvider`. Send one request containing six independent Noul questions
for destructiveness, external consequence, sensitivity, irreversibility, unusual
impact, and human-review appropriateness. Disable SDK request-body logging,
configure timeout/retry explicitly, and validate the normalized response with Zod.

**Rationale**: The official SDK clearly improves on native fetch by providing
typed question/result inference, auth handling, timeouts, cancellation, retries,
error taxonomy, request identifiers, and injectable fetch/logger behavior. Atomic
Noul questions return comparable 0..1 probabilities while deterministic policy
retains final authority. Runtime validation is still required because successful
response parsing is not fully schema-validated by the SDK.

**Alternatives considered**: Native fetch avoids a dependency but duplicates auth,
retry, timeout, error, and primitive handling. It remains a local fallback because
the provider interface isolates the integration. One broad Choice question would
entangle independent risk dimensions.

**Sources**: [official SDK](https://github.com/typesafe-ai/typesafe-sdk-js),
[JavaScript documentation](https://docs.typesafe.ai/sdk/javascript),
[API reference](https://docs.typesafe.ai/api),
[Noul primitive](https://docs.typesafe.ai/primitives/noul),
[building with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one),
[SDK cancellation issue](https://github.com/typesafe-ai/typesafe-sdk-js/issues/2).

## Provider Authentication and Secret Boundary

**Decision**: Read the TypeSafe credential from the `TYPESAFE_API_KEY` environment
variable only inside `JevDecisionProvider`; do not persist it or expose it through
configuration objects, logs, provider state, or audit records. The SDK may use the
credential solely as transport authentication. Evaluated state contains only the
sanitized DTO `{ toolName, toolDescription, arguments }`.

**Rationale**: This separates the provider's own required authentication metadata
from intercepted MCP data. No MCP authorization header, credential, environment
value, upstream configuration, original request object, or arbitrary header is
sent as evaluated content.

**Alternatives considered**: Storing the key in YAML risks accidental persistence.
Allowing arbitrary SDK headers expands the exfiltration surface. SDK debug logging
can reveal request bodies and is disabled.

**Sources**: [SDK client](https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/main/src/client.ts),
[SDK logging](https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/main/src/logging.ts),
[SDK types](https://raw.githubusercontent.com/typesafe-ai/typesafe-sdk-js/main/src/types.ts).

## Configuration

**Decision**: Parse a single YAML 1.2 document with `yaml` v2, reject parser errors
and unsafe alias expansion, convert to plain data, then validate the entire object
with strict Zod 4 schemas. Unknown keys, missing values, and invalid enums fail
startup. Environment variables supply secrets only.

**Rationale**: YAML meets the operator requirement, while Zod provides one typed
runtime boundary. Failing at startup prevents hidden defaults from changing policy
behavior during a call.

**Alternatives considered**: `js-yaml` provides less document/error inspection.
Environment-only configuration is harder to review and reproduce. Multiple merged
configuration sources create unclear precedence.

**Sources**: [`yaml` documentation](https://eemeli.org/yaml/),
[Zod documentation](https://zod.dev/).

## SQLite Audit Persistence

**Decision**: Use `better-sqlite3` behind one focused `AuditRepository`. Enable
foreign keys, WAL for file databases, and a bounded busy timeout. Apply ordered,
checksummed migrations atomically and use prepared inserts. Unit tests use fresh
in-memory databases; integration tests use isolated temporary files to cover WAL
and reopen behavior.

**Rationale**: Node 24's built-in `node:sqlite` remains release-candidate quality.
`better-sqlite3` is mature, has a simple synchronous transaction API, and fits the
small, append-oriented local audit workload. Driver types remain confined to the
repository so later migration is local.

**Alternatives considered**: `node:sqlite` can replace the driver after reaching
stable status. External databases and Redis violate v0.1 scope. An ORM adds schema
and abstraction overhead without a current need.

**Sources**: [Node 24 SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html),
[`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3),
[SQLite transactions](https://www.sqlite.org/lang_transaction.html).

## Logging and Audit Delivery

**Decision**: Use Pino JSON logging directed to stderr because stdout is reserved
for MCP stdio protocol traffic. Construct only explicit sanitized log objects,
apply Pino removal rules for known sensitive paths as defense in depth, and attach
correlation identifiers with child loggers. Persist the canonical audit event to
SQLite; log persistence failures as sanitized operational errors.

**Rationale**: Structured stderr logs remain observable without corrupting the MCP
transport. Sanitization before logging is authoritative; logger redaction protects
against accidental field additions.

**Alternatives considered**: Pino's default stdout destination would corrupt stdio
MCP messages. Pretty logging is limited to an explicit local-development command.
Persisting arbitrary log objects would make the audit schema unstable.

**Sources**: [Pino redaction](https://github.com/pinojs/pino/blob/main/docs/redaction.md),
[Pino API](https://github.com/pinojs/pino/blob/main/docs/api.md),
[MCP stdio guidance](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/get-started/first-server.md).

## Testing Strategy

**Decision**: Use Vitest with isolation enabled. Unit-test sanitization, policies,
provider mapping, configuration, repositories, and benchmark metrics. Use official
SDK in-memory/handler transports where protocol-era appropriate, plus subprocess
stdio integration tests for the production path. Every test owns its mock provider,
fake upstream, clock/ID source, and SQLite database.

**Rationale**: Keyless deterministic tests prove the security-sensitive boundary.
Subprocess tests catch stdout contamination and lifecycle errors that in-memory
tests cannot. Fixed seeds and fake timers keep failure/benchmark tests stable.

**Alternatives considered**: Network-only tests are slower and flaky. Only mocking
the router cannot prove that denied calls never reach an upstream MCP server.

**Sources**: [Vitest guide](https://vitest.dev/guide/),
[Vitest isolation](https://main.vitest.dev/config/isolate),
[timer mocking](https://vitest.dev/guide/mocking/timers),
[MCP protocol support tests](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28.md).

## Docker and CI

**Decision**: Use a digest-pinned Node 24 Debian slim multi-stage image, `npm ci`,
compiled output plus production dependencies only, the non-root `node` user, and a
mounted audit-data directory. GitHub Actions uses SHA-pinned actions and separate
fail-fast lint, typecheck, test, build, and Docker-build steps on Node 24.

**Rationale**: Debian avoids Alpine/native-addon friction with SQLite. Lockfile
installs, immutable action references, and image builds make local and CI execution
reproducible. Pull-request jobs require no TypeSafe credential.

**Alternatives considered**: Alpine is smaller but adds musl/native binding risk.
Installing dependencies without the lockfile weakens reproducibility. CI calls to
Jev would violate keyless core testing and expose secrets to untrusted changes.

**Sources**: [Docker build practices](https://docs.docker.com/build/building/best-practices/),
[multi-stage builds](https://docs.docker.com/build/building/multi-stage/),
[`setup-node`](https://github.com/actions/setup-node/blob/main/README.md),
[`npm ci`](https://docs.npmjs.com/cli/commands/npm-ci),
[GitHub action SHA policy](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).
