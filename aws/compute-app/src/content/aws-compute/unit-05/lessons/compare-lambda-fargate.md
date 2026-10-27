# Lambda or Fargate

**Prerequisite:** Lambda and ECS fundamentals. **Sources:** [current Fargate/Lambda guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/fargate-or-lambda.html), [Lambda durable invocation](https://docs.aws.amazon.com/lambda/latest/dg/durable-invoking.html), [Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html).

## Learning objectives
- Compare handler invocation with a continuously running container task.
- Select from duration, dependency, concurrency, persistence, and networking constraints.
- Avoid outdated “Lambda always ends at 15 minutes” generalizations across current Lambda models.

## Problem

Both are managed compute, but one is a function/event execution model and one runs containers as tasks. Picking from “serverless” alone ignores lifecycle and request shape.

## Definition and terminology

Standard Lambda Event Functions are event-oriented and have a documented per-invocation timeout bound. Current AWS guides separately describe Lambda durable functions for checkpointed workflows and Lambda Managed Instances for configurable EC2-backed function capacity. Fargate runs ECS/EKS container tasks without customer-managed hosts, supporting persistent services and tasks subject to current platform constraints.

## Internal operation

Lambda trigger maps event to handler; concurrency is per execution model and downstream admission must be bounded. Fargate task is scheduled with CPU/memory/network configuration; ECS service can keep desired replicas alive, route HTTP, and stop/replace tasks. For a 45-minute process, compare supported Lambda model and Fargate task semantics, cancellation, checkpoint, and pricing—do not infer solely from old rule of thumb.

## Worked example

An image job averages 8 minutes, p99 22 minutes, needs a native library, and arrives in bursts. Lambda Event Function timeout may exclude p99; a queue and Fargate worker can process long-running tasks. If work can be checkpointed and durable model fits, evaluate that separately. Consider Batch when scheduling, retries, and compute environments are central.

## Configuration lab

Document event source, max runtime, cancellation, partial failure, container dependencies, concurrency cap, queue visibility/heartbeat, task memory/CPU, and cost per successful job. Test duplicate delivery and worker termination.

## Alternatives and tradeoffs

Lambda has less container/service management and event integration. Fargate gives container control, long-lived process, and fine-grained task resources, with ECS service/network setup. Durable orchestration or Batch may better model long workflows or job scheduling.

## Failure analysis and debugging

Check Lambda model/timeout and trigger retry; or ECS task stopped reason, deployment, visibility timeout, and task logs. Ensure work ack follows durable outcome. VPC and DB connection pressure apply to both.

## Practical exercise

Choose for 45-minute sensitive document processing with uneven arrivals and native dependency. Give two valid designs under different assumptions and specify encryption, egress, retry, and cost questions.

## Exercise checks
- Names exact Lambda execution model considered.
- Container design includes durable job state and idempotency.
- Cost comparison uses successful work and utilization.

## Quick reference
- “Serverless” does not mean same invocation or billing model.
- Validate current service guide because Lambda offerings evolve.
