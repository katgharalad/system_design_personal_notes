# AWS Batch architecture

**Prerequisite:** Queues and compute workloads. **Sources:** [AWS Batch components](https://docs.aws.amazon.com/batch/latest/userguide/batch_components.html), [managed compute environments](https://docs.aws.amazon.com/batch/latest/userguide/managed_compute_environments.html).

## Learning objectives
- Trace a job from submission through queue, scheduler, compute, and terminal status.
- Select resource requests and retry policy for finite work.
- Explain what a managed compute environment controls and what the app still owns.

## First principles

Batch processing is finite independent or checkpointed work. A scheduler needs job requirements, available capacity, priority/fairness policy, and retry state. Running each job manually on a VM requires building a queue, placement algorithm, capacity manager, cleanup, and failure tracking. AWS Batch provides job queues, job definitions, scheduling policies, and compute environments; it does not make a non-idempotent job safe to rerun.

## Execution walkthrough

Submit job with input reference and idempotency key → job enters queue → scheduler checks priority and resources → compute environment obtains supported EC2/Fargate/ECS Managed Instance capacity → container image pulls → job runs → exit code and attempt recorded → retry or terminal state → output becomes visible only after durable write.

## Worked example

12,000 files, mean processing 18 s, peak 300 jobs concurrently. At 2 vCPU per job, peak demand is 600 vCPU. If 75% of jobs average 18 s and 25% are 60 s, total compute is `9000×18 + 3000×60 = 342,000 job-seconds`, or 95 vCPU-hours at 1 vCPU each; at 2 vCPU/job, 190 vCPU-hours, excluding startup/retries/idle. Capacity need and total compute-hours are different quantities. Queue age target determines acceptable ramp-up.

## Configuration lab

```json
{
  "jobDefinitionName":"thumbnail-v4",
  "type":"container",
  "containerProperties":{"image":"123456789012.dkr.ecr.us-east-1.amazonaws.com/thumb@sha256:REPLACE","vcpus":2,"memory":4096}
}
```

Example requires real validated fields, execution role, logging, retry strategy, and resource settings before cloud use. No paid resource is created here. Batch-managed resources must be changed through supported Batch APIs, not manually edited.

## Alternatives and failure

Persistent ECS workers fit continuous consumption and low dispatch latency. Lambda fits short event work within selected model limits. Batch fits job queues, resource-based scheduling, and managed capacity. Failures include blocked queue, invalid CE, unavailable instance capacity, image pull errors, poison input, partial output, and retry loops.

## Failure investigation

Queue depth grows while no jobs run: inspect job status reason, queue/CE association, CE state, subnet egress, resource fit, quotas, and Spot/On-Demand supply. Job fails after output write: make output idempotent and commit a manifest/complete marker only after durable success; retries must not double-charge or overwrite newer result.

## Production checklist

- Job inputs/outputs are durable and versioned.
- Retries are bounded, classified, and idempotent.
- Queue age, runnable/blocked jobs, attempts, and CE health alarm.
- Resource-aware scheduling includes external licenses/API/DB budgets.

## Practical exercise

Run local Docker jobs against a file manifest; kill a worker after output write but before completion. Prove retry does not duplicate output. Estimate vCPU-hours and queue time separately.

## Exercise checks
- Capacity is expressed in vCPU and memory per job, separately from total vCPU-hours.
- A retry cannot repeat an external side effect without an idempotency guard.
- Queue age and blocked-job reason have separate signals.
- Worker interruption and image-pull failures have safe retry or terminal handling.

## Quick reference

- Job definition describes execution; queue holds work; compute environment supplies capacity.
- Batch manages batch resources; app owns correctness, idempotency, and data.
