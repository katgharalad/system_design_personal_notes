## Learning objectives

Vertical/horizontal scaling, state location, autoscaling lifecycle, health and replacement, queues, downstream bottlenecks explain karo. Numerical capacity model banao. Partial failure aur retry amplification diagnose karo.

## Problem: replicas are not a complete scaling plan

Ek API process local RAM mein sessions rakhta hai. Load balancer next request doosre process ko bhejta hai; user logged out dikhta hai. Horizontal scale aur host replacement dono local state lose karte hain. Stateless app ka matlab “no state anywhere” nahi: durable/shared state explicit external store mein hai. Signed token ek option hai, but revocation, key rotation, and payload sensitivity consider karni padti hai. Session store another dependency/failure mode hai.

Vertical scale = larger worker/instance: simple migration, but hardware ceiling and one failure domain remain. Horizontal scale = more replicas: availability and throughput potential, but state coordination, connection count, deployment surge, and load distribution matter. **Autoscaling** policy desired count ko metric ke response mein adjust karti hai; new capacity instant ready nahi hoti. [AWS EC2 target tracking](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html) chosen metric and target value se CloudWatch alarms/scaling events manage karta hai. Metric load ke saath correlate aur capacity add karne par improve hona chahiye; average CPU low ho toh memory/DB bottleneck miss ho sakta hai.

## Internal operation: scale-out lifecycle

EC2 Auto Scaling group example: launch template AMI, instance type, user data, security groups define karta hai. Min/max/desired capacity set hoti hai. Target tracking average CPU 50% target par example: metric target se upar jaaye → alarm/policy desired capacity raise kare → ASG suitable AZ/subnet mein new instance launch kare → instance boot/user data/app startup → EC2 checks → optional ELB/application checks → target register/healthy → traffic. **Warm-up** period new instance ko stable contribution dene ka time hai; too-short warm-up repeated over-scaling, too-long delayed response cause kar sakta hai. Scale-in mein policy desired reduce karti hai, termination and connection draining behavior matter. [ASG health docs](https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html) explain karte hain instance status checks default hain; ELB health integration enable karna pad sakta hai. Unhealthy instance replacement does not fix a bad AMI that every new instance boots.

ECS service mein desired task count and deployment configuration specified hote hain. Service Auto Scaling policy desired tasks badha/sakta hai; ECS scheduler tasks start karta hai on Fargate or EC2 capacity. Task running does not mean ALB healthy. [ECS service scaling best practices](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/capacity-autoscaling-best-practice.html) metric choice and task readiness discuss karti hain. Lambda event arrival ke response mein concurrent environments scale karta hai within concurrency and ramp/quotas. Kisi bhi model mein user-facing capacity = healthy reachable workers × safe throughput per worker, bounded by data tier.

ALB health check target-specific hai. Unhealthy target usually routing se excluded; **edge case:** [ALB documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html) says agar target group ke all registered targets unhealthy hon, ALB *fails open* and routes to them. “ALB always sends only to healthy targets” absolute claim galat. Misconfigured health path all unhealthy target group bana sakta hai; 5xx ka reason app ya health configuration dono ho sakte hain.

## Worked example 1: replica and AZ budget

Burst 1,200 RPS, average active time 250 ms → 300 concurrent. Load test says one replica can serve 30 in-flight while meeting p95. Baseline `ceil(300/30)=10`. Two AZ deployment mein 5+5 tasks normal state is baseline throughput. One AZ fails → 5 tasks left = ~half required peak. If peak SLO must survive an AZ loss, each AZ needs 10 *safe task slots* available after failure. Could run 10+10 continuously or run fewer and rely on fast scale-out only if temporary degradation allowed. Quotas, subnet IP addresses, launch latency, and Fargate/EC2 placement must support 10 in survivor. Database must serve peak under failure too. Deployment max-percent/min-healthy policies may require additional surge capacity. Measure rather than assuming spare slots appear.

