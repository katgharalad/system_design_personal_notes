# Container networking and persistence

**Prerequisite:** Container lifecycle. **Sources:** [ECS task networking](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-networking.html), [Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html).

## Learning objectives
- Trace a task ENI and security groups in `awsvpc` mode.
- Choose ephemeral, EBS, EFS, or S3 storage by access semantics.
- Avoid relying on container-local files after replacement.

## Problem

Containers are replaceable processes. A file written to a container layer usually disappears with task replacement. A service that stores uploaded data in local disk can appear healthy and then lose data during scale-in or deploy.

## Definition and terminology

In ECS `awsvpc` mode, a task receives an ENI in a VPC subnet and SGs. Task IP and network policy are distinct from the EC2 host's primary ENI. Ephemeral storage supports temporary files and has task lifecycle limits; EBS and EFS offer block/file semantics under supported configurations; S3 stores objects, not POSIX files. Confirm current platform support and constraints before selecting persistent mounts.

## Internal operation

For Fargate, AWS provisions task networking and managed compute; the task still needs subnet IPs, SG rules, routes, DNS, and service endpoints. For EC2 launch type, ECS agent and host networking/placement add another layer. Load balancer target type must match addressability (`ip` for awsvpc tasks). Secret access and data access are separately controlled by IAM and network path.

## Execution lifecycle

Scheduler selects subnet → task ENI is allocated → image pulled → container starts → target registers → traffic reaches task IP/port → stop drains target → task ENI and ephemeral filesystem go away.

## Worked example 1

A task writes 400 MB temporary conversion output. Keep it in task ephemeral storage only if job can recreate it and task size supports peak plus scratch overhead. Persist final object to S3 before acknowledging job. Do not assume two tasks share that directory.

## Worked example 2

A private task pulls from ECR and calls S3. It needs network route to image registry endpoints during startup, plus appropriate IAM and endpoint/repository policy. S3 Gateway Endpoint can route service traffic without NAT; ECR API/Docker registry and image layer paths need their own supported endpoint/NAT design.

## Configuration lab

```json
{"networkMode":"awsvpc","requiresCompatibilities":["FARGATE"],"cpu":"512","memory":"1024"}
```

Task networking is configured on the ECS service/run-task request: subnets, security groups, and public IP assignment. Keep tasks private unless public addressing is a deliberate requirement.

## Alternatives and decision boundary

Use S3 for durable object data, EFS for shared file access, EBS for block workloads with supported attachment semantics, and ephemeral space for scratch. Do not select persistent storage only because app code currently calls `open()`; refactor to the correct storage API if durability matters.

## Tradeoffs

Shared storage can simplify coordination but adds latency, throughput limits, permissions, and failure dependencies. Object storage scales well but requires object-oriented access. Task ENIs give clear policy boundaries but consume subnet addresses.

## Failure analysis

Task pending: inspect subnet IP exhaustion, ENI quota, image pull path, execution role, and platform support. Connection timeout: route/SG/NACL/DNS. Data missing: inspect mount path, task replacement, object write/ack ordering, and bucket policy.

## Debugging procedure

Inspect task ENI, subnet, SG, target registration, VPC Flow Logs, DNS resolution, and app socket. For persistence, log object key/volume mount and verify from a second task after replacement.

## Production checklist
- Task ENI subnet has address headroom across deployments.
- Durable state externalizes before work acknowledgement.
- Egress and service endpoints are explicit.
- Storage failure and restore paths are tested.

## Practical exercise

Draw task-to-ECR, S3, and PostgreSQL network paths. For each, specify IAM principal, route, SG, data semantics, and retry behavior.

## Exercise checks
- Task IP and host IP are not conflated.
- Container writable layer is not treated as durable storage.
- ECR pull path, S3 path, and DB path are separately authorized.

## Quick reference
- Task lifecycle and storage lifecycle are different.
- `awsvpc` gives task ENI/SG boundary and consumes subnet IPs.

## Storage follows access semantics and lifecycle

Writable layer and task scratch are ephemeral; use for cache and reproducible intermediate files. Fargate Linux 1.4.0+ defaults to 20 GiB ephemeral storage, configurable to 200 GiB; image layers consume that budget, so usable scratch is lower. [Fargate storage](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-storage.html).

EBS provides block storage; ECS persistence differs between standalone tasks and service tasks, so verify support and lifecycle for the selected mode. EFS provides shared persistent files and requires mount-target reachability, security groups, and POSIX/access-point permissions. Fargate runs a supervisor container for EFS, using some task resources. S3 provides object semantics, not POSIX locking or atomic rename. Select by access pattern, latency, throughput, concurrency, recovery, and cost. [ECS storage options](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_data_volumes.html).

## Worked incident

An API returns success after writing uploads to `/tmp`; task replacement loses them. Persist the object externally before acknowledging success, store metadata, and keep local copies as scratch. Test replacement and restore.

## Hinglish explanation

Task scratch replace hone par ja sakta hai. EBS block, EFS shared files, S3 objects deta hai—semantics alag. Fargate scratch mein image layers bhi jagah leti hain. Durable data task ke bahar rakho aur failure drill chalao.

## Worked storage budget

Assume a Fargate task has 20 GiB ephemeral storage and image data occupies 5 GiB. The application cannot budget all 20 GiB for scratch; measure image footprint and leave room for logs, extraction, and safety margin. A batch that expands a 3 GiB archive to 18 GiB can exceed the remaining space. Stream to object storage or process bounded chunks when possible. Alarm on ephemeral use and test disk-full behavior; a full filesystem can break logs or health checks.

For EFS, estimate concurrent clients, metadata operations, throughput, mount latency, and access-point permissions. Shared storage simplifies file sharing but adds contention and a common dependency. For S3, use object keys and conditional writes; coordinate multi-step uploads through durable metadata and idempotency. For EBS, verify attachment and AZ behavior against recovery needs. Include restore time and backups; persistence without tested recovery is incomplete.

### Failure analysis for a durable upload

An upload can succeed in S3 while the metadata transaction fails, or metadata can commit while the client times out before the response. Give each upload a stable request ID and explicit states such as `PENDING`, `STORED`, and `AVAILABLE`. Make retries idempotent, verify object checksum and ownership before marking it available, and expire incomplete objects with a reconciliation job. Cleanup must not delete an object whose transaction is still in flight. This is a distributed transaction across storage and database; a happy-path sequence does not make both writes atomic.
