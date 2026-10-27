# AWS Batch or persistent workers

**Prerequisite:** Queues and ECS workers. **Sources:** [AWS Batch components](https://docs.aws.amazon.com/batch/latest/userguide/batch_components.html), [SQS delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html).

## Learning objectives
- Choose between job scheduling and a continuously polling worker service.
- Model queue delay, retries, resource requirements, and capacity startup.
- Identify Batch when job queues, priorities, fair-share, and diverse compute matter.

## Definition and internal operation

AWS Batch accepts jobs through job definitions and queues, then schedules onto compute environments. Managed environments can use EC2, Fargate, or supported managed capacity; scheduler considers job resources and queue policy. Persistent ECS workers maintain desired tasks and poll messages continuously. Both require idempotency and retry design.

## Worked example

10,000 independent reports arrive overnight, each needing 2 vCPU and 4 GiB for 3 minutes. Batch can queue and scale compute to job demand. A persistent worker can be simpler if arrivals are steady and low-latency processing matters. Estimate startup delay, scheduling overhead, throughput, and cost per completed report.

## Decision lab

Set acceptable queue age, arrival burst, runtime distribution, GPU/resource needs, priority/fair-share, retry limit, and checkpoint behavior. Batch jobs should be independent/retryable or checkpointed; service worker capacity should scale on backlog and be capped by dependencies.

## Tradeoffs and failure

Batch adds queue, compute-environment, and scheduler semantics but handles job-oriented placement. Persistent workers offer direct control and low dispatch delay but require scaling and worker fleet management. Queue starvation, blocked compute environment, insufficient capacity, and poison jobs need explicit alarms.

## Debugging procedure

Trace job ID from submission to queue, scheduler reason, CE capacity, task/container, logs, and final state. For persistent workers, inspect visible/in-flight counts, oldest age, receive/delete errors, and task concurrency.

## Practical exercise

Compare 60-minute video transcodes at 20 jobs/hour with 500 short jobs arriving in a 2-minute burst. Include Fargate/EC2/Batch and persistent ECS alternatives.

## Exercise checks
- Batch is not merely “a different container runner”; queue scheduling value is stated.
- Runtime duration, queue delay, and interruption behavior are considered.
- Worker duplicate processing is safe.

## Quick reference
- Batch models finite jobs; ECS service models desired long-running replicas.
- Use backlog age and completed-work rate to scale consumers.
