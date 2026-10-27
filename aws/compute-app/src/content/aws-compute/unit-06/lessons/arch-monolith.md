# Monolith architecture

**Prerequisite:** Workload characterization. **Sources:** [Modern applications strategy](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/modern-apps-strategy-on-aws-how-to-choose.html), [Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/).

## Learning objectives
- Distinguish deployment unit, process boundaries, and domain boundaries.
- Explain when one deployable application is an advantage.
- Identify coupling and scaling limits with evidence.

## Problem

Every product needs modules, data ownership, and deployment. Splitting one codebase into network services too early creates serialization, retries, distributed tracing, and data consistency problems before independent scaling or ownership has value. Keeping every feature tightly coupled creates change risk and slows delivery. “Monolith” alone does not tell us whether internal boundaries are good.

## First principles: process and transaction boundaries

A monolith is an application deployed as one unit; it may contain well-separated modules. A modular monolith has explicit internal interfaces and dependency rules even though modules share a process and often a deployment. A microservice is an independently deployed networked service with its own runtime and failure boundary. These terms describe deployment and ownership; they do not automatically define domain quality.

In one process, function calls are cheap, typed, and may share a DB transaction. Across services, a call adds network latency, serialization, authentication, partial failure, timeout, retry, and version compatibility. A local DB transaction cannot atomically include an HTTP call to another service. That difference is a real engineering cost.

### Teen alag boundaries ko separate rakho

Design discussion mein “service boundary” bolkar teen alag choices ko ek saath mat milaao:

1. **Code boundary:** kaunse functions aur tables ek module own karta hai?
2. **Process boundary:** code same address space mein run karta hai ya alag process mein?
3. **Deployment boundary:** code ek unit ke roop mein release hota hai ya independently?

Monolith mein code modules clear ho sakte hain, par process aur deployment shared hote hain. Microservice mein deployment independent hota hai aur usually process/network boundary bhi aati hai. Lekin repo split karna service split nahi hota; aur ek repo se kai services build ho sakti hain. Boundary ko ownership, runtime, data, aur release ke terms mein describe karo.

### Local function call ka hidden advantage

Ek application transaction mein reservation row insert ho sakti hai, capacity row lock ho sakti hai, aur payment intent record ho sakta hai. Agar in tables ka owner same application hai, local transaction ek commit/rollback decision de sakti hai. Same behavior ko do services mein baantne par tumhein saga, reservation timeout, duplicate message, compensation, aur reconciliation define karna padega. Ye sab solvable hain; free nahi hain.

Network hop par remote response na aana ambiguous hota hai: request server tak pahunchi ya nahi? Server ne kaam complete karke response kho diya? Client retry kare to duplicate write hoga? Local function call mein process crash ho sakta hai, par in-between distributed acknowledgement problem nahi hoti. Monolith failure-free nahi; failure modes ka set chhota hota hai.

Ek modular monolith ke andar bhi modules ko enforce karo. `reports` module `billing` ki private tables ko direct query na kare. Uske badle `billing` module ka function interface ya domain event use kare. Agar kal process split karna pade, ye interface contract ka starting point hoga. Lekin database table shared rehne tak data ownership abhi bhi shared hai.

## Internal architecture and lifecycle

HTTP request → routing/controller → application use case → domain module → repository → database → response. Keep dependencies pointing inward: transport adapts to application logic; domain rules avoid importing web frameworks. Modules communicate through explicit interfaces and events. A single process still needs timeouts on external calls, idempotent job handling, observability, and graceful deploys.

### Worked example

A property-screening API has user, report, document, and billing features. Start with modules in one deployable service and separate tables/functions by ownership. Generate report asynchronously using a durable job record and queue. If report CPU becomes a bottleneck, extract worker deployment first while leaving synchronous domain operations local. If billing later needs independent compliance ownership, define an API/event contract and data migration; do not share its tables indefinitely.

### Quantitative walkthrough

Suppose one app handles 350 RPS. CPU-heavy report generation uses 80 ms CPU per request; normal reads use 4 ms, and reports make up 8%. Approximate CPU-seconds/s: `350 × (0.08×0.08 + 0.92×0.004) ≈ 3.53`. If reads and reports share a process, bursty report work competes with reads. Separate worker pool can isolate capacity without requiring every business module to become a service. Measure tail latency and queue age; average CPU alone does not establish the right boundary.

Is number ko production sizing mat samjho. Iska use reasoning ke liye hai. CPU-seconds/s core demand ka rough estimate deta hai, par garbage collection, database wait, lock contention, container CPU shares, burst distribution, and p95/p99 latency is estimate ko change karte hain. Load test mein normal request aur report job dono ek saath chalao. Sirf average CPU dekha to report queue ke karan API ka p99 miss ho sakta hai, jabki average low dikh raha ho. Calculation ko do terms mein todkar verify karo: report demand `350 × 0.08 × 0.08 = 2.24 CPU-seconds/s`; read demand `350 × 0.92 × 0.004 = 1.288`; total `3.528`.

## Working implementation

```text
src/
  modules/reports/{api.ts,service.ts,repository.ts}
  modules/users/{api.ts,service.ts,repository.ts}
  app.ts
```

