# Lambda or EC2

**Prerequisite:** Workload characterization. **Sources:** [compute decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html), [Lambda execution model](https://docs.aws.amazon.com/lambda/latest/dg/concepts-how-lambda-runs-code.html), [EC2 lifecycle](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html).

## Learning objectives
- Compare event invocation with a VM process lifecycle.
- Evaluate latency, runtime, control, scaling, and total cost.
- Change recommendation when workload constraints change.

## Problem

“Lambda scales automatically” is not a full design; it can throttle at quotas or overload a database. “EC2 has no cold start” ignores boot, deploy, warm-up, and load-balancer health. Compare end-to-end behavior.

## Definition and terminology

Standard Lambda Event Functions execute a handler in an AWS-managed environment in response to events and scale concurrency under service behavior and quotas. EC2 provides a guest VM where the team operates OS/app process, capacity, and replacement. Lambda also has distinct current compute models such as durable functions and Managed Instances; do not apply Event Function assumptions to every Lambda offering.

## Internal operation and lifecycle

Lambda: event accepted → environment initialized if required → handler runs → result/ack semantics follow trigger → environment may be reused, but reuse is not guaranteed. EC2: instance launch/boot → app process starts → load balancer routes → process handles requests until scale/health/termination. Both need downstream concurrency limits, IAM, logs, and retries.

## Worked example

Bursty API: 30 RPS for most hours, 1,500 RPS for 3 minutes; handler takes 180 ms. Approximate burst concurrency `1500 × .18 = 270`. Lambda may simplify variable capacity if quotas, latency, VPC, and DB limits fit. EC2 can use an ASG but needs warm capacity or accepts launch delay. Database connection demand and p99 cold/boot behavior may decide.

## Configuration lab

Create two designs for same API. Write peak concurrency, scale-up delay, min warm capacity, runtime limit, deployment rollback, and DB connection budget. Compare measured p95 and monthly useful work—not service names.

## Alternatives and tradeoffs

Lambda reduces host management and can align cost to invocations; it has event/runtime constraints and quota behavior. EC2 maximizes guest control and supports persistent processes, but requires patching, AMIs, capacity, and fleet operations. ECS/Fargate may fit long-running containerized service.

## Failure analysis and debugging

Lambda: Throttles, errors, Init/Duration, concurrency, downstream pressure. EC2: ASG activity, target health, CPU/memory, process state, and launch lag. If DB saturated, limiting admission or queueing may solve more than switching compute.

## Practical exercise

Design a 1,000-RPS endpoint with 250 ms duration and PostgreSQL budget of 120 useful connections. Recommend one path, bound concurrency/pools, and state what measurement could reverse your recommendation.

## Exercise checks
- Compute estimate is 250 in-flight requests before headroom.
- Database capacity is a design constraint, not an afterthought.
- Recommendation names latency and operational tradeoffs.

## Quick reference
- Compare total lifecycle and scaling path, not only steady-state CPU.
- Event Functions and persistent VMs have different failure/retry semantics.
