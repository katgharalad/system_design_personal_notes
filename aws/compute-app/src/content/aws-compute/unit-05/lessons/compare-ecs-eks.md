# ECS or EKS

**Prerequisite:** ECS and EKS fundamentals. **Sources:** [container decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-container-service.html), [ECS services](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_services.html), [EKS architecture](https://docs.aws.amazon.com/eks/latest/userguide/eks-architecture.html).

## Learning objectives
- Compare API/control-plane surface, ecosystem, portability, and team operations.
- Explain when Kubernetes overhead is unjustified.
- Identify constraints that make EKS a better fit.

## Problem

A migration to Kubernetes can add cluster/add-on/upgrade/on-call work without improving product delivery. ECS can be a poor fit where standard Kubernetes APIs or a mature shared platform are contractual requirements.

## Definition and terminology

ECS is AWS-native task/service orchestration. EKS runs Kubernetes APIs; AWS manages control-plane infrastructure, while data-plane and add-on operations depend on selected mode. Portability is not binary: both designs may rely on AWS IAM, networking, storage, and load balancing.

## Internal operation

ECS scheduler uses task definitions, service desired count, and capacity providers. Kubernetes controllers reconcile Deployments/Pods, scheduler and kubelet work across nodes, and add-ons implement networking/ingress/storage. Both need image supply chain, health, identity, capacity, logging, and upgrades; EKS adds Kubernetes API, RBAC, CRDs, controllers, and version skew.

## Worked example

Six services, 8-person team, all in AWS, no Kubernetes skill: ECS may reduce platform burden. An enterprise with 200 teams, internal Kubernetes APIs, platform engineers, and required operators may justify EKS. Compare per-service lead time, incident rate, upgrade toil, and staffing cost.

## Configuration lab

Prototype one API, one worker, one deploy, one rollback, and one AZ failure on each candidate. Record time, operators, custom components, failure recovery, and monthly cost. Include platform fee where applicable and compute spend.

## Alternatives and tradeoffs

ECS reduces Kubernetes surface and fits AWS-native integration. EKS unlocks Kubernetes ecosystem and standard APIs but shifts cluster lifecycle/extension responsibilities to the organization. Fargate/EC2 capacity is a separate axis from ECS/EKS.

## Failure analysis and debugging

ECS: service events, task placement, target health, capacity provider. EKS: Pod events, scheduler constraints, node health, add-ons, RBAC, and API version. In both, confirm app failure before blaming orchestrator.

## Practical exercise

Design a platform for 80 teams, 15 services each, four regions, and weekly Kubernetes operator releases. Then remove platform engineers and reduce to six AWS services. Explain how recommendation changes.

## Exercise checks
- Team operating model and lifecycle cost are explicit.
- Portability is decomposed into APIs, data, identity, and networking.
- Candidate runs real deployment/failure scenarios before standardization.

## Quick reference
- EKS manages control plane, not all Kubernetes operations.
- Choose platform from workload and team, not popularity.
