# ECS on EC2 or Fargate

**Prerequisite:** ECS capacity models. **Sources:** [ECS capacity choices](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/capacity-launch-type-comparison.html), [Fargate isolation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html), [purchasing choices](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/ec2-purchasing-options-aws-how-to-choose.html).

## Learning objectives
- Compare host responsibility, density, scaling speed, and workload constraints.
- Build like-for-like cost model including idle and rollout capacity.
- State when EC2 host control is a requirement rather than preference.

## Problem

Fargate task price can look high for always-on dense services; EC2 can look cheap while excluding idle headroom, patching, EBS, and on-call. Use measured useful throughput.

## Internal operation

EC2 capacity provider uses an ASG and registered host resources; task placement can fragment CPU/memory and depends on agent/AMI. Fargate provisions task-scoped compute and removes host maintenance. Both require task definitions, IAM, network, health, logging, and downstream capacity. ECS Managed Instances is another model; check current guide rather than treating it as identical to Fargate.

## Worked example

Fourteen tasks need 0.5 vCPU each around the clock. EC2 placement may fit e.g. across right-sized instances with spare deployment and AZ capacity; Fargate bills task resource/runtime. Compare 7 vCPU useful task demand with host capacity after system reservation, 2× rollout surge, N-1 requirement, EBS/network, and staffing. Use current regional price pages; this lesson intentionally gives no fabricated price.

## Decision lab

Record host access, GPU/architecture needs, per-task shape, utilization curve, scale latency, IP demand, capacity quotas, isolation requirement, and owner. Reject any option that fails required capability before comparing price.

## Tradeoffs

EC2 supports broader host options and purchase strategies but requires fleet operations. Fargate reduces host ops and gives task boundary but has supported-shape and feature constraints. Managed Instances may trade some host control for AWS-managed lifecycle.

## Failure analysis

EC2 tasks pending because of fragmented resources or missing AZ hosts; Fargate tasks pending because of quota, IP, or unsupported config. Deployment surge can fail on either. Compare task stop reasons and capacity-provider events.

## Practical exercise

For 50 tasks, compare steady and 2× deployment peak. Make recommendation for (A) 24/7 steady API and (B) 10-minute nightly burst. Explain assumption sensitivity.

## Exercise checks
- Cost model uses same CPU/memory/time and includes resilience.
- Host management and purchasing risks are counted.
- Feature constraints checked before cost.

## Quick reference
- ECS is scheduler; EC2/Fargate/Managed Instances are capacity choices.
- Cost choice must include utilization, failure headroom, and operator work.
