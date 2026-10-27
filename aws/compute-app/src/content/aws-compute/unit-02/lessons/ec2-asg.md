# Auto Scaling Groups and scaling policies

**Prerequisite:** Instance selection and ALB health. **Sources:** [EC2 Auto Scaling](https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html), [target tracking](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html), [health checks](https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html).

## Learning objectives
- Explain desired, minimum, and maximum capacity and instance replacement.
- Choose target tracking, step, scheduled, or predictive scaling from signal and shape.
- Calculate fleet size and scaling delay with safe warm-up and downstream bounds.

## Problem

Fixed fleets waste money during quiet periods and saturate during bursts. Scaling can also make an incident worse: adding web hosts may multiply database connections, and scale-out can arrive after a sharp burst has already breached latency.

## Definition and terminology

An ASG maintains desired EC2 capacity within minimum and maximum bounds using a launch template and subnet/AZ placement. It replaces instances considered unhealthy by EC2 or enabled integrated health checks. Target tracking adjusts capacity toward a metric target; step scaling applies configured adjustments to alarm ranges; scheduled scaling changes capacity at known times. Instance refresh replaces an existing fleet with a new launch-template version under configured availability rules.

## Internal operation

CloudWatch metric/alarm or schedule triggers a scaling activity. ASG computes desired capacity, requests instance launch, waits for lifecycle and health, then registers capacity with the app path. Warm-up controls when new capacity is considered for scaling calculations; it does not magically make the app ready. Termination policies and lifecycle hooks affect drain/cleanup. Health check grace avoids early replacement during bootstrap but excessive grace delays failure removal.

## Execution lifecycle

Metric changes → alarm/policy action → desired capacity updated → EC2 capacity allocated → bootstrap executes → target registers and passes health → capacity counted → scale-in selects host → lifecycle hook drains work → instance terminates.

## Worked example 1 — RPS

Peak 1,200 RPS, measured safe rate 150 RPS per instance: `ceil(1200/150)=8` instances. For two AZs with loss of one AZ and equal placement, each AZ must hold 8 instances; total 16 for N-1 coverage. Add headroom from load testing. If ASG max is 12, configured max cannot satisfy this failure objective.

## Worked example 2 — connection cap

Each instance opens a pool of 30 DB connections; 8 instances can request 240 connections. If the DB supports 180 useful connections, target scaling can overload it before hosts reach CPU target. Bound pool size or concurrency, reserve admin/replication headroom, and include DB saturation in scale design. Autoscaling is not safe without downstream budgets.

## Configuration lab

```json
{
  "MinSize": 4,
  "MaxSize": 20,
  "DesiredCapacity": 8,
  "HealthCheckType": "ELB",
  "HealthCheckGracePeriod": 180
}
```

Values are an example, not a recommendation. Use launch templates, subnets in multiple AZs, target tracking on a metric that reflects demand, and scale-in protection only for justified lifecycle needs. Do not set max/min from a copy-paste sample.

## Alternatives and decision boundary

Use target tracking for a stable proportional signal such as average CPU or requests per instance. Queue consumers may scale on backlog per worker or age of oldest message. Scheduled scaling fits known daily cycles. Step scaling fits clear alarm bands. Predictive scaling needs a predictable history and still requires reactive protection.

## Tradeoffs

Short cooldown/warm-up can oscillate; long values can lag. Per-instance metrics require correct aggregation. Replacing unhealthy hosts recovers fleet count, not lost in-memory sessions or jobs. Capacity may not launch if quotas, instance availability, subnet IPs, or launch permissions fail.

## Failure analysis

Scale activity failed: inspect activity reason, quota, subnet IP exhaustion, Spot capacity, launch template, and IAM. Capacity remains low: compare desired/running/in-service and target health. Oscillation: graph metric, capacity, warm-up, and request latency. Queue age grows: compare arrival and completed jobs per worker.

## Debugging procedure

