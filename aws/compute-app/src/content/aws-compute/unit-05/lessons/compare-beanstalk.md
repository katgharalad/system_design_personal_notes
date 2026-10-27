# EC2 or Elastic Beanstalk

**Prerequisite:** EC2 operations. **Sources:** [Lightsail, Beanstalk, or EC2 guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/lightsail-elastic-beanstalk-ec2.html), [compute guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html).

## Learning objectives
- Separate application platform automation from underlying EC2 resources.
- Compare deployment control and infrastructure ownership.
- Identify when Beanstalk abstraction helps or constrains operations.

## Definition and internal operation

Elastic Beanstalk provisions and coordinates AWS resources for application environments, commonly including EC2, load balancing, scaling, and monitoring. It does not remove the EC2/OS/app responsibility boundary. Direct EC2 gives more control but requires the team to assemble deployment and fleet automation.

## Worked example

A small team deploys a conventional web app with supported runtime and limited infrastructure customization: Beanstalk can reduce setup. A service needs unusual network policy, custom fleet lifecycle, or platform composition: direct EC2/containers may fit better. Compare the generated resources and failure/debug path before choosing.

## Configuration lab

For both options, write build artifact, launch configuration, environment variables, health path, deployment strategy, log collection, rollback, and patch process. Identify which settings Beanstalk owns and which remain account resources.

## Tradeoffs and failure

Beanstalk standardizes common deployment operations but its platform abstraction can obscure resource drift or impose supported runtime behavior. EC2 is flexible but expands operational burden. Failed deploy debugging still needs environment events, instance logs, health, IAM, and load-balancer evidence.

## Practical exercise

Choose for a Django app with custom kernel library, daily traffic peaks, and two engineers. Then remove host customization and add compliance requirement for pinned deployment artifacts. Explain how answer changes.

## Exercise checks
- Beanstalk is described as an application platform over AWS resources.
- Guest OS/AMI responsibility is not erased by the abstraction.
- Rollback and observability are compared.

## Quick reference
- Beanstalk automates common app environment tasks; EC2 offers direct control.
- Compare the actual resources and ownership boundaries.
