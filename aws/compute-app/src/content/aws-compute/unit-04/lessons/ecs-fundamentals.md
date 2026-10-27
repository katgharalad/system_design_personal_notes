# ECS clusters, tasks, task definitions, and services

**Prerequisite:** ECR. **Sources:** [ECS task definitions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html), [ECS services](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_services.html).

## Learning objectives
- Explain cluster, task definition, task, service, capacity provider, and deployment revision.
- Trace desired-state reconciliation when a task stops.
- Design task role, execution role, health, network, and resource requests.

## Problem

“ECS runs my container” hides distinct failure points. A task definition can be valid while no capacity is available; task can run but fail target health; service can replace a task that exits but repeat the same bad configuration forever.

## Definition and terminology

A **task definition revision** is an immutable template of containers, image, CPU/memory, ports, volumes, logging, and IAM roles. A **task** is a running instantiation. An **ECS service** maintains a desired task count and integrates deployment, health replacement, and load balancing. A **cluster** groups tasks/capacity logically. A **capacity provider** connects placement to Fargate or EC2-backed capacity. ECS is the scheduler/control plane; image is in ECR.

## Internal operation

Service scheduler compares desired and running healthy task count. It asks the chosen capacity provider to satisfy placement constraints, starts tasks, waits for container/target health, and replaces failures. For EC2, host resource reservation and ECS agent state constrain placement. Fargate removes host selection but subnets, quotas, platform support, and task resource shape still constrain launch.

## Execution lifecycle

Build/push image → register task-definition revision → update service → scheduler places task → ENI/image/logging/secrets setup → process health → target registration → old task drains → steady state.

## Worked example 1

Service desired count 3, deployment minimum healthy 100%, maximum 200%. ECS may need capacity for up to 6 tasks during rolling replacement depending on deployment settings. On EC2, cluster must have spare CPU/memory and ports; on Fargate, subnet IPs and account quotas still matter. Validate placement before a production deploy.

## Worked example 2

Task exits with code 137 and is relaunched repeatedly. Possible causes include OOM kill, forced termination, or process behavior; exit code alone is not diagnosis. Compare task memory, container memory limit, stopped reason, logs, and deployment timestamp.

## Configuration lab

```json
{
  "family":"api",
  "requiresCompatibilities":["FARGATE"],
  "networkMode":"awsvpc",
  "cpu":"512","memory":"1024",
  "executionRoleArn":"arn:aws:iam::123456789012:role/ecsExecution",
  "taskRoleArn":"arn:aws:iam::123456789012:role/apiTask"
}
```

This is a schematic snippet; validate allowed CPU/memory combinations and required container definitions for the selected platform. Never use one broad role for both image pull and application actions.

## Alternatives and decision boundary

ECS is AWS-native orchestration with a smaller Kubernetes API surface. EKS runs Kubernetes and its ecosystem. ECS services suit long-running desired-count workloads; Batch suits submitted finite jobs; Lambda suits event handlers. They may coexist.

## Tradeoffs

ECS lowers control-plane and Kubernetes operational surface, but couples orchestration APIs to AWS. Service desired count repairs process count, not app correctness. Resource reservations improve placement but can fragment capacity.

## Failure analysis

`PENDING`: capacity/placement/subnet/quota. `STOPPED`: image, entrypoint, IAM, secret, memory, or app. Running but unhealthy: port, health path, SG, startup time. Desired count mismatch: service events and deployment circuit breaker.

## Debugging procedure

Inspect service events → deployment/task revision → stopped reason → container exit/logs → capacity provider/placement → task ENI/SG → target health. Compare with one known-good revision. Avoid repeatedly forcing deployment without changing the failing input.

## Production checklist
- Desired count and deployment surge capacity are explicit.
- Execution/task roles are separate and least privilege.
- Logs, health, CPU/memory, stopped reasons, and service events are retained.
- Deployment rollback and graceful task stop are tested.

## Practical exercise

Deploy the included Node service from ECR. Increase desired count, kill one task, and observe replacement. Change image to a bad health path and verify deployment failure/rollback rather than a restart loop.

## Exercise checks
- Task definition, task, service, and cluster have distinct roles.
- Replacement uses the configured revision and capacity provider.
- Health and process exit are diagnosed separately.

## Quick reference
- Definition is template; task is execution; service maintains desired state.
- Fargate still needs IAM, VPC, quotas, and downstream capacity.

