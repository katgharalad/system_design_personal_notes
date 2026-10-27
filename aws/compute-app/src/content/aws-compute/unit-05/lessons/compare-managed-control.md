# Managed services or infrastructure control

**Prerequisite:** Service responsibility. **Sources:** [compute guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html), [Well-Architected review](https://docs.aws.amazon.com/wellarchitected/latest/framework/appendix.html).

## Learning objectives
- Draw a responsibility boundary for AWS, platform team, and application team.
- Compare control, audit evidence, change speed, and failure response.
- Decide whether host-level control is a requirement or comfort preference.

## Problem

Managed services shift work; they do not remove application security, identity, data, SLOs, or incident ownership. Self-managed systems offer knobs but create patching and failure modes that the team must own.

## Internal operation

For every service, list managed hardware/facilities, control plane, guest OS/runtime, app code, data, IAM, network, monitoring, and response duties. Boundaries differ between EC2, Fargate, Lambda models, and managed platforms. Shared responsibility is service-specific and changes as the product evolves.

## Worked example

A compliance requirement says “all hosts patched within 14 days.” On EC2, define image pipeline and fleet replacement SLA. On Fargate, AWS manages host layer, while app image dependencies remain customer responsibility. Translate policy into evidence request: which layer, which actor, which report, and exception path.

## Decision lab

Build a RACI table for IAM, OS, runtime, app dependency, data encryption, backup, network, alert, deploy, and incident. Identify any row without a named owner.

## Tradeoffs and failure

More management control can improve custom fit and visibility but increases on-call burden and drift. Managed abstraction can limit configuration and require service-specific learning. Incident fails when teams assume AWS owns code or the app team owns physical hardware.

## Practical exercise

Compare EC2 and Fargate for a regulated document API. State responsibilities, evidence, data path, patch policy, and a host-level requirement that would rule out one option.

## Exercise checks
- Ownership covers code/data/IAM and underlying host boundary.
- Requirement is mapped to measurable control and evidence.
- No unsupported assumption about AWS operations.

## Quick reference
- “Managed” is a spectrum across service layers.
- Name owner and proof for every critical responsibility.
