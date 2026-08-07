# Tradeoffs and intentionally omitted work

This is a take-home implementation, not a production game service. Every
decision below picks a "boring," inspectable option over a more
scalable/production one, on purpose: a reviewer should be able to run this
in five minutes on a laptop with no external accounts, no cloud
provisioning, and no infrastructure to stand up first. The tradeoff is
consistent in one direction — favor reviewability and a short path to
"it runs" over anything that would need infrastructure this exercise
doesn't need.

## Persistence: SQLite over Postgres/a managed database

**Picked:** SQLite via EF Core, one file, created on first run.

**Not picked:** Postgres, or any server-based RDBMS.

**Why:** A reviewer running this locally would otherwise need to install
and start a database server, configure a connection string, and manage
its lifecycle around the app's own. That's real friction for a challenge
review, and none of it demonstrates anything about the actual skill being
assessed (combat rule correctness, concurrency handling, API design).
SQLite gets the same relational/transactional guarantees — the ACID
properties `SqliteCombatStore` actually depends on for atomic
snapshot+event+processed-command writes — with zero setup.

**What this costs:** SQLite serializes writes at the database level (see
`docs/architecture.md`'s "Why the store serializes writes" section) rather
than supporting true concurrent writers the way Postgres's MVCC does. For
a single-process API serving a handful of browser tabs in a review
session, that's not a real limitation. It would become one under real
concurrent load from many simultaneous encounters.

**The replacement seam:** `ICombatStore` is the actual persistence
contract; `SqliteCombatStore` is one implementation of it. Swapping in a
Postgres-backed implementation with row-level locking instead of
whole-database serialization is a new class behind the same interface,
not a rewrite of `CombatService` or anything above it. That seam existing
and being exercised by tests (not just declared) is the actual evidence
this tradeoff is safe to make.

## API shape: GraphQL over REST

**Picked:** A single GraphQL endpoint (Hot Chocolate, C#) for both the
character query and every combat command (mutations).

**Not picked:** A REST resource-per-verb API (`POST /api/briv/damage`,
etc.).

**Why:** The frontend needs one shaped read (character + HP + defenses +
history) that would otherwise require several REST round-trips or a
bespoke aggregation endpoint, and it needs several distinct write
operations (damage, heal, temp HP, dice, reset) that map naturally onto
mutations sharing one typed schema. GraphQL's introspection also gives a
reviewer a self-documenting API surface (`/graphql`'s IDE) instead of
needing separate API documentation to know what's callable.

**What this costs:** GraphQL adds a real dependency (Hot Chocolate) and a
schema-definition layer REST wouldn't need, and it's a less familiar
shape than REST for a reviewer skimming quickly. The mitigation is
architectural, not documentary: resolvers stay thin
(`EncounterLab.Api/GraphQL/Mutation.cs`) and delegate immediately to
`CombatService`, so the GraphQL layer is not where any reviewer needs to
look to find the actual combat rules — it's transport, not logic.

## Real-time sync: SignalR fan-out over polling or a raw WebSocket protocol

**Picked:** SignalR broadcasts a `combatEventCommitted` message after each
committed write; the browser reconciles.

**Not picked:** Client polling (repeatedly re-querying GraphQL), or a
hand-rolled WebSocket message protocol.

**Why:** Polling either wastes requests (poll fast) or feels laggy across
two browser tabs (poll slow) — bad for the exact "two clients converge"
demonstration this project is built to show. A raw WebSocket protocol
means hand-writing reconnect, message framing, and typed client bindings
that SignalR already provides. The real design decision worth stating
plainly: **SignalR is not a write path.** It only fires after
`SqliteCombatStore` has already committed a transaction (see the command
lifecycle in `docs/architecture.md`). A dropped or delayed broadcast can
never cause a client to see uncommitted state, because there's no such
thing as a broadcast of anything that hasn't already durably committed.

**What this costs:** A client that misses a broadcast (network blip,
backgrounded tab) needs to reconcile via a fresh snapshot fetch rather
than trusting the event stream alone — which `encounterMerge.ts` and
`useEncounterController.ts` implement, and which is exactly why "two
clients converge, and a disconnected client recovers automatically" is
in the demonstration path instead of being assumed to just work.

## Command safety: commandId + expectedVersion, not last-write-wins

**Picked:** Every mutation carries a `commandId` (idempotency) and an
`expectedVersion` (optimistic concurrency); the server rejects stale
writes and replays duplicate ones instead of applying them twice.

**Not picked:** Trusting the client's view of current state and applying
whatever it sends (last-write-wins).

**Why:** This is the one tradeoff on this page that isn't really
optional — a combat system where a retried request could double-apply
damage, or where a stale tab could silently overwrite a newer commit,
would be wrong, not just less scalable. The cost is real client-side
complexity (`useEncounterController.ts`'s pending-command reconciliation,
`encounterMerge.ts`'s stale-event rejection) that a last-write-wins
design wouldn't need — accepted because the alternative is an incorrect
combat system, not a simpler correct one.

## Dice-to-HP composition: two sequential commands, not one atomic action

**Picked:** The "Roll Damage" / "Roll Healing" / "Roll Shield" controls issue two
separate, fully authoritative commands in sequence — `rollDice`, then
`applyDamage` / `healCharacter` / `setTemporaryHitPoints`, using the roll's own
returned total and character version — instead of one server-side "roll and
apply" mutation.

**Not picked:** A combined mutation that rolls dice and applies the result to
HP inside a single transaction, emitting one event.

**Why:** Every other command in this system is already independently
idempotent and version-checked; a combined operation would mean inventing a
new event shape that mixes dice-roll and HP-outcome data, and a new
idempotency fingerprint scheme, for a case that the existing two commands
already handle correctly in sequence. The client isn't computing anything new
here — it relays an already-authoritative roll total as the requested amount
for a second already-authoritative command, exactly as it would relay a
manually typed number.

**What this costs:** No atomicity across the two steps. If the roll commits
and the follow-up command fails (or the browser closes in between), the roll
stands alone in the event history with no HP effect. This is visible rather
than silently wrong: the roll appears in the transcript, the follow-up
failure surfaces through the same command-error path as any other rejected
command, and the total is still on screen to resubmit. Real tabletop play has
the same two-step shape — you roll, then someone applies it — so this isn't a
compromise so much as an accurate model of what actually happened.

## No authentication or authorization

**Picked:** Nothing. Any client that can reach the API can act as Briv.

**Why:** This is a single-character combat-rules and sync demonstration,
not a multi-tenant application. Adding auth would mean inventing a user
model, a session/token scheme, and access-control rules that have no
actual requirement driving their shape — they'd be guessed, not derived
from a real need, which is exactly the kind of unrequested infrastructure
this project's own `AGENTS.md` says not to add. The domain and transport
layers don't assume a single global character, though: `characterId`
flows through the command/event/idempotency model already, so adding
auth later is additive (a middleware layer plus an ownership check)
rather than a redesign.

## No message bus / event streaming platform (Kafka, etc.)

**Picked:** SignalR's in-process hub fan-out, backed by SQLite's event
table as the durable log.

**Why:** A message bus earns its complexity when there are multiple
independent consumers, cross-service delivery guarantees to manage, or
throughput that a single process can't handle. None of that is true
here — there is one API process and a handful of browser clients. The
event table already gives durable, ordered history (`docs/architecture.md`'s
"Historical playback" section); a Kafka topic on top of that would
duplicate what SQLite already provides while adding a service a reviewer
would have to run.

## No microservices split

**Picked:** One modular monolith (`Domain` → `Application` →
`Infrastructure` → `Api`, one deployable), with `docker-compose.yml`
running exactly two containers (API, web).

**Why:** A microservices split earns its cost when different parts of a
system need independent scaling, independent deployment cadence, or
different teams owning different services. None of that applies to a
combat-rules demo. The internal layering already enforces the same
separation of concerns a service boundary would (domain logic cannot
reach persistence directly, the API cannot reach the database without
going through `CombatService`) — the modularity is real, it's just not
paid for with network hops, service discovery, or distributed-transaction
problems that a single-character demo has no need to solve.

## No production observability stack

**Picked:** Structured console logging and the `/api/health` endpoint.

**Not picked:** Distributed tracing, metrics aggregation, log shipping,
alerting, Redis-backed caching.

**Why:** Observability infrastructure is there to answer "what is
happening across many instances, over time, under real traffic" — none
of which exists in a local review session with one process and one
reviewer. `/api/health` answers the one question that actually matters
for this project's reviewer path: is the API up and did migrations run.
Redis specifically would earn its place as a shared cache or session
store across multiple API instances; there is one instance here, so
in-process state already does that job.

## No deployment hardening beyond `docker-compose up --build`

**Picked:** A two-container Compose file for local demonstration.

**Not picked:** Kubernetes manifests, a CDN/reverse-proxy layer, TLS
termination, horizontal scaling configuration, secrets management beyond
environment variables.

**Why:** None of this is reachable by a reviewer running the app locally,
and all of it depends on a real deployment target (which cloud, which
ingress, which secrets store) that doesn't exist for a take-home review.
Writing it anyway would be guessing at requirements nobody stated, for
infrastructure nobody will run.

## The 3D presentation layer, replay, and accessibility debug lab

These are the one category on this page that go **beyond** the stated
requirements rather than cutting corners inside them, so the tradeoff
runs the other way: is the extra surface area worth the review-time cost
of a reviewer having to distinguish "required" from "extension"?

**Why they're here anyway:** The frontend addendum asks for a usable
React UI; it doesn't ask for a 3D scene, a replay timeline, or an
accessibility preference lab. Building them demonstrates competence
beyond the minimum bar for a senior-level review, and they're
architecturally inert with respect to the actual requirement —
`tools/architecture-check.py` enforces that none of them can compute an
authoritative outcome, so removing all three tomorrow would not change a
single combat rule. `docs/scope.md` marks them explicitly as extensions
so a time-constrained reviewer can skip straight to the required-behavior
table without wading through presentation code first.

**What they cost:** Review time, and dependency surface (Three.js/React
Three Fiber, vendored CC0 GLB models — see `THIRD_PARTY_ASSETS.md`).
Accepted because the five-minute reviewer path in `README.md` never
routes through this code, so a reviewer who doesn't care about the 3D
scene never has to look at it to finish a full review.

## Not attempted: a full D&D rules engine, campaign builder, or asset marketplace

**Why not:** None of these were asked for, and each is a multi-month
scope on its own (full spell/condition/multiclass rules; persistent
campaigns with multiple encounters and DM tooling; a content pipeline
and storefront). Building any of them would be solving a problem this
exercise doesn't pose, at the direct cost of polish on the problem it
does pose. The domain model is intentionally narrow — one character,
the supplied damage/resistance/immunity/healing/temp-HP rules, and
server-side dice — because narrow and correct is worth more to a
reviewer than broad and shallow.
