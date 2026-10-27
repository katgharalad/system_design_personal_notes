# SSH, Linux operations, deployment, and security

**Prerequisite:** AMIs and boot. **Sources:** [Systems Manager Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html), [Well-Architected review](https://docs.aws.amazon.com/wellarchitected/latest/framework/appendix.html).

## Learning objectives
- Prefer auditable access with least privilege and short-lived credentials.
- Diagnose Linux process, memory, disk, and service issues.
- Deploy immutable artifacts with health-gated rollback.

## Problem

Long-lived SSH keys, hand edits, and mutable hosts make incidents hard to reproduce. An engineer needs access without a permanent public port; deploys need a known version; compromised credentials need a revocation path.

## Definition and terminology

SSH is encrypted remote shell over a network path. Systems Manager Session Manager can provide interactive access through managed-node prerequisites and IAM authorization without opening inbound SSH. An instance profile supplies temporary role credentials to software on the instance. `systemd` manages Linux services; journald captures service logs. Deployment should refer to immutable artifact/image version, not “latest files on host.”

## Internal operation

Linux boot starts kernel, mounts filesystems, and launches system services. `systemd` unit dependencies and restart policy affect app availability. The SSM agent must run and reach required service endpoints; the instance role needs least-privilege permissions. Session authorization and OS user permissions are separate controls. During deploy, readiness checks should prevent a process from receiving traffic until it can serve correctly.

## Execution lifecycle

Engineer authenticates → IAM evaluates session permission → SSM establishes channel → OS session policy applies → operator runs read-only diagnostics → controlled change or deployment runs → evidence is logged → session ends and credentials expire.

## Worked example 1

CPU is 100%, but load average is 1 on an 8-vCPU host; memory is available and disk wait is 70%. The host may be I/O-bound, not CPU-bound. `top` alone is insufficient: inspect `iostat`, process I/O, EBS queue depth/latency, and app request timing before resizing.

## Worked example 2

For a rolling fleet of 12 instances, replace 2 canary hosts with AMI v8. Compare error rate, target health, startup duration, and p95 before expanding. If p95 rises from 180 to 600 ms, halt rollout and return the ASG to known-good launch-template version. A successful process start is not rollback acceptance; use customer-facing SLOs.

## Configuration lab

```bash
sudo systemctl status api.service
sudo journalctl -u api.service --since '15 minutes ago' --no-pager
free -h
df -h
ss -lntp
```

Commands are illustrative for Linux. Avoid sharing command output containing credentials or customer data. Use SSM run-command/Session Manager roles only for approved operators.

## Alternatives and decision boundary

SSM is often safer than public SSH if agent, role, and egress prerequisites are satisfied. Break-glass SSH may remain in some environments but needs key rotation, narrow sources, audit, and tested emergency access. Containers can standardize app packaging; EC2 still needs host patching and agent upkeep.

## Tradeoffs

Centralized access improves audit and removes inbound port exposure, but requires service connectivity and IAM discipline. Immutable deployment lowers drift but requires build pipeline, artifact retention, health signals, and rollback capacity.

## Failure analysis

Session fails: check managed-node status, IAM authorization, agent, DNS/egress, and endpoint policy. Service fails: inspect exit code, environment, unit config, disk/memory pressure, and dependency access. Deploy causes errors: compare artifact, config, schema compatibility, and traffic shift.

## Debugging procedure

Start read-only. Record instance ID, AMI, template version, deploy ID, time window, and symptom. Check `systemctl`, journal, process memory, file descriptors, filesystem, socket, and dependency health. Change one thing; capture before/after metrics. Use SSM Run Command for fleet evidence collection where approved.

## Production checklist
- Prefer SSM; require IMDSv2 and scoped instance roles.
- Patch base AMIs and runtime packages on a defined cadence.
- Do not store secrets in shell history, user data, or baked images.
- Use canaries, health-gated rollout, rollback criteria, and audit trail.

## Practical exercise

An instance is reachable through SSM but returns 502 behind ALB. Collect evidence without changing config, identify the failing hop, then write a rollback plan.

## Exercise checks
- Access issue and application issue are diagnosed separately.
- Readiness, target health, and process status are all observed.
- Rollback is tied to a version and measurable threshold.

## Quick reference
- Temporary role credentials; no embedded access keys.
- Service logs + OS metrics + target health form one incident timeline.
- Immutable deployment makes rollback reproducible.

## Deepened mechanism: Safe host access, patching, and immutable deployment

### Worked example 3 — replace versus patch in place

A critical fleet has 60 Linux instances and a kernel security update. Patching each live host in place may create version drift and requires draining, reboot and health validation. A safer immutable path builds a new AMI with the patch, runs boot and application tests, then updates the launch template and replaces instances gradually. Keep enough healthy capacity during replacement and confirm the ASG’s maximum size allows deployment surge. For an emergency vulnerability, use Systems Manager Patch Manager or Run Command only with a defined target set, maintenance window, compliance evidence and rollback/recovery plan. Immutable images and managed patching can coexist: the former is the normal release path; the latter may mitigate urgent exposure.

Session Manager gives interactive access through Systems Manager without opening inbound SSH when the instance role, agent, network path and operator IAM are configured. It can log sessions to CloudWatch Logs or S3. It does not remove the need for least privilege: restrict which instances and commands operators can reach, protect the logging destination, and audit session start/stop. Avoid shared SSH keys in user data. Use just-in-time access and separate break-glass procedures.

### Worked example 4 — failed deploy with healthy host

A new application release returns 500 while EC2 and instance status checks pass. Compare process exit, systemd journal, deployment artifact digest, environment file permissions, health endpoint and target response. Roll back the application artifact or launch-template version while preserving logs. A healthy VM only proves host/guest reachability checks passed; it does not prove application behavior.

### Operational baseline

Define image owner, patch SLA, reboot policy, SSM inventory, host metrics, log retention, access path, configuration drift detection and recovery test. Build from a minimal supported image, keep package versions explicit, and avoid long-lived credentials on disk. Test restoring a host from the image and external durable data rather than treating the running instance as the backup.

### Roman Hinglish explanation

Production host par SSH key kholna default operations model nahi hona chahiye. Systems Manager Session Manager se inbound port band rakh sakte ho, par instance role, agent, egress, operator IAM aur session logging sahi hone chahiye. Patch ke baad 60 hosts alag-alag state mein na chhod do. Tested AMI banao, launch template version update karo, thoda capacity replace karo, health aur error rate dekho, phir rollout badhao. Host healthy par app broken ho sakti hai; EC2 status check aur application check alag signal hain. Access path aur rollback runbook pehle likho.

### Direct AWS references for these mechanisms

- [Systems Manager Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html) — managed interactive access and session logging.
- [Patch Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/patch-manager.html) — patch compliance and maintenance operations.