```text
normal: AZ A 5 tasks + AZ B 5 tasks → 10 baseline
AZ A lost: AZ B 5 tasks → insufficient for 300 in-flight
survival target: AZ B can safely host 10 tasks + data path survives
```

Alternative vertical resize: five stronger tasks each safe 60 in-flight might serve baseline, but AZ loss still fails if evenly split without extra headroom. Container and VM choice does not remove N-1 capacity arithmetic.

## Worked example 2: Lambda and DB feedback loop

200 RPS × 0.4 s ≈ 80 concurrent Lambda invocations. 2,000 RPS × 0.4 s ≈ 800. PostgreSQL configured 150 max connections; 100 observed useful active query limit. If each invocation opens connection and holds it for 0.4 s, DB reject/queue appears before compute ceiling. RDS Proxy may pool and multiplex eligible transactions, but session pinning and long transactions reduce effect. Tune SQL, short transaction, bounded concurrency, or queue nonurgent work. If query duration doubles from .4 to .8 s under load, same 2,000 RPS demands ~1,600 concurrent. More compute plus retries can create positive feedback loop. `Throttles` and DB connection errors must be interpreted separately. [Lambda concurrency](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html); [RDS Proxy mechanism](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html).

## Practical local simulation

Free local worksheet; no AWS resource created. Simulate queue backlog in a spreadsheet or Python:

```python
arrival_per_second = [40] * 60 + [200] * 30 + [40] * 120
capacity_per_second = 80
backlog = 0
peak = 0
for second, arrivals in enumerate(arrival_per_second):
    backlog = max(0, backlog + arrivals - capacity_per_second)
    peak = max(peak, backlog)
    if second in (59, 89, 119, 179, 209):
        print(second, backlog)
print('peak', peak)
```

Expected peak after 30-second burst: `(200−80)×30=3,600` jobs. After burst, net drain `80−40=40` jobs/second → 90 seconds to clear. If processing fails 10% and retries immediately, effective arrival larger; change model. Queue age at peak under constant 80 completions/second roughly 45 seconds if FIFO and no priority. Real queue distribution, visibility timeouts, poison messages, and storage limits need separate testing.

Billable AWS exploration: creating ASG, ALB, ECS service, RDS incurs charges. Read-only CLI calls such as `aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names NAME` inspect state in an existing account; permissions and context required. `aws elbv2 describe-target-health --target-group-arn ARN` shows target health. Do not run mutations until design and cost are reviewed.

## Full failure analysis: CPU falls while errors rise

At 13:00 ECS service scales 4→16 tasks after RPS spike. CPU per task falls 75→30%. 5xx increases 0.2→18%, DB `DatabaseConnections` reaches limit, p95 jumps. Naive response “scale more” worsens connection pressure. Incident steps:

1. Timeline: deploy, traffic, scale events, 5xx, DB connections, query latency, retries. Correlation is clue, not proof.
2. Check ECS running/pending/stopped count and ALB target health. If targets unhealthy, inspect health path and app logs; if healthy but requests fail, trace request to DB.
3. Check DB rejected connections, active queries, locks, CPU, and slow SQL. Count per-task pool size × task count. Example 16 tasks × 12 pool connections = 192 potential connections; DB limit 150. Verify actual connections rather than just max theoretical.
4. Mitigate: cap app pool or task scale, shed/queue nonurgent work, reduce retry storm, roll back bad change if present. Ensure caps do not silently violate user latency SLO.
5. Fix: database-safe pool design, query efficiency, RDS Proxy if appropriate, scaling policy with downstream guardrail. Load test 10× and one-AZ failure. Verify successful throughput, latency, DB wait, and error rate.

If all ALB targets unhealthy, note fail-open behavior; don't assume requests simply stop. Health endpoint should distinguish app process from critical dependency readiness while avoiding synchronized restart loops during shared DB outage.

## Alternatives and interview reasoning

