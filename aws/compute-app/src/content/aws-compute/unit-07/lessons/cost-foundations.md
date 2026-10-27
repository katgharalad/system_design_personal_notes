# AWS compute billing foundations

**Prerequisite:** Workload characterization. **Sources:** [EC2 purchasing guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/ec2-purchasing-options-aws-how-to-choose.html), [Cost Explorer](https://docs.aws.amazon.com/cost-management/latest/userguide/what-is-cost-explorer.html), [Well-Architected cost optimization](https://docs.aws.amazon.com/wellarchitected/latest/framework/cost-optimization.html).

## Learning objectives
- Identify billable dimensions and shared costs around compute.
- Model cost per useful unit of work with explicit assumptions.
- Distinguish commitment discounts from capacity assurance.

## Problem

An hourly instance rate does not equal workload cost. Storage, load balancer, NAT, requests, logs, data transfer, idle capacity, commitments, and engineering time can dominate. A low bill can also mean insufficient reliability or dropped work.

## First principles: utilization and unit economics

Define a unit of useful work: successful API request, completed image, or processed GB. Total cost per unit = total attributable cost / completed useful units. Include failed/retried work and idle capacity over the same time window. For fixed compute, utilization `u = useful busy time / provisioned time`; theoretical cost per useful busy hour rises approximately as `rate/u`, before other costs. This does not mean 100% utilization is safe: headroom supports bursts and failures.

AWS compute billing depends on service, region, OS, architecture, resource allocation, duration, requests, and purchase option. EC2 price alone excludes EBS and network. Lambda includes request and duration/resource dimensions subject to current pricing rules. Fargate uses task resources and runtime plus supporting services. Always use current official pricing pages/calculators for a real estimate; this lab uses synthetic values only.

## Worked example — utilization sensitivity

Assume synthetic VM cost `$0.20/hour`, useful busy time 30% of provisioned time, 720 h/month. Monthly VM compute = `0.20×720=$144`. If throughput is zero while idle, cost per busy-hour equivalent is `$144/(720×0.30)=$0.667`. At 70% utilization, same fixed cost becomes `$0.286` per useful busy-hour, but only if SLO and failure headroom remain acceptable. These are invented example numbers, not AWS prices.

## Pricing dimensions and execution

1. Define Region, workload, runtime, and observation period.
2. Measure capacity and utilization curve; separate average, p95, and peak.
3. Add compute, storage, networking, licensing, requests, observability, and support.
4. Apply eligible discount/commitment assumptions.
5. Model scale-in, interruption, retry, N-1, and deployment surge.
6. Compare cost per successful unit and sensitivity range.

## Alternatives and purchasing model

On-Demand buys flexible usage. Savings Plans and Reserved Instances trade commitment/eligibility for billing discounts. Spot uses spare capacity with interruption risk. Capacity Reservations secure specified EC2 capacity but are an independent billing/discount dimension; a reservation can incur charges while unused. A discount does not guarantee capacity. Check current guide scope before modeling each instrument.

## Failure analysis

1. **Bill doubled after autoscaling.** Compare resource counts, hours, task size, NAT bytes, logs, data transfer, and retry volume. Determine whether traffic rose or scaling efficiency fell. Validate with cost allocation tags and deployment timeline.
2. **Commitment leaves high bill.** Check hourly commitment utilization and coverage, eligible usage, family/Region scope, and workload shutdown. Discounted unused commitment remains a cost; capacity assurance is a separate question.

## Interactive exercise

Use the cost lab to vary hours, requests, duration, resource allocation, utilization, Region, interruption tolerance, and purchase option. Inputs are explicitly labeled examples. The output compares formulas and excludes unmodeled costs visibly; it does not quote live AWS pricing.

## Exercise checks
- Keep numerator and useful-work denominator on the same time window.
- Separate discount eligibility from capacity assurance.
- Include idle headroom, retries, storage, and network costs in the written assumptions.
- Replace each synthetic price with a current Region-specific value before making a purchase decision.

## Quick reference

- Measure cost per successful unit, not only hourly rate.
- Include network, storage, observability, idle headroom, and failures.
- Discount and capacity reservation solve different problems.
- Refresh every real price from official current sources.
