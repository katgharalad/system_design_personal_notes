# EC2 Auto Scaling or Lambda scaling

**Prerequisite:** EC2 ASG and Lambda lifecycle. **Sources:** [ASG target tracking](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html), [Lambda concurrency](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html).

## Learning objectives
- Compare capacity provisioning and per-invocation concurrency.
- Calculate concurrency or instance count from measured rate and service time.
- Identify quota, warm capacity, scale lag, and dependency bottlenecks.

## Internal operation

Lambda increases concurrent execution environments subject to scaling behavior, concurrency configuration, and quotas. ASG changes desired VM count from alarms/policies, then launches and boots instances before app readiness. ECS service scaling changes task count; underlying EC2 capacity may require another scale step. Signals and reaction time differ.

## Worked example

2,000 RPS × 250 ms = about 500 concurrent requests. Lambda needs enough concurrency plus downstream budget. EC2 at a measured safe 100 RPS/instance needs 20 instances before headroom; launch lag means warm capacity is needed for instant bursts. The rate and duration are averages; load test tail and burst duration.

## Tradeoffs

Lambda reacts at request/event scale but can throttle and multiply dependency demand. ASG has boot lag and idle headroom but can support persistent state/processes. Pre-provisioning shifts cost toward readiness; queues can absorb bursts if latency permits.

## Debugging and exercise

Traffic spikes: compare incoming rate, concurrency, throttle, ASG desired/running, launch activities, healthy targets, queue age, DB connections. Design 5× burst for 90 seconds; set a cap and explain whether callers wait, fail, or queue.

## Exercise checks
- Estimate 500 in-flight requests.
- ASG count uses measured per-instance throughput.
- Database admission is bounded independently.

## Quick reference
- Autoscaling changes compute capacity; it does not guarantee safe dependencies.
- Reactions have delay and quota/capacity constraints.