Read ASG activities first, then CloudWatch alarm history, policy, launch template version, instance status, target health, and AZ distribution. Confirm metric unit and aggregation. Model one scale-out and one scale-in event. Check downstream capacity before raising max.

## Production checklist
- Min/max/desired match documented SLO and failure budget.
- Subnets have IP headroom; quotas and instance supply are checked.
- Bootstrap and app readiness are observable.
- Scale-in drains requests/jobs; shutdown is graceful and bounded.
- DB/API quotas and pool sizes cap total fleet demand.

## Practical exercise

At 900 RPS each instance safely handles 120 RPS. Calculate base count; then model one AZ failure with two equal AZs. Add 20% forecast headroom and identify which max-capacity value would make the plan impossible.

## Exercise checks
- Base capacity is `ceil(900/120)=8` before headroom.
- One AZ must independently hold all required live load.
- ASG max, subnet IPs, and downstream limits are checked.

## Quick reference
- ASG repairs capacity; scaling policy changes desired capacity.
- Scale on workload signal, not only host CPU by habit.
- Include launch delay and dependent-service budgets.

## Deepened mechanism: Desired capacity, warm-up, health replacement, and dependency limits

### Worked example 3 — target tracking is a feedback controller

Suppose 12 instances serve 1,200 requests/s at 60% average CPU. Traffic rises to 2,400 requests/s. A target-tracking policy observes a metric and adjusts desired capacity toward the target; it does not instantly create ready capacity. If each instance takes 90 seconds to launch, boot and pass ALB health, requests can queue or fail during the delay. Set instance warmup to the measured time before a new instance’s metric should influence scaling, and use a metric that reflects demand before overload. Target tracking can add capacity faster than custom step policies in many cases, but it cannot fix a saturated database or an unavailable AZ.

Scale-out and scale-in have different risks. During scale-out, capacity is not useful until the instance launches, app initializes and target is healthy. During scale-in, terminate only instances that can be safely drained; lifecycle hooks can run bounded work, but hook failure and timeout need recovery. Health replacement must distinguish failed hosts from temporary application dependency errors. If every instance fails health because the database is down, replacing all hosts can amplify startup load rather than restore service.

### Worked example 4 — scale-in and connection surge

A worker fleet scales from 40 to 10 instances. Each process has a 20-connection pool. Removing 30 instances releases up to 600 connections, but the remaining 10 may each reconnect 20 clients during restart, creating a burst of 200 connection attempts. Scale-in can therefore produce connection churn. Use connection backoff, graceful shutdown, pool sizing and DB connection metrics. Do not set pool max equal to DB max without reserving capacity for other services and failover.

### Incident review

If desired capacity rises while healthy capacity stays flat, inspect ASG scaling activities, EC2 launch failures, subnet IP/instance quotas, capacity availability, launch-template permissions, user-data failures and ELB health. If desired capacity is flat while backlog grows, inspect scaling metric, alarm state, cooldown/warmup, metric aggregation and min/max bounds. Tie every alert to desired, pending, in-service, healthy target and queue-age series.

### Roman Hinglish explanation

Auto Scaling Group ka desired number ek intent hai, running healthy capacity nahi. Controller metric dekhta hai, desired badhata hai, phir EC2 launch, boot, app initialization aur ALB health mein waqt lagta hai. Warmup galat ho to controller nayi instance ko jaldi metric mein ginta hai ya scale decisions oscillate kar sakte hain. Health replacement ka matlab every unhealthy response par naya host banana nahi; pehle dependency check karo. Scale-in mein deregister, drain, in-flight work aur connection release ka plan chahiye. Scale policy ko queue age ya request demand ke saath test karo, sirf CPU chart se nahi.

### Direct AWS references for these mechanisms

- [Default instance warmup](https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-default-instance-warmup.html) — how warmup affects dynamic scaling metrics.
- [Auto Scaling health checks](https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html) — EC2/ELB health and replacement timing.
- [Target tracking scaling](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html) — feedback policy behavior.
