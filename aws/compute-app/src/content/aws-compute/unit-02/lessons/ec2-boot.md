# AMIs, boot sequence, and user data

**Prerequisite:** EC2 architecture. **Sources:** [AMIs](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AMIs.html), [user data](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html), [launch templates](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/launch-templates.html).

## Learning objectives
- Explain the AMI-to-ready-host boot path.
- Make bootstrap repeatable, observable, and safe to rerun.
- Separate baked software from launch-time configuration and secrets.

## Problem

Hand-configured “golden” servers drift. A replacement may boot a different package version, fail because a public repository is unavailable, or expose credentials embedded in a script. Reliable fleet operations require immutable, versioned images and a bounded bootstrap path.

## Definition and terminology

An AMI identifies a bootable image plus block-device mappings and launch permissions. A launch template captures reusable parameters such as AMI, instance type, network interface, IAM profile, metadata options, and storage. User data supplies launch-time directives; Linux cloud-init commonly processes it, but exact behavior depends on AMI and configuration. User data is not a secret-management system.

## Mental model

Bake slow, stable dependencies into a reviewed AMI; inject small environment-specific settings at launch; fetch secrets at runtime through a scoped role. Treat bootstrap as a state transition with logs and a success marker. A process that exits zero does not prove the service is ready—readiness needs an application check.

## Internal operation

EC2 selects an AMI and creates attached devices, then starts the guest. Cloud-init stages may process user data on first boot; a failed package download can block readiness. `systemd` then starts configured services. In an Auto Scaling group, future instances use the launch template version resolved by the group, so “latest” must be managed deliberately. Instance refresh lets a fleet move through versions while maintaining configured health and availability limits.

## Execution lifecycle

Build image → scan and test → publish AMI ID/version → update launch template → run a canary → verify boot logs and app readiness → instance refresh in batches → watch target health and SLO → rollback to prior version if needed.

## Worked example 1

Suppose AMI boot p95 is 35 s, bootstrap p95 50 s, app start 20 s, and load-balancer checks add up to 15 s. Set ASG health grace based on observed time plus margin, not simply “instance is running.” If bootstrap has a 5-minute package-manager retry loop, fix artifact availability or bake package into AMI rather than hiding the latency with a huge grace period.

## Worked example 2

For an AMI migration, keep version N available while canarying N+1. At 10 instances and `MinHealthyPercentage=90`, rollout capacity depends on desired count and refresh policy; verify actual replacement behavior in a nonproduction group. A failed canary should stop rollout before all instances acquire the bad image.

## Configuration lab

```bash
aws ec2 create-launch-template-version \
  --launch-template-id lt-0123456789abcdef0 \
  --source-version 4 \
  --launch-template-data '{"ImageId":"ami-0123456789abcdef0","MetadataOptions":{"HttpTokens":"required"}}'
```

Review the diff before setting a new default. Keep credentials out of the user-data field. Send bootstrap output to a searchable log path; ensure launch roles can access only required artifacts and secrets.

## Alternatives and decision boundary

Bake an AMI for deterministic startup and reduced external dependency. Use user data for small per-environment settings. Configuration management or an image pipeline can enforce fleet consistency. Container images move application dependencies into an artifact but EC2 host boot and agent setup still need management.

## Tradeoffs

Baking improves speed and reproducibility but increases image pipeline work and update cadence. Bootstrap offers flexibility but can extend launch time and fail on network dependencies. Immutable rollout is safer than editing long-lived instances in place.

## Failure analysis

Check cloud-init output, package repository DNS/egress, IAM artifact read, filesystem space, systemd exit state, and launch-template version. A host may pass EC2 checks while user data or the app failed.

## Debugging procedure

Compare failed host AMI/template version with healthy hosts. Read `/var/log/cloud-init-output.log`, cloud-init status, system journal, and application logs via SSM. Re-run bootstrap only if it is designed to be idempotent. Preserve failed instance evidence before replacing it.

## Production checklist
- AMI includes version, build provenance, scan, and rollback metadata.
- Bootstrap is idempotent, time-bounded, and logged.
- IMDSv2 is required; secrets are fetched at runtime with least privilege.
- Launch-template updates use canaries and controlled instance refresh.

## Practical exercise

Design an image pipeline for a Node API. Identify packages baked into AMI, per-environment settings, secrets, readiness check, and rollback. Break the package repository and state how a new fleet still launches.

## Exercise checks
- New instance can start without reaching an untrusted package mirror.
- Secret does not appear in AMI, user data, or logs.
- Rollback identifies exact known-good AMI and launch-template version.

## Quick reference
- AMI = image; launch template = launch recipe; user data = bootstrap input.
- Launch success, OS readiness, and app health are separate conditions.

## Deepened mechanism: Make boot repeatable, observable, and safe to replace

### Worked example 3 — user data is not a readiness check

A launch template runs a shell script that downloads a package and starts a service. The instance reaches `running` before cloud-init finishes. If the Auto Scaling Group registers it immediately, the ALB may send traffic while the process is absent. Add an application readiness check and configure health-check grace/warmup based on measured boot, package install and data load. Prefer baking stable dependencies into an immutable AMI; user data should perform small environment-specific configuration. Make scripts idempotent because they can be retried or run during recovery, and send logs to a durable destination.

Never place long-lived secrets in user data. User data can be retrieved through instance metadata or control-plane paths by principals with sufficient access, and scripts may be exposed in logs or images. Use an instance profile with narrow permission to retrieve a secret at runtime, and use IMDSv2 with hop-limit and process isolation appropriate to the architecture. Pin AMI and launch-template versions so a replacement fleet is reproducible; an unpinned “latest” image makes rollback ambiguous.

### Worked example 4 — rolling out a base image

Build AMI version 2026.10.27 from a controlled pipeline. Run vulnerability and boot checks, then launch a canary from launch-template version 12. Verify SSM registration, application readiness, target health, log delivery and expected IAM identity. Replace a small portion of the fleet, observe p95 and error rate through a bake interval, then continue. Keep version 11 available. If version 12 fails, roll the launch template back and let the ASG replace bad capacity. Do not manually patch half the instances and leave the fleet heterogeneous without recording it.

### Incident trace

When instances fail only during ASG scale-out, compare user-data exit code and cloud-init logs across failed and healthy instances. Check package repository reachability, DNS, artifact permissions, instance profile, disk space, architecture-specific package names and rate limits. If boot succeeds but targets are unhealthy, inspect health-check path, security-group source and application bind address. Capture the exact AMI and template version in every launch log.

### Roman Hinglish explanation

Boot sequence aur app readiness same moment nahi hote. EC2 `running` bol sakta hai jab cloud-init abhi package download kar raha ho. ASG ya ALB ko jaldi ready signal diya to user ko 502 milega. Stable software AMI mein bake karo; user data ko chhota, repeatable aur secret-free rakho. Instance profile se runtime par sirf required secret read karo. Launch template version pin karo taki replacement instance wahi known configuration se aaye. Deploy mein pehle canary, phir health aur SLO verify, phir fleet rollout. `latest` AMI par bharosa rollback ko mushkil banata hai.

### Direct AWS references for these mechanisms

- [Run commands on your Linux instance at launch](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html) — user-data execution behavior.
- [Use IMDSv2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) — instance metadata access controls.
- [Launch templates](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/launch-templates.html) — versioned launch configuration.
