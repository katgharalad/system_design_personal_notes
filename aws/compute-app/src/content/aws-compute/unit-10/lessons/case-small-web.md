# Case 1 · Small production web application

**Prerequisite:** Units 02–08. **Sources:** [entry compute guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/lightsail-elastic-beanstalk-ec2.html), [AWS compute guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html), [Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/).

## Case brief and explicit assumptions

Design backend for a small reservation app. Hypothetical assumptions: 40 RPS steady, 180 RPS 5-minute peak, p95 API target 500 ms, PostgreSQL is authoritative, one engineering team of four, regional availability is enough, and downtime under one AZ failure should be avoided. These values are invented for this exercise; no real OPEF architecture is implied.

## Requirements and first design

Users create reservations, read availability, and upload a supporting document. Prevent duplicate booking on client retry. PII must stay private. Start with browser/API → ALB → two app tasks in private subnets across two AZs → RDS PostgreSQL Multi-AZ deployment → S3 private bucket. Secrets Manager stores DB credentials; task role is scoped; CloudWatch logs/metrics and alarms capture request IDs and dependency latency. Async document scanning uses SQS worker tasks.

## Quantitative sizing

Peak 180 RPS × 0.12 s average service time ≈ 21.6 concurrent requests. If a task safely sustains 45 RPS at p95 target under realistic DB load, four tasks cover peak in normal conditions. To tolerate one AZ loss, each AZ must independently serve 180 RPS, so plan four healthy tasks per AZ (eight total at this measured capacity), or remeasure a larger task shape. This is a test plan, not a production recommendation. DB connection budget: 8 tasks × pool size 12 = up to 96 app connections; compare against DB useful connections plus admin, migrations, and failover overhead.

## Execution walkthrough

ALB terminates HTTPS and routes to healthy task IPs. API validates/authenticates request, starts DB transaction, enforces unique reservation constraint/idempotency key, commits, and returns. Upload uses presigned S3 request; object event queues scan work. Worker reads object with scoped role, writes scan result idempotently, then acknowledges job. API does not wait for a long scanner.

## Implementation sketch

```sql
CREATE TABLE reservations (
  id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  slot_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Unique constraint is final duplicate defense; app should return prior result on repeated key. SQS delivery can be at least once, so scanner must tolerate duplicates. Use additive schema migration before deploying new code.

## Failure drill 1 — AZ loss

Symptom: ALB healthy host count halves, latency rises. Hypotheses: task concentration, subnet IP exhaustion, DB failover, NAT endpoint path, insufficient surviving capacity. Inspect target AZ distribution, ECS placement events, RDS events/connections, and p95. Remove one AZ from test service; verify other AZ maintains load and app can reach DB/S3. If only 2 tasks total, one AZ loss leaves one task and likely misses peak capacity.

## Failure drill 2 — DB connection exhaustion

Symptoms: API p95 and 5xx rise while tasks are healthy. Competing hypotheses: slow query, leaked connections, lock contention, deploy changed pool, DB CPU/IO. Inspect pool wait and active/idle counts, DB connections/locks, query latency, and release ID. Reduce admission or worker concurrency; do not scale tasks blindly. Consider RDS Proxy only after validating pooling semantics, pinning, transaction pattern, and limits.

## Alternative architecture

For low operations overhead and burstiness, API Gateway + Lambda may fit if request/runtime, DB connection behavior, and latency constraints validate. For simplest prototype, a single VM is cheaper to start but fails stated AZ goal unless redundancy and data path are added. Beanstalk or ECS Express Mode may simplify deployment; verify current feature/lifecycle constraints and generated resources.

## Architecture defense

Why ECS tasks? Long-running HTTP service, containerized artifact, explicit health and connection pools. Why not EKS? Current workload does not require Kubernetes API ecosystem or platform team; operational burden exceeds benefit. What changes recommendation? Existing Kubernetes platform with strong on-call, need operators, much larger fleet, or unsupported task feature. What must be proven? Load test, N-1 capacity, DB failover, restore, IAM review, duplicate booking, and deploy rollback.

## Practical interview sequence

1. Draw request and async data paths.
2. Defend compute, DB, and object storage choices.
3. Traffic grows 5×; calculate new task and DB budgets.
4. Worker writes output then crashes before SQS delete; prevent duplicate effect.
5. One AZ is lost; state surviving capacity and recovery evidence.
6. Compute bill doubles; identify tags, usage dimensions, and cost per reservation.

## Exercise checks
- State steady and peak load, latency, availability, consistency, and team assumptions before drawing services.
- Show sync reservation and async document-scan paths, plus identity and data boundaries.
- Size one AZ to carry required load after the other AZ is removed.
- Calculate DB pool demand across tasks and reserve capacity for operations and failover.
- Explain duplicate request handling and the worker crash-after-write retry.
- Name a load test, AZ drill, database recovery test, and deployment rollback check.

## Quick reference

- Requirements set the design; service labels do not.
- N-1 sizing uses surviving AZ capacity, not total fleet.
- Idempotency and DB constraints protect retries.
- A healthy task can still be unable to serve because a dependency is saturated.
