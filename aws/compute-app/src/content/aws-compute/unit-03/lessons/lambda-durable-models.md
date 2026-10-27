# Lambda durable workflows and compute boundaries

**Prerequisite:** Invocation models, retries, IAM, and Step Functions/workflow basics. **Sources:** [Durable function concepts](https://docs.aws.amazon.com/lambda/latest/dg/durable-basic-concepts.html), [durable configuration](https://docs.aws.amazon.com/lambda/latest/dg/durable-configuration.html), [durable invocation](https://docs.aws.amazon.com/lambda/latest/dg/durable-invoking.html), [Fargate or Lambda decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/fargate-or-lambda.html), [Lambda execution lifecycle](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html), [Lambda Managed Instances](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances.html).

## Learning objectives
- Distinguish one invocation’s timeout from an end-to-end durable execution timeout.
- Explain checkpoint, wait, resume, replay, state retention, and side-effect idempotency.
- Compare Event Functions, Durable Functions, Lambda Managed Instances, Fargate, and Step Functions by workload boundary.
- Choose the simplest execution model that satisfies duration, control, and recovery needs.

## Problem: long elapsed time is not long CPU time

A workflow may submit an external job, wait for a person to approve it, then resume the next day. Running one process and sleeping for 24 hours holds a worker or execution for mostly idle time and loses progress if the process fails. A reliable design separates the workflow clock from compute execution: save durable progress, release compute while waiting, and resume from a checkpoint when a new event arrives.

The important distinction is between **elapsed workflow duration** and **one function invocation duration**. A durable workflow can span many invocations and long waits. Each individual compute invocation still has its own timeout and resource allocation. A statement such as “Lambda runs for one year” is misleading unless it says the durable execution may span up to one year while its individual invocations remain bounded.

## Durable execution concepts

A Durable Function records execution state and step results through a durable execution model. A checkpoint marks progress that can be resumed. A wait operation suspends the current work; it does not require a CPU to stay active for the whole wait. An external event or timer can resume a later step. Execution history provides a record of progress and failures for the configured retention period.

When a durable execution resumes, code may be re-entered or replayed to reconstruct orchestration state. A side effect must therefore be placed in a supported durable step pattern and designed for retries/recovery. Do not assume ordinary process memory survives a checkpoint. Do not place a non-idempotent payment call around a replayable section and assume it runs once. Use a stable operation key, a durable result, and reconciliation for ambiguous external outcomes.

Durable execution timeout and retention are separate settings. Timeout bounds total elapsed time from start to terminal status. Retention controls how long history remains available after completion. Current AWS docs describe a maximum durable execution time of one year and a history retention period with its own configured range. These values and feature availability are version-sensitive; inspect current documentation and deployment APIs before designing against them.

## Lifecycle: invocation versus workflow

```text
Start execution
  -> invocation runs Step A
  -> checkpoint result
  -> wait for approval (no long-running handler required)
  -> approval event resumes execution
  -> next invocation runs Step B
  -> checkpoint
  -> terminal success/failure/timeout
```

The durable state machine surrounds individual invocations. One invocation can fail and be retried while the overall execution remains active. A durable execution can eventually fail, time out, be stopped, or succeed. An event source mapping can invoke a durable function, but source-specific invocation timeouts still apply. The workflow’s maximum elapsed duration does not grant an individual invocation an unbounded runtime.

## Worked example: document approval

An insurance document workflow has three steps: validate upload, run OCR, wait for a human approval, then create a policy record. OCR takes 40 seconds. Human review can take 5 days. A durable execution is a candidate because it can persist progress between steps and release compute during the wait. Store document metadata and S3 object version as durable business state; use an approval token and a bounded wait. On approval, resume and verify the document has not been replaced.

Idempotency keys can be `workflowId:stepName`. `create-policy` must enforce a unique workflow key in the database. If the provider call succeeds but the response is lost, reconcile before issuing a second policy. The durable workflow records orchestration progress; it does not automatically make third-party side effects exactly once.

## Worked example: high-throughput thumbnails

Each thumbnail task uses 4 seconds of CPU. Ten million objects arrive in a batch. This is not a single one-year durable workflow; it is a high-volume queue of independent work. SQS + Lambda event source mapping can batch work if each invocation fits its timeout and memory, duplicate processing is safe, and downstream storage can handle concurrency. AWS Batch or ECS workers may fit if jobs are longer, need custom containers, GPU, or explicit compute scheduling. Durable workflow state for every independent thumbnail can add cost and history without providing useful orchestration value.

## Worked example: long-lived listener

A process must maintain a WebSocket connection and react to messages continuously. A standard Event Function is invoked for bounded events; keeping a process alive as a listener is a different execution model. ECS/Fargate, EC2, or a purpose-built managed service may fit better. Durable Functions do not turn a Lambda invocation into a forever-running socket listener. Choose an always-on service when the workload requires persistent connections, process state, custom agents, or predictable long-lived execution.

## Comparison framework

| Model | Best fit | Main boundary to test |
| --- | --- | --- |
| Lambda Event Function | Short event/request work; bursty or variable demand | Invocation timeout, payload/integration semantics, cold path, concurrency and RPS quotas |
| Lambda Durable Function | Multi-step work with waits, checkpoints, and resume across long elapsed time | Per-invocation timeout, supported durable APIs, execution timeout, replay-safe side effects, history retention |
| Lambda Managed Instances | Event Function code needing a different managed capacity/runtime model | Current feature support, invocation duration, scaling/configuration semantics, and supported integrations |
| ECS/Fargate | Long-running container service or worker without host management | Task lifecycle, deployment, task scaling, networking, persistent process, cost under steady use |
| EC2 | OS/host control, specialized agents, or steady fleet with custom operations | Patching, AMI lifecycle, capacity, security, and replacement ownership |
| Step Functions | Explicit service orchestration, branching, retries, waits, and execution history | State-machine design, service integrations, payload/state limits, workflow cost, and operational ownership |
| AWS Batch | Finite jobs needing queueing, resource-aware scheduling, and large compute environments | Queue age, placement, retries, container resources, and completion deadlines |

These are starting points, not feature checklists. Compare total system: compute occupancy, idle time, state persistence, dependency pressure, developer workflow, audit needs, and operational ownership.

## Configuration example

Illustrative CloudFormation resource shape; exact property support depends on current Lambda durable-function API and deployment tooling. Review generated change sets before applying. This example creates resources if deployed.

```yaml
Resources:
  ApprovalWorkflow:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: document-approval
      Runtime: nodejs24.x
      Handler: index.handler
      Role: !GetAtt ApprovalRole.Arn
      Code:
        S3Bucket: deployment-artifacts
        S3Key: document-approval.zip
      Timeout: 300
      DurableConfig:
        ExecutionTimeout: 604800
        RetentionPeriodInDays: 30
```

`ExecutionTimeout` here is seven days in seconds (`7 × 24 × 60 × 60`), an illustrative business limit, not the one-year maximum. Function `Timeout` remains 300 seconds per invocation. Verify current schema, runtime support, and required durable APIs before deploying. Add KMS configuration if needed and restrict history access.

## Failure diagnosis

**Workflow stalls at approval.** Inspect execution status, wait state, token/approval record, execution timeout, event delivery, and retention. Check whether an approval event points to the correct execution and whether permissions permit resume. Do not restart the whole workflow without checking whether earlier side effects committed.

**Duplicate policy after resume.** Compare workflow history, step attempt, policy row, external provider idempotency key, and response timeline. The side effect likely occurred before checkpoint/acknowledgement. Add unique durable key and reconcile existing policy before retry. Avoid broad replay that repeats unrelated steps.

**Execution history missing during incident review.** Check configured retention and terminal timestamp. History retention is not the same as business record retention. Persist domain records and audit events in a system designed for the required legal and operational retention.

## Interview reasoning

If asked to process a 12-hour video job, first ask whether it is CPU-bound continuous work or a multi-step workflow with waits. If it needs 12 hours of uninterrupted CPU, Durable Functions may not help because individual invocation duration remains constrained; use Batch, ECS, or another appropriate worker model. If it consists of 3-minute steps separated by customer approvals, durable orchestration can avoid holding workers idle. State which step stores progress and how side effects remain safe on resume.

If requirements change to “must serve an HTTP request in 200 ms p99,” long-running durable workflow is a poor synchronous path. Persist a job and return `202 Accepted` plus status resource if product allows asynchronous completion. If the caller needs the answer before responding, optimize/partition the request or select a continuously available service that meets the latency profile.

## Practical exercise

Design a travel approval workflow: reserve inventory, wait up to 48 hours for manager approval, charge a card, and issue a ticket. Draw durable checkpoints and name the idempotency key for every external side effect. Then change requirement: inventory reservation expires after 10 minutes and the card provider has no idempotency API. Explain whether the same workflow design still fits and how you reconcile ambiguous charge outcomes.

## Exercise checks
- Separates total workflow elapsed time from per-invocation timeout.
- Releases compute during long wait rather than sleeping in a handler.
- Includes durable state, checkpoint, timeout, retention, and resume authorization.
- Handles external side-effect ambiguity with idempotency or reconciliation.
- Reconsiders model when continuous CPU, persistent socket, or strict request latency becomes the primary workload.

## Quick reference
- Durable workflow can span long elapsed time through multiple bounded invocations.
- One-year workflow duration does not mean one-year handler invocation.
- Checkpointing state does not make external side effects exactly once.
- Use Event Functions for event-shaped work; use worker/orchestration models that match sustained compute and workflow needs.
- Recheck current feature limits, supported integrations, and runtime availability.

## Roman Hinglish explanation

Workflow das din ruk sakta hai, jabki actual CPU kaam sirf kuch seconds ho. Standard Lambda invocation ko das din zinda rakhna sahi model nahi: invocation timeout hai, aur wait karte hue concurrency aur resources occupy honge. Durable workflow state save karta hai, wait karta hai, phir next bounded activity chala sakta hai. Lekin orchestration durable hone se external payment exactly-once nahi ho jaata. Payment API ko idempotency key do, aur crash ke baad state reconcile karo. Step Functions tab suit kar sakta hai jab branching, history, retries, human approval aur operational visibility central hon. Durable Lambda ki current capabilities aur limits docs se verify karo. Managed Instances bhi standard Event Function jaisa nahi; persistent process aur concurrent requests ke liye shared-state/thread safety alag se test karo.