## Trace desired count to a serving task

ECS checks the task definition, placement rules, capacity provider, available CPU/memory/ports, subnet addresses, quotas, image access, and deployment bounds. Fargate avoids host selection, but still needs a supported size, quota, address, IAM access, and network path. Image pull, ENI setup, secret retrieval, logging, and process startup can fail at different stages. `RUNNING` is not equivalent to ready for customer traffic. Container health runs inside the container; ALB health checks the target over the network. ECS task health considers essential containers with configured checks. See [ECS task health](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/healthcheck.html).

## Incident drill

Four tasks run, but ALB has zero healthy targets. Check target type (IP for `awsvpc`), port, health path, ALB-to-task security-group rule, route, and process bind address. A listener on `127.0.0.1` passes an in-container check but cannot receive traffic through the task ENI. Read target reason codes before changing rules. If deployment fails, the [ECS circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html) can roll back to the latest completed revision; keep that image and compatible data available.

## Hinglish explanation

Desired count repair loop hai, readiness guarantee nahi. Image, ENI, secret, process, container health aur ALB probe alag stages hain. Same bad revision ko replace karne se failure repeat hota hai. Exact stopped reason aur target-health code dekho. Deployment surge ke liye host capacity, Fargate quota aur subnet IP gino. Rollback tabhi chalega jab purana revision aur compatible schema bache.

## Deeper walkthrough: from desired count to a serving target

Suppose the service asks for three tasks. ECS evaluates the task definition, launch mode, placement constraints, capacity, subnet addresses, and deployment limits. For EC2 capacity, the container instance must be registered and have enough unreserved CPU, memory, ports, architecture, and placement resources. For Fargate, AWS supplies the host, but the task still needs a supported CPU/memory pair, quota, a usable subnet address, and working image and secret access.

After placement, the task moves through provisioning and startup. Image pull, ENI setup, log initialization, secret retrieval, and application initialization can each fail. A task can reach `RUNNING` while the application is still unable to serve. A container health check runs inside the container; a load balancer health check probes a registered target over the network. These checks answer different questions. ECS task health only uses checks defined for essential containers. ALB target health tests the network path and configured response. A readiness endpoint should report whether the process can accept its real work, not merely whether a TCP port is open. See [ECS task health](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/healthcheck.html).

When a task stops, service reconciliation tries to restore desired count. This helps with a host failure or transient crash. It can repeat a deterministic defect: every replacement uses the same bad image, missing secret, or impossible placement rule. Read service events and stopped reasons as a sequence. Identify whether the task failed before `RUNNING`, after `RUNNING`, or after target registration. Then inspect the matching deployment revision. A healthy count is not proof the release is correct: a healthy replacement can still return wrong data or drop work.

## Worked incident: tasks run, but no requests reach them

The service reports desired count four and four running tasks. The ALB reports zero healthy targets. Compare target type and task network mode: `awsvpc` tasks have their own ENI and are normally registered as IP targets. Verify listener, target group, and port. Inspect target health reason codes, task security-group ingress from the ALB security group, subnet routes, and process bind address. A server bound only to `127.0.0.1` can pass an in-container check and fail the ALB probe. Do not loosen every inbound rule; change the exact path the evidence shows is blocked.

For a deployment, compute surge before release. With desired count eight and maximum deployment percentage 200%, ECS may need room for up to sixteen tasks during replacement, subject to minimum healthy percentage and placement. EC2 clusters need spare host resources; Fargate needs subnet IPs and quota. If the revision never becomes healthy, the ECS rolling deployment circuit breaker can mark it failed and optionally roll back to the latest completed deployment. The rollback needs working capacity and compatible data. Keep old image digests available and use backward-compatible schema changes. [Circuit breaker behavior](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html).

## Hinglish explanation

ECS desired count maintain karta hai, par `RUNNING` ka matlab “request serve karne ko ready” nahi. Image pull, ENI, secret, process startup, container health aur ALB health alag checkpoints hain. Task fail par replacement aa sakta hai; same bad revision se loop banega. Exact stage aur reason code dekho. Deployment se pehle surge capacity, subnet IP aur quota gino. Circuit breaker sirf pehle ke completed revision par rollback kar sakta hai; data compatibility bhi tumhari zimmedari hai.
