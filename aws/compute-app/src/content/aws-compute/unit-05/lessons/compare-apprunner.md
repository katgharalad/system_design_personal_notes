# App Runner or ECS

**Prerequisite:** ECS fundamentals. **Sources:** [AWS App Runner lifecycle notice](https://docs.aws.amazon.com/apprunner/latest/dg/apprunner-availability-change.html), [ECS Express Mode](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-mode.html), [App Runner guide](https://docs.aws.amazon.com/apprunner/latest/dg/what-is-apprunner.html).

## Learning objectives
- Compare simplified app-to-service deployment with ECS control and features.
- Apply current App Runner customer-availability caveat.
- Evaluate migration to ECS Express Mode when creating a new design.

## Problem

Architecture recommendations become stale when product availability changes. AWS documentation states App Runner is closed to new customers, while existing customers can continue operating; AWS recommends ECS Express Mode as a new alternative. A current design must state this boundary.

## Internal operation

App Runner builds from source or deploys image and manages service start, scaling, and load balancing. ECS gives direct task/service, networking, IAM, and deployment configuration. ECS Express Mode provisions an ECS/Fargate service plus ALB, target groups, health checks, scaling, SG/networking, and URL from a simpler API. It still creates billable underlying resources.

## Worked example

Existing App Runner customer with small source-based API can continue but should document support lifecycle and migration option. New team should evaluate ECS Express Mode or ECS standard. If custom target registration, sidecars, service-to-service networking, or fine-grained rollout is needed, ECS standard may be more suitable.

## Decision lab

List required network, deployment triggers, image provenance, scaling controls, custom domains, auth, observability, and resource ownership. Compare default and override behavior; verify current regional availability.

## Tradeoffs and failure

Simplified service reduces setup, but hides some configuration and binds to product lifecycle. ECS standard exposes more knobs and operational choices. Diagnose through service events and generated resources; do not assume abstraction owns application IAM or data.

## Practical exercise

Design a new public API with a private DB and controlled egress. Evaluate ECS Express Mode, then identify which extra networking/identity controls are needed and if simplification still fits.

## Exercise checks
- New customer and existing customer paths are distinct.
- ECS Express Mode resources and underlying charges are named.
- Decision based on necessary controls, not product branding.

## Quick reference
- Check App Runner availability notice first.
- ECS Express Mode simplifies ECS provisioning; ECS remains underlying service.