Scale-up simpler for tightly coupled/shared-memory app, until instance size or fault tolerance blocks. Scale-out useful for stateless services but needs state externalization. Queue smooths asynchronous demand; imposes delay, at-least-once delivery handling, idempotency, dead-letter process. Cache/read replicas reduce some data load but bring freshness, invalidation, and replication lag concerns. RDS Proxy manages connections, not query CPU. Target tracking is reactive; predictable seasonal spikes may need pre-scaling. Cost matters: idle headroom protects latency but has price; quantify outage target and utilization.

Interview sequence: state where work/data live; calculate active work and safe replica count; describe control loop, warm-up, health, scale-in; examine downstream; show one-AZ loss and rollout; outline observable validation. Ask “which metric controls scaling?” and “what if scaling makes database slower?” A good answer can choose multiple valid implementations with explicit assumptions.

## Scaling policy design under changing bottlenecks

CPU target tracking useful tab hota hai jab CPU utilization traffic ke saath rise kare aur new instance add karne par average CPU down aaye. I/O-bound API mein CPU 20% aur request latency 3 seconds ho sakti hai because DB wait dominates. CPU target policy in that case scale out nahi karegi; even agar kare, DB load worse ho sakta hai. Better signal request count per healthy target, queue age, or custom saturation metric ho sakta hai, subject to AWS service support and measurement. Metric should represent demand per capacity unit. Counterexample: total requests per minute capacity add karne se necessarily down nahi hota; per-target request rate generally down ho sakta hai. Policy design ko load test with different traffic shapes se prove karo, not dashboard aesthetics.

Scale-in risk alag hai. New instances become idle after burst, but kuch workers long requests ya queue messages handle kar rahe hain. Termination se incomplete work duplicate ho sakta hai. Connection draining, graceful shutdown, visibility timeout, and idempotency define karo. Warm-up and cooldown-like behavior oscillation avoid karne mein help karte hain; too long → waste/slow response, too short → thrash. If task memory leak hai, scale-in/replace symptom hide karega; heap metrics and leak diagnosis chahiye.

Dependency guardrail ke liye hard cap plus alerting useful: task max count × per-task DB pool maximum <= desired connection budget under worst-case. Ye simple upper bound bhi conservative hai—other clients, migrations, admin tools, and replicas connections use karte hain. If 16 tasks × 12 pool = 192 and DB configured 150, cap violated even before other clients. Reduce pool to six → potential 96, leaving 54 for other clients, but query throughput and wait time load test karo. Small pool may queue at app; that's controlled backpressure, but user latency target still must be met. RDS Proxy multiplexing can improve connection use when transactions short/compatible; treat it as measured optimization, not proof by design.

## Exercises

1. 500 RPS × .3 s = 150 in-flight; safe 25/task → 6 baseline. With two AZs and strict one-AZ survival at peak, what survivor capacity? **Check:** 6 safe tasks in surviving AZ, plus dependency capacity and traffic routing.
2. Desired ASG=6, one instance fails status check. What should happen? **Check:** ASG marks/replaces according to health policy; launch template creates replacement; app startup + target health needed before serving. If new AMI fails boot, repeated replacements need diagnosis.
3. 10 tasks each open pool of 20; DB max 150. **Check:** potential 200 connections exceeds limit. Actual active/idle connections and pool configuration matter; reduce pool or proxy and test.

## Quick reference

 desired ≠ running ≠ healthy ≠ serving. Scale-out time includes metric detection, admission, launch, startup, health, routing. N-1 capacity target depends on accepted degradation. ALB can fail open when all registered targets unhealthy. DB-safe concurrency must bound compute concurrency. Retries increase arrival; use budgets, backoff+jitter, idempotency.

**Evidence:** [ASG target tracking](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html), [ASG health](https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html), [ALB health](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html), [ECS scaling](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/capacity-autoscaling-best-practice.html), [Lambda concurrency](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html).
