# Lightsail, Elastic Beanstalk, or EC2

**Prerequisite:** EC2 and Beanstalk. **Sources:** [AWS entry-options decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/lightsail-elastic-beanstalk-ec2.html), [compute decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html).

## Learning objectives
- Compare bundled simplicity, platform deployment, and VM control.
- Identify migration signals as workload grows.
- Avoid treating a simplified product as a universal production architecture.

## Definition and terminology

Lightsail packages common cloud resources and predictable entry-level workflows. Beanstalk automates application environment deployment on AWS resources. EC2 exposes VM provisioning and associated building blocks. Product boundaries and feature availability evolve; verify current guide and region before selection.

## Worked example

A single small site with one operator may prioritize bundled setup. A team deploying supported app versions may prefer Beanstalk. A service requiring custom network, fleet, or host behavior may justify EC2. Migration trigger might be networking control, scaling policy, security requirement, or need to integrate a broader AWS architecture—not arbitrary user count.

## Decision lab

For each option, list custom domain/TLS, VPC control, database backup, HA across AZ, scaling, IAM, observability, deployment rollback, and cost units. Identify which are included defaults and which require customer configuration.

## Tradeoffs and debugging

Simplification narrows choices and can improve time-to-first-deploy; constrained resource models can later require migration. EC2 customization supports broad designs but needs complete ops. For an incident, identify actual backing resource before diagnosing: instance status, managed environment event, or bundled service metrics.

## Practical exercise

A prototype grows to two AZs, private DB, compliance logs, and bursty jobs. Define what remains on the original entry platform and what moves. State a migration path with DNS, data migration, rollback, and acceptance checks.

## Exercise checks
- Recommendation names real feature boundary and user skill.
- Data and network migration risks are explicit.
- No assumption that a dashboard default equals HA.

## Quick reference
- Lightsail favors bundled simplicity; Beanstalk app deployment; EC2 VM control.
- Verify current service capabilities before committing.
