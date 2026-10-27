# Lambda observability, versions, aliases, and safe deployment

**Prerequisite:** Lambda configuration, concurrency, and event-source behavior. **Sources:** [Monitoring Lambda functions](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-functions.html), [Lambda versions](https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html), [Lambda aliases](https://docs.aws.amazon.com/lambda/latest/dg/configuration-aliases.html), [Lambda deployment best practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html), [CloudWatch metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html).

## Learning objectives
- Separate metrics, logs, traces, and business outcomes; choose the right signal for each question.
- Diagnose init latency, handler latency, throttles, errors, and downstream saturation from evidence.
- Use immutable versions and aliases to deploy, canary, and roll back.
- Define alarms and rollout guardrails that include both synchronous and asynchronous paths.

## Problem: invocation count is not customer success

Lambda `Invocations` can rise while requests fail, time out, or spend most time waiting for a database. A function can report low average duration while a small tail violates the API SLO. For a queue worker, zero HTTP errors may coexist with a growing oldest-message age. Observability must connect request outcome to function, integration, and dependency behavior.

Define the customer SLI first: successful API requests within latency target, completed jobs before deadline, or valid records processed without duplicate side effects. Then select the signals that explain it. Do not use “Lambda is healthy” as a conclusion from one green console indicator.

## Metrics, logs, traces, and high-cardinality data

### Metrics

Use invocation count, errors, duration distribution, throttles, concurrent executions, and initialization timing for function behavior. For provisioned concurrency, inspect utilization and spillover. For SQS mappings, combine Lambda metrics with queue visible/in-flight messages and oldest-message age. For a database path, inspect active/idle connections, pool wait, query latency, and DB resource pressure. Use percentiles and `MAX` or `SUM` as appropriate to the metric’s meaning; an average can hide short spikes.

### Structured logs

Emit one JSON record with request ID, operation ID, event source, event ID, version, outcome, and elapsed milliseconds. Avoid full event logging by default: events can contain PII, secrets, or large payloads. Log a stable object key or redacted identifier instead. Include error class and dependency name, but not credentials or authorization headers.

### Traces

Distributed traces show where time is spent across API Gateway, Lambda, database, and external HTTP calls. Ensure propagation works across asynchronous boundaries by carrying a trace context in the event when supported. A queue delay occurs before the consumer span; record enqueue time and processing-start time so the trace or logs expose that delay.

### Dimensions and cardinality

Metrics should use bounded dimensions such as function, alias, outcome, or dependency. Do not create a new CloudWatch metric dimension for every user ID, event ID, or request ID; that explodes cardinality and cost. Put per-request identifiers in logs/traces.

## Execution lifecycle diagnostics

Cold start work appears in initialization timing and logs; handler work appears in invocation duration. Lambda REPORT lines include duration, billed duration, configured memory, maximum used memory, and when applicable initialization duration and status. A suppressed init after a failed invoke can be included in a report duration without a distinct visible INIT line in the older log shape; Telemetry API events provide additional phase evidence. Correlate structured logs and traces rather than assuming `Duration` equals business handler CPU time.

For latency diagnosis, decompose:

```text
end-to-end latency = front-door + queue delay + Lambda init + handler compute
                   + dependency wait + serialization/response + client/network
```

Not every path contains every term. For direct synchronous API, queue delay may be zero; for SQS it can dominate. Provisioned concurrency targets initialization for pre-initialized capacity. It does not fix slow SQL, retries, or an overloaded external API.

## Versions and aliases

`$LATEST` is mutable. Publishing a version snapshots code and qualifying configuration as an immutable version with its own ARN. An alias such as `prod` is a stable pointer to a version and can be configured for weighted routing to a second version. Configure API Gateway, event source mapping, or other callers against the alias when using staged promotion. Provisioned concurrency is associated with a version or alias qualifier, not a vague moving target.

An alias supports safer rollout, but does not automatically make the rollout safe. Database migrations must remain backward-compatible across both versions during a canary. Event schemas must tolerate old/new producer and consumer versions. A Lambda alias rollback will not reverse an already committed DB schema or external side effect.

## Deployment sequence

1. Build artifact once; record source revision, dependency lock, architecture, and artifact digest.
2. Run tests, static analysis, dependency scanning, and integration checks.
3. Publish a new immutable version.
4. Keep the stable alias pointing at the previous version; shift a small weighted share or use CodeDeploy traffic shifting.
5. Observe errors, p95/p99, throttles, initialization, dependency metrics, and business success by version.
6. Continue rollout only after a defined bake period and thresholds pass.
7. On failure, point alias back to prior version and preserve logs/trace evidence.
8. Promote only after async queue age and DLQ signals also pass; short canary windows may miss low-rate jobs.

## Worked example: canary sample size

Suppose the new version receives 5% of 100 requests/s for 2 minutes: expected sample is `100 × 0.05 × 120 = 600` requests. If baseline error rate is 0.2%, expected errors under unchanged behavior are `600 × 0.002 = 1.2`. A threshold of “rollback on any one error” would likely produce false alarms; waiting for 100 errors could miss severe failure. Select a decision rule from baseline, impact, and confidence, and include latency and business errors. A low-volume function may need a longer bake or synthetic transactions. These are example statistics, not a universal canary policy.

## Failure investigation: errors only on one version

Compare version/alias, artifact digest, environment configuration, architecture, IAM role, VPC subnets/security groups, layer versions, downstream endpoint, and feature flags. Compare `Errors`, `Duration`, `Init Duration`, and application error classes by version. Check whether the new version changed DB schema expectations or reused a secret cache. Freeze further rollout, route alias traffic to the known-good version, then inspect traces and deployment diff. Preserve the failed event so retry/replay does not create duplicate side effects.

## Configuration sketch

Publish and point an alias (illustrative CLI; mutating):

```bash
aws lambda publish-version --function-name reservation-api
aws lambda update-alias \
  --function-name reservation-api \
  --name prod \
  --function-version 42
```

Weighted routing uses `RoutingConfig.AdditionalVersionWeights` on the alias. Use a deployment controller for bake time, alarms, and rollback automation when appropriate. Keep generated outputs and deployment state in source control; do not hand-edit the production alias outside the approved pipeline.

## Production alerts

- Synchronous path: 5xx, p95/p99 latency, `Throttles`, error rate, API integration errors.
- Async path: oldest event age, queue depth, retry attempts, DLQ count, destination delivery failures.
- Runtime: `Errors`, `Duration` percentiles, max memory, init duration, concurrency, provisioned spillover.
- Dependencies: DB pool wait/connections, query p95, external API rate-limit and timeout count.
- Deployment: error/latency by version, alias weight, rollback state, and incomplete deployment age.

Alerts need owner, runbook, severity, and action. A DLQ alarm without replay policy creates a quiet data-loss queue. A throttle alarm with no known safe cap tempts operators to remove backpressure during an incident.

## Practical exercise

Deploy a hypothetical version that changes a JSON field and adds an RDS column. Build an expand-contract migration, publish immutable version, canary via `prod` alias, and list rollback evidence. Add one synchronous metric and one queue metric that detect an error the other cannot see.

## Exercise checks
- Caller targets a stable alias, not `$LATEST`.
- New and old versions both work during the schema transition.
- Canary checks customer SLO and downstream metrics by version.
- Rollback restores code routing but does not undo committed data or external effects.
- Async queue age/DLQ are checked beyond a brief HTTP canary.

## Quick reference
- Metrics reveal rates and distributions; logs explain an event; traces expose path timing.
- Version is immutable; alias is a movable routing pointer.
- Provisioned concurrency attaches to a version/alias qualifier.
- Code rollback does not roll back side effects or schema changes.
- Alert on work completion and age, not only invocation success.

## Roman Hinglish explanation

Lambda invocation count customer success nahi hai. Handler successful return kar sakta hai, lekin queue ka kaam late ho sakta hai, database slow ho sakta hai, ya business operation incomplete reh sakta hai. Metric batata hai kitni baar aur kitni der; structured log batata hai ek attempt mein kya hua; trace dependency path ka timing dikhata hai. Async flow mein correlation ID event ke andar carry karo, kyunki queue delay ke baad ek hi trace context par bharosa nahi kar sakte. Version immutable snapshot hai; alias traffic ko version par route karta hai. Canary mein errors ke saath p95/p99, init, throttles, DB aur business success dekho. Low-traffic function mein 20 requests ka sample reliability prove nahi karta. Rollback code ko wapas karta hai, par database migration ya external side effect ko reverse nahi karta.