Enforce import rules in lint/build. Keep report API calling a use-case interface, not direct SQL from route handlers. A local modular boundary makes later extraction cheaper but does not make extraction free: data ownership and network contracts still need design.

Suggested dependency direction:

```text
HTTP route -> application use case -> domain module -> repository interface
                                           |                    |
                                           +-> outbox event      +-> database adapter
```

Route sirf transport parsing, auth context, status code, aur response mapping kare. Use case business operation coordinate kare. Domain invariant `reservation can be confirmed only if capacity remains` ek jagah enforce ho. Repository interface testable boundary de; adapter SQL handle kare. Outbox event same transaction mein likho, taaki database commit ke baad process crash ho to event silently lost na ho. A separate publisher outbox rows ko SQS ya EventBridge tak bheje; consumer idempotent ho.

```ts
type CreateReservation = {
  userId: string;
  slotId: string;
  idempotencyKey: string;
};

export async function createReservation(input: CreateReservation) {
  return database.transaction(async tx => {
    const prior = await tx.reservations.findByKey(input.idempotencyKey);
    if (prior) return prior;

    const slot = await tx.slots.lockAndRead(input.slotId);
    if (!slot || slot.remaining < 1) throw new CapacityUnavailable();

    const reservation = await tx.reservations.insert({
      userId: input.userId,
      slotId: input.slotId,
      idempotencyKey: input.idempotencyKey,
    });
    await tx.slots.decrement(input.slotId);
    await tx.outbox.insert({ type: 'reservation-created', reservationId: reservation.id });
    return reservation;
  });
}
```

This example needs database-level unique constraints and careful isolation. `findByKey` alone has a race: two requests can both see no row. Unique constraint on `idempotencyKey` is the final guard; translate its conflict into the prior result. Locking the slot may serialize popular inventory. If contention is high, evaluate an atomic conditional update and its affected-row count. Interview mein framework code se zyada invariant aur concurrent-request behavior explain karo.

## AWS deployment: one app, one region, clear modules

Modular monolith ke liye initial AWS path simple ho sakta hai: Route 53 or another DNS provider → ALB HTTPS listener → ECS service tasks across two or three Availability Zones → RDS PostgreSQL Multi-AZ deployment → S3 for documents. Task IAM role object access allow kare; execution role image pull and log delivery allow kare. Secrets Manager se DB secret fetch karo. SQS background report jobs ko hold kare, aur separate ECS worker service usi image ke worker command ke saath run kare.

Same image ke API aur worker process alag ECS services mein run ho sakte hain. Isse report workload independently scale hota hai, while code and deployment can still be coordinated. Agar later worker deployment independent banani ho, image build pipeline aur migration compatibility define karni hogi. Is step ko “microservices” kehna zaroori nahi; ye process-level resource isolation hai.

CI/CD sequence: build one immutable image → scan and tag by digest → deploy a canary task or small ECS deployment → health check and smoke test → increase traffic → observe error rate, p95, queue age, and database connection count → rollback to prior task definition if guardrail fails. Schema migration expand-contract pattern use kare: pehle backward-compatible new schema, phir code, phir old column cleanup. Agar code aur schema ek hi step mein incompatible change karein, rollback bhi fail ho sakta hai.

AWS mapping responsibility hatati nahi. ECS service desired task count maintain karti hai; tum task health path, CPU/memory request, deployment limits, IAM, secret flow, and alarm define karte ho. RDS Multi-AZ availability behavior deta hai, par slow query, connection pool exhaustion, schema lock, aur application retry behavior tumhare ownership mein hain. SQS duplicate delivery possible hai; worker output idempotent hona chahiye. ALB target healthy hone ka matlab sirf configured health check pass hua; business correctness ya DB capacity guarantee nahi.

Compute boundary ke alternate roop: API Gateway + Lambda tab evaluate karo jab handler execution model, latency, payload, networking, concurrency, and database access fit ho. ECS Express Mode current AWS path hai jo ECS/Fargate service, ALB, health checks, and scaling setup simplify kar sakta hai; exact generated choices inspect karo. EKS tab choose karo jab Kubernetes API/ecosystem, organizational platform, or workload needs justify karein. Service name ke bajay ownership, deployment, scale, and dependency path compare karo.

## Alternatives and decision boundary

Keep monolith when one team deploys together, transactions span modules, and measured scale is manageable. Extract a worker or read model when resource/latency isolation is needed. Use microservices when teams need independent release/ownership and can operate distributed failure paths. Use event-driven flow for work that can be asynchronous; do not introduce event buses for synchronous invariants without need.

Useful extraction signal vague phrase `team badi ho gayi` nahi. Measure a specific pain: report CPU starves latency-sensitive reads; deploy approval blocks two teams with separate release needs; one module needs a different scaling profile; or one data boundary needs separate access and retention policy. Pehle aisi change process boundary solve kar sakti hai ya nahi dekho. Separate worker queue, independent ECS service, read replica, or scheduled job often smaller correction hai.

