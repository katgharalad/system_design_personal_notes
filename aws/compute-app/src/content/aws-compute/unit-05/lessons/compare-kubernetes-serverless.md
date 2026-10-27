# Kubernetes or serverless architecture

**Prerequisite:** EKS and Lambda/Fargate. **Sources:** [modern applications guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/modern-apps-strategy-on-aws-how-to-choose.html), [serverless decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-serverless-service.html), [EKS architecture](https://docs.aws.amazon.com/eks/latest/userguide/eks-architecture.html).

## Learning objectives
- Compare platform-level orchestration with managed event services.
- Identify when Kubernetes overhead exceeds value for a small team.
- Design hybrid boundaries without splitting every component.

## Problem

Kubernetes can run almost any container, but broad capability creates platform responsibilities. Serverless reduces host management but introduces service-specific execution and integration semantics. Neither is universally simpler at system level.

## Internal operation

Kubernetes reconciles Pods and services on cluster capacity; team manages API, nodes/add-ons according to mode. Serverless app composes event sources, API, functions, queues, workflows, and managed data services; each service has quotas, IAM, retries, and observability semantics. A service boundary can route suitable components to each model.

## Worked example

Small API with spiky traffic, queue consumer, and a few developers may use API Gateway/Lambda/SQS with relational DB carefully bounded. A platform with GPU workloads, long-running sidecars, custom scheduling, and Kubernetes-skilled team may choose EKS. Hybrid can put public request handling on functions and sustained workers on ECS.

## Decision lab

Compare deployment lead time, platform team capacity, request/runtime shape, control requirements, scale behavior, DB pressure, rollout, and total cost. Count operational objects and failure modes, not just number of AWS services.

## Tradeoffs and debugging

Kubernetes centralizes a platform but adds cluster and upgrade blast radius. Serverless removes host fleet but can amplify downstream concurrency and obscure per-invocation cost. Debug through service events, trace IDs, queue age, quotas, and dependency metrics.

## Practical exercise

Design for bursty API + 40-minute document processing + GPU inference. Choose one platform or hybrid. Explain boundaries and data contracts.

## Exercise checks
- Long-running and accelerator constraints get explicit current-service validation.
- DB/network bottlenecks span both options.
- Team operations are considered.

## Quick reference
- Choose orchestration when it supplies needed platform behavior.
- Serverless still requires quotas, retries, IAM, and downstream control.
