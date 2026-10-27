# Container or VM

**Prerequisite:** Runtime models. **Sources:** [EC2 compute guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html), [Nitro](https://docs.aws.amazon.com/ec2/latest/instancetypes/ec2-nitro-instances.html), [Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html).

## Learning objectives
- Compare guest OS and shared-kernel models.
- Choose from compatibility, startup, isolation, density, and operations.
- Explain containers may run inside VMs and are not mutually exclusive.

## Problem

“Container vs VM” is often a false binary. A container workload can run on EC2 VMs; ECS/Fargate abstracts hosts. Choose packaging separately from capacity and trust boundary.

## Definition and internal operation

VM virtualizes hardware and boots guest OS. Conventional Linux container isolates processes while sharing host kernel. Container image packages app filesystem and command. AWS Fargate task isolation is its own documented boundary. EC2 can host multiple containers, each with resource controls; a VM may also run one or more processes directly.

## Worked example

A legacy app needs kernel module and systemd-managed agent: VM is likely required. A stateless HTTP service with reproducible dependencies benefits from container packaging; it may still run on EC2 or Fargate. Untrusted tenant code may require stronger isolation than ordinary containers; evaluate dedicated VM/MicroVM options and current AWS service models.

## Decision exercise

Map required OS control, kernel, image portability, startup time, per-tenant isolation, density, patch ownership, and state. Mark which are hard requirements and which are preferences.

## Tradeoffs and failure

VM offers guest-kernel control and established ops but has OS patch/boot overhead. Containers improve packaging/density but inherit host-kernel concerns and orchestration. Fargate moves host operation to AWS but limits host access. Failures include kernel mismatch, image ABI mismatch, privileged container, OOM, and host contention.

## Debugging procedure

Check process image architecture, kernel/ABI needs, runtime permissions, resource limits, and host or task events. Compare deployment artifact with target runtime.

## Practical exercise

Select runtime for (1) database appliance needing custom kernel, (2) stateless API, (3) untrusted code sandbox. State isolation boundary and named operator for each.

## Exercise checks
- Container packaging is separated from execution capacity.
- Shared-kernel and VM isolation claims are precise.
- Security boundary follows threat model.

## Quick reference
- VM, container image, and orchestrator describe different layers.
- Containers can run on VMs; Fargate changes host management.