Microservice split ka operational budget bhi likho: on-call ownership, dashboards, alert routing, deployment pipeline, service authentication, schema evolution, retry budget, trace propagation, and local developer workflow. Agar ek endpoint five synchronous services call karta hai, worst-case latency roughly in series sum hota hai; parallel calls ka latency slowest branch se bounded hota hai, par failure semantics more complex hote hain. Timeout budget propagate karo; har hop par independent 30-second timeout rakhna end-to-end request ko 150 seconds tak latka sakta hai.

## Tradeoffs and failure analysis

One deployable unit makes integration tests and transactions simpler but couples release blast radius and scale. Bad internal boundaries create cyclic dependencies and shared-table writes. A monolith with unclear ownership can become harder to change than a small service system. Conversely, premature service splits create N+1 network calls, duplicated data, cascading failures, and incident ambiguity.

Two investigations:

1. **Read p99 rises during report batch.** Compare request traces, CPU run queue, memory, DB wait, and worker counts. If CPU and queue contention are local, isolate report execution or add async queue; if DB lock contention dominates, service split may not help.
2. **Deploy regression affects all endpoints.** Correlate error rate with release ID. Use rollback and add module-level tests/feature flags. A service split would reduce blast radius only if deploy and dependency boundaries actually change.

3. **One module needs a new data store.** Pehle read/write ownership, transaction requirement, migration order, and backfill behavior define karo. Shared database mein new table add karna low-risk ho sakta hai. Same record do databases mein independently write karna dual-write problem create karta hai. Use a controlled backfill, change data capture or outbox, consistency check, and explicit cutover. Dono stores ko write karna temporary ho to reconciliation alarm lagao.

4. **A report worker retries a message.** Queue duplicates ya visibility timeout ke baad parallel processing possible hai. Job ID ko idempotency key banao, output object version deterministic rakho, aur completion state durable store karo. Worker timeout visibility timeout se chhota hona chahiye ya worker heartbeat extend kare. Poison input ko bounded retries ke baad DLQ mein bhejo; DLQ mein count dekhna alone recovery nahi, replay owner and procedure bhi define karo.

### Hypothetical incident review: service split for a database bottleneck

Team report generation ko alag service bana deti hai, kyunki API p99 database query ke time badhta hai. Split ke baad bhi dono services same PostgreSQL CPU and lock table use karti hain. Network hop aur deployment ownership add hua, par bottleneck same raha. Better initial test: query plan, lock waits, connection pool queue, transaction duration, and report query isolation compare karo. Agar report read workload DB ko saturate kar raha hai, read replica, precomputed report, separate worker admission limit, or query redesign test karo. New service tab useful hai jab execution/capacity boundary alag karna actual pressure ko isolate kare.

Ye example hypothetical hai; kisi specific company ka postmortem nahi. Architecture answer mein invented case ko published incident bolkar cite mat karo.

## Production checklist

- Define module API and data ownership even in one process.
- Measure endpoint resource profile before splitting.
- External work uses timeout, backoff, idempotency, and tracing.
- Design rollback and schema-compatible migrations.
- Expose endpoint latency and error rate by module or operation.
- Bound worker concurrency against database and third-party quotas.
- Name the owner for DLQ replay, schema rollout, and rollback decisions.

## Practical exercise

Design a report API and worker using one modular app. Show module boundaries, synchronous call graph, queue path, DB tables, deploy plan, and one future extraction trigger.

### Interview defense drill

Interviewer: “A single deploy has a large blast radius. Why not make six microservices?” Start by agreeing that shared release can create risk, then ask which modules have independent owners and release needs. If all six teams still share one schema and one on-call rotation, six network services may not create true ownership. Propose module import rules, endpoint-level rollback or canary, and one worker service with separate capacity. Then state the trigger to extract a business capability: its team can own data, API contract, SLO, and deploy without coordinated release.

Follow-up: “Traffic grows 20×. Which module do you split?” Ask what resource is limiting: CPU, memory, database, external API quota, or queue age. If image generation consumes CPU but API reads are healthy, isolate generator workers and scale by queue age. If DB lock contention dominates all endpoints, splitting processes likely changes nothing. If one module needs GPU, move that workload to a suitable compute pool and define input/output boundary. Recommendation follows measurement.

Follow-up: “One release must update reservation and payment logic.” Describe a backward-compatible deployment and idempotent workflow. Keep the transaction invariant inside one database boundary if required. If payment provider call is external, record an intent/outbox event in the transaction, process payment asynchronously with an idempotency key, and expose pending/failure state. Do not claim a distributed transaction across PostgreSQL and the provider.

Strong answer order: clarify requirements → name deployment/process/data boundaries → sketch read/write paths → calculate the measured bottleneck → state failure and rollback behavior → explain why the more complex split earns its cost → name the measurement that would change the decision.

## Exercise checks
- Monolith is not equated with poor modularity.
- Async worker extraction is considered before full microservices.
- Failure and data ownership are concrete.

## Quick reference

- One deployable unit is a runtime choice, not a domain model.
- Process boundary avoids network failure modes; it does not remove internal coupling.
- Extract for measured ownership, scaling, or isolation need.
