# Containers, VMs, and isolation

**Prerequisite:** EC2 architecture. **Sources:** [AWS container decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-container-service.html), [Fargate task isolation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html).

## Learning objectives
- Separate image, container process, host kernel, and orchestration object.
- Explain standard Linux namespace/cgroup isolation without calling a container a VM.
- State Fargate task isolation accurately and still apply defense in depth.

## Problem

Teams package apps in containers and then assume they have a complete security boundary. A container image is an artifact; runtime isolation depends on the host kernel, container engine, privileges, namespaces, cgroups, capabilities, mounted files, network, and service boundary.

## Definition and terminology

A container image is a layered, mostly immutable filesystem plus config metadata. A container is a process tree started from an image with runtime settings. Conventional Linux containers share the host kernel and isolate process/resource views with mechanisms such as namespaces and cgroups. A VM boots a guest kernel behind a hypervisor. AWS Fargate tasks have an AWS-managed isolation boundary documented separately from ordinary shared-host assumptions; do not claim that every container always shares the same kernel or that Fargate makes app security automatic.

## Internal operation

Image layers are composed into a root filesystem; runtime config sets command, environment, mounts, UID, capabilities, resource limits, and network. Kernel enforces process and resource boundaries. Orchestrator health and replacement operate on task/container state, not on your business transaction semantics. Fargate hides host administration; the customer still controls image contents, task role, secrets, network reachability, and app code.

## Execution lifecycle

Build image → resolve layers → create runtime sandbox → attach network and storage → start entrypoint → health check → receive work → stop signal → graceful drain → forced termination after grace.

## Worked example 1

A process running as root in a container may have fewer host capabilities than host root, but privileged mode or mounted Docker socket can erase much of that boundary. Use non-root UID, drop Linux capabilities, read-only root filesystem where feasible, narrowly scoped mounts, and no host socket. Test actual required syscalls before applying a blanket policy.

## Worked example 2

An ECS Fargate task with a compromised web process still has its task role credentials and permitted egress. Separate app permissions from execution role, restrict task SG egress, and scope secrets to one service. Host isolation does not limit what authorized app credentials can do.

## Configuration lab

```dockerfile
FROM node:22-alpine
WORKDIR /srv/app
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node dist ./dist
USER node
CMD ["node", "dist/server.js"]
```

Pin a reviewed base image by digest for reproducibility; update it through a regular rebuild and scan process. Do not put secrets in build args or image layers.

## Alternatives and decision boundary

VMs provide a guest-kernel boundary and host control. Containers provide efficient packaging and process deployment. Managed container services shift some host/control-plane work. Fargate tasks have task isolation; ECS on EC2 gives host control and places more security and patch duty on the team.

## Tradeoffs

Containers improve artifact consistency and density, but kernel vulnerabilities and privileged config need attention. Stronger isolation can cost startup time or constrain host access. Managed execution removes host toil, not IAM, data, or application responsibility.

## Failure analysis

Image exits immediately: inspect entrypoint, permissions, architecture, env, and logs. OOM kill: compare task memory limit and actual working set. Permission error: check UID and mounted file ownership. Unexpected reachability: inspect task role, SG, and route, not only container network namespace.

## Debugging procedure

Record immutable image digest and task revision. Check stopped reason, container exit code, logs, health result, CPU/memory, mounts, and IAM. Reproduce locally with the same architecture and read-only/UID settings. Avoid opening a shell into a production task unless approved; use logs and a safe reproduction first.

## Production checklist
- Run as non-root; minimize capabilities and mounts.
- Scan dependencies and image; deploy immutable digest.
- Separate task execution role and application task role.
- Bound CPU, memory, egress, and shutdown time.

## Practical exercise

Threat-model a file-conversion task that receives untrusted PDFs. List isolation layers, filesystem policy, outbound destinations, credentials, timeout, and cleanup. Compare ECS on EC2 and Fargate responsibilities.

## Exercise checks
- Image and running process are distinguished.
- Fargate task isolation is not generalized to all container runtimes.
- Compromised app permissions remain bounded.

## Quick reference
- Container = process + configured isolation; image = packaged artifact.
- Conventional containers share host kernel; VM has guest kernel.
- Fargate changes infrastructure ownership and task isolation boundary.

## The boundary depends on runtime

Conventional Linux containers share the host kernel. Namespaces scope process, mount, and network views; cgroups account for and limit resources. They are not automatically VMs. Privileged mode, host mounts, broad capabilities, or kernel vulnerabilities can cross intended boundaries. On ECS EC2, the customer owns host patching, agent configuration, and hardening. On Fargate, AWS manages hosts and documents task-level isolation, but application IAM, network, dependencies, secrets, and configuration remain customer responsibilities.

Separate ECS execution role (agent actions such as image pull/logging) from task role (application AWS calls). In EKS, use Pod Identity or IRSA instead of static keys and restrict node metadata access. AWS states containers are not a security boundary; node credentials may be exposed if IMDS is not restricted. [EKS Pod Identity considerations](https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html).

## Threat-model drill

Two customers share an EC2 cluster; one parses untrusted archives. Examine host/kernel sharing, writable mounts, task permissions, egress, secret exposure, and instance blast radius. Decide whether hardening suffices or dedicated capacity/stronger isolation is needed.

## Hinglish explanation

Container aam taur par host kernel share karta hai. Namespace aur cgroup useful controls hain, VM boundary nahi. ECS EC2 mein host patching tumhari; Fargate host manage karta hai, app role nahi. Untrusted tenants ka boundary threat model se chuno.

## Least privilege by layer

Review the host, task definition, process, and network as separate boundaries. For ECS EC2, the instance profile belongs to the ECS host and should authorize agent/host operations; avoid granting application business permissions to every task through that role. The task execution role supports agent actions such as pulling private images and writing configured logs. The task role is exposed to application containers and should contain only APIs the application needs. Mount only required filesystems, prefer read-only mounts, and bound egress to named dependencies. A process that can read a broad shared volume or reach metadata may bypass the intended per-task IAM policy.

Container isolation also includes resource fairness. CPU shares or limits and memory reservation/limits affect what happens under contention. A memory limit that is too low can terminate a legitimate workload; no limit can let one task exhaust a shared host. Set limits from measured peak behavior, alert on throttling and memory pressure, and test noisy-neighbor cases. Restrict Linux capabilities and avoid host PID/network namespaces unless a documented need exists. Patch base images and host kernels on separate schedules because one does not update the other.

## Exercise: permission-path audit

For a task that reads one S3 prefix and writes to one queue, list each credential source, IAM role, resource ARN, network path, and log. Confirm the execution role cannot perform the application’s S3 or queue actions, and the task role cannot modify cluster infrastructure. Attempt an API call outside the intended resource scope and verify it fails. Then document emergency access as a separate audited procedure rather than adding permanent wildcard permissions.
