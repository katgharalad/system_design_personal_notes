# Container lifecycle and local execution

**Prerequisite:** Images and Dockerfiles. **Sources:** [ECS task definitions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html), [ECS deployment guide](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_services.html).

## Learning objectives
- Run and inspect the provided Node service locally.
- Handle SIGTERM and readiness without losing in-flight work.
- Separate container exit, restart, and durable job completion.

## Problem

A container restart is not a recovery plan. The process may be killed while handling a request, and the orchestrator may replace it while a queue message becomes visible again. Apps must tolerate interruption and expose health.

## Definition and terminology

Container lifecycle includes create, start, running, stop signal, grace period, forced kill, and removal. Exit code indicates process termination, not necessarily business outcome. A health check probes process/application condition. Restart policy is local runtime behavior; ECS service desired count is a distributed control loop.

## Internal operation

The runtime starts the image command as PID 1 (or forwards signals depending on entrypoint). PID 1 must reap children and handle signals. Docker sends SIGTERM then SIGKILL after configured grace. ECS stops tasks during deployment, scale-in, or replacement. App needs to stop taking new requests, drain in-flight requests, close DB pools, and finish or safely release work before grace expires.

## Execution lifecycle

`docker build` → container create → env/network/mount configured → entrypoint starts → health route responds → request accepted → SIGTERM → readiness flips false → server drains → connections close → process exits → runtime removes container.

## Worked example 1

An HTTP handler needs up to 8 s to finish, but stop timeout is 5 s. ECS sends SIGTERM and then kills process before response completes. Increase grace only if deployment capacity and request timeout allow it; implement bounded drain and retry-safe request handling.

## Worked example 2

Worker receives SQS message, writes DB row, then crashes before deleting the message. Message is delivered again. The worker must use idempotency/deduplication so duplicate delivery does not create a second charge. Graceful shutdown helps but cannot replace idempotency.

## Configuration lab

```bash
docker build -t interview-lab:local .
docker run --rm --name interview-lab -p 3000:3000 --init interview-lab:local
curl -i http://127.0.0.1:3000/health
docker stop --time 20 interview-lab
```

Use sample container app assets from the module. Verify `SIGTERM` logging and a clean exit. `--init` supplies a small init process for signal and child handling in this local exercise.

## Alternatives and decision boundary

Short-lived process may exit after one job; ECS service maintains a long-lived replica count. AWS Batch schedules finite jobs. Lambda runs event handlers under its duration/execution model. Choose based on work semantics rather than process packaging alone.

## Tradeoffs

Longer shutdown allows draining but delays replacement and deployment. Fast forced stop shortens recovery but raises duplicate/partial-work risk. Local restart may hide crash loops; observe restart count and exit reasons in orchestration.

## Failure analysis

Container exits: inspect code, stdout/stderr, OOM, command, and env. Health fails but process lives: test readiness path and dependency timeouts. Shutdown hangs: inspect open requests, child processes, and pool close. Local success but cloud failure: compare ports, architecture, IAM, DNS, and network.

## Debugging procedure

Start with `docker ps -a`, `docker logs`, `docker inspect`, resource use, and health result. Reproduce exact image and env minus secrets. Terminate during an in-flight request and verify client retry/idempotency behavior.

## Production checklist
- Process handles TERM and has a bounded shutdown deadline.
- Readiness and liveness answer different questions.
- Jobs are idempotent across crash/retry.
- Logs go to stdout/stderr with request/job IDs.

## Practical exercise

Run the local service, send a slow request, stop the container, and observe response and signal logs. Add graceful drain, repeat, then simulate worker crash after DB commit.

## Exercise checks
- Shutdown path is demonstrated rather than assumed.
- Queue redelivery remains safe after DB commit.
- Health endpoint is reachable on the configured container port.

## Quick reference
- TERM, drain, close dependencies, exit; do not rely on KILL cleanup.
- Orchestrator replacement creates at-least-once effects unless app prevents them.

## Local test boundary

Local containers test build, entrypoint, health endpoint, and dependency wiring. They do not prove AWS IAM, task metadata, Fargate isolation, ALB registration, VPC routes, subnet IP availability, quotas, or deployment behavior. Label each test boundary. Use unit tests for logic, container tests for packaging/process behavior, and a bounded AWS integration environment for cloud-only contracts. Never mount developer credentials into an untrusted container.

Test SIGTERM during an in-flight request: stop admission, drain work, close pools, flush logs, and exit before grace expires. For queue workers, verify unacknowledged work redelivers safely and duplicate processing has no second side effect. Test missing config, unavailable dependencies, failed health, memory pressure, and architecture mismatch.

## Test matrix

Run the same image digest intended for release. Record expected exit, health transition, log evidence, replacement or rollback behavior. Then test AWS-only assumptions in nonproduction and clean up billable resources.

## Hinglish explanation

Local Docker packaging aur process behavior dekhta hai; AWS IAM, route, quota aur ALB path nahi. SIGTERM, duplicate job aur dependency failure test karo. Cloud behavior ke liye isolated AWS integration chahiye. “Works locally” production proof nahi.

## Reproduce a shutdown race locally

Use the production image and send SIGTERM while one request waits on a dependency. The application should stop accepting new work, finish only within a documented drain deadline, close its pool, and exit. If the deadline expires, the orchestrator can force termination. Emit shutdown-start, active-request count, drain-complete, and exit status so a test can distinguish graceful completion from forced kill.

For queue consumers, test three cut points: before the business transaction, after commit but before acknowledgement, and after acknowledgement. Redelivery before commit should perform work; redelivery after commit must not repeat its business effect; acknowledged work must not be lost under the queue contract. Use a stable test key and assert database state, emitted event count, and acknowledgement. A happy-path log alone cannot prove exactly-once effects.

Keep cloud-specific integration small but real. A disposable test service can verify task-role identity, secret access, ECR pull, log delivery, security-group path, and target health. Give it a maximum task count and automatic cleanup. Store stopped reason, target reason, and IAM denial separately so failures remain diagnosable without dumping secrets.

### A practical pass/fail contract

For each integration run, define expected task state, health transition, user-visible result, and cleanup. A passing check should assert a request reached a healthy target, the application used the intended role, and logs contain a correlation ID without secrets. A failure injection should prove that dependency loss leads to a bounded timeout or explicit degraded response rather than an unbounded retry storm. Save image digest and task-definition revision with the test record. Cost controls include short retention, low desired count, and removal of endpoints or databases created for the test.
