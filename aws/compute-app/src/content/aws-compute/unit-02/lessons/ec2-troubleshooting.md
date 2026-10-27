# EC2 production troubleshooting and performance

**Prerequisite:** EC2 operations and networking. **Sources:** [EC2 troubleshooting](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/TroubleshootingInstances.html), [EC2 CloudWatch metrics](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-cloudwatch.html), [ALB health](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html).

## Learning objectives
- Separate launch, system-check, instance-check, target-health, and app failures.
- Diagnose CPU, memory, EBS, network, and dependency saturation using correlated evidence.
- Mitigate safely while preserving the incident timeline.

## Problem

“Restart the instance” can restore service but destroy evidence and conceal a recurring root cause. EC2 troubleshooting needs layered hypotheses and a reversible mitigation.

## Definition and terminology

CloudWatch EC2 metrics provide periodic host/instance observations; detailed OS metrics require an agent or application instrumentation. Status checks distinguish underlying system reachability from instance/guest reachability. ALB target health adds a configured application probe. CPU utilization, network throughput, EBS ops/bytes, and status check metrics have different collection semantics and dimensions.

## Internal operation

CPU saturation can arise from app loops, noisy workload, or insufficient compute. Memory pressure can trigger OOM kills while CPU appears moderate. EBS latency can cause blocked threads; network drops or connection exhaustion can inflate request latency; file descriptor exhaustion can stop accepts. Host metrics are sampled averages, so brief spikes and per-process behavior need higher-resolution app/OS telemetry.

## Execution lifecycle

Alert → identify affected fleet and deploy → inspect user symptom and error budget → compare host/target/app/dependency evidence → mitigate one layer → confirm SLO recovery → preserve diagnostics → fix cause → replay failure test.

## Worked example 1

ALB 5xx rises after a deployment; CPU stays 25%; target health is healthy; app logs show 300 ms DB pool wait before timeout. Resizing EC2 is unlikely to fix a connection-pool or DB capacity limit. Compare connection-pool occupancy, DB connections/locks, transaction duration, and request traces; rollback or reduce admission if release caused a leak.

## Worked example 2

Status check fails on one instance but peers are healthy. Capture serial console/system log and instance metrics, inspect recent kernel/package change, and determine whether recovery can happen through reboot or requires replacement. If ASG replaces it, validate the new instance runs the same launch-template version and that state is externalized.

## Configuration lab

```bash
uptime
vmstat 1 5
iostat -xz 1 5
free -h
df -h
ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head
```

Run under approved access. These Linux samples are diagnostic clues; interpret them with application and CloudWatch metrics. Do not collect customer payload or secrets into an incident paste.

## Alternatives and decision boundary

Use host replacement for isolated guest failure and immutable fleet problems. Use rollback for a correlated release regression. Use capacity scaling only when measured resource saturation and dependency budget support it. Route around an AZ only when remaining paths and data are healthy.

## Tradeoffs

Fast mitigation protects customers; collecting too much evidence delays recovery. Establish a minimal safe capture set and rehearse it. Scaling up can mask leaks and increase database pressure. Restart can clear stuck resources but erase process state.

## Failure analysis

Compare request rate, latency percentiles, error class, CPU, memory, disk, network, file descriptors, target health, DB connections, and deployment events. Watch whether degradation is isolated to one AZ/type/AMI or fleet-wide.

## Debugging procedure

1. Set incident start and affected SLO.
2. Check recent changes and blast radius.
3. Compare healthy vs unhealthy instance and AZ.
4. Follow request trace through ALB, process, and dependency.
5. Apply the smallest reversible mitigation.
6. Confirm recovery with user-facing metric, then root-cause.

## Production checklist
- Alarms include runbook links and useful dimensions.
- OS and app metrics share consistent timestamps and deployment IDs.
- SSM or console access tested before incident.
- Replacement and rollback preserve state and diagnostic evidence.

## Practical exercise

Inject 2× CPU work into a test API, then inject slow EBS reads, then DB connection exhaustion. For each, record the first metric that distinguishes it and the safest mitigation.

## Exercise checks
- CPU, storage, network, and database hypotheses use different evidence.
- A host restart is not the only proposed fix.
- Recovery is confirmed using customer-facing latency/error signals.

## Quick reference
- Check placement and change history before tuning.
- Correlate one request path across host, target, and dependency metrics.
- Mitigate first when needed; preserve enough evidence for prevention.

## Deepened mechanism: Evidence-led diagnosis across host, storage, network, and application

### Worked example 3 — rising latency with healthy status checks

API p99 increases from 300 ms to 2.5 seconds; EC2 system and instance checks remain healthy. ALB target response time rises, CPU stays at 35%, and EBS read latency jumps. This points away from host reachability and toward storage or application I/O wait. Inspect `iostat`, filesystem queue, volume throughput/IOPS limits, database query plan and deployment timeline. If the process is blocked on disk, adding instances may move load to the same storage backend or duplicate work. Mitigate by reducing expensive reads or shifting traffic; change volume performance only after confirming the measured limit.

### Worked example 4 — instances launch, then ASG replaces them repeatedly

Check ASG activity history and target-health reason codes first. If instances pass EC2 checks but fail ALB health, inspect application logs, health path, listener port, security-group source, startup duration and user-data status. If they fail instance checks, inspect console output, boot volume, kernel, network config and reachability. If launch fails before running, inspect capacity, quota, subnet address, IAM `PassRole`, launch-template AMI and EBS settings. Each layer has distinct evidence; broadening permissions or opening ports before identifying the failing layer makes the system less safe and obscures root cause.

### Diagnostic sequence

1. Establish customer symptom and exact time window; compare deployment and traffic changes.
2. Check ALB 4xx/5xx, target response time, healthy host count and reason codes.
3. Check ASG desired/pending/in-service counts and scaling activities.
4. Check EC2 system/instance status, console output and CloudWatch metrics.
5. On the guest, inspect CPU, memory, disk, network, process state and system logs.
6. Trace downstream latency, connection pools, retries and database saturation.
7. Mitigate with a reversible action, then verify customer SLO and preserve evidence.

Use CloudWatch agent for guest memory/filesystem/process metrics; default EC2 metrics do not equal full OS observability. Systems Manager Run Command can collect diagnostics fleet-wide, but target filters and output access must be constrained. Avoid high-cardinality logs with secrets or raw customer payloads.

### Roman Hinglish explanation

Debugging ka kaam layer-wise hypothesis test karna hai. ALB ko target healthy dikh raha hai, phir bhi p99 high ho sakta hai because app disk ya database ka wait kar rahi ho. EC2 status check host/guest reachability ka signal hai, business request ka nahi. Pehle exact time aur deployment/traffic correlation banao. Phir ALB, ASG, EC2 status, guest OS, aur downstream metrics ko same timeline par dekho. CPU low hone se bottleneck absent prove nahi hota; disk I/O, memory reclaim, lock wait, pool saturation aur network limits CPU ke bina bhi latency badha sakte hain. Safe mitigation evidence ke baad chuno.

### Direct AWS references for these mechanisms

- [Troubleshoot EC2 status checks](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/TroubleshootingInstances.html) — host and guest diagnostic evidence.
- [ALB troubleshooting](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html) — target failure reasons and HTTP symptoms.
- [CloudWatch EC2 metrics](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/viewing_metrics_with_cloudwatch.html) — instance-level monitoring dimensions.
