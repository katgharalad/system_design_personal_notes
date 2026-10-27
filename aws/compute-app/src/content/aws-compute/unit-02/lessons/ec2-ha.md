# Availability Zones and failure recovery

**Prerequisite:** Auto Scaling Groups. **Sources:** [Regions and Availability Zones](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html), [Well-Architected questions](https://docs.aws.amazon.com/wellarchitected/latest/framework/appendix.html).

## Learning objectives
- Distinguish instance recovery, AZ failover, and Region disaster recovery.
- Size capacity for a stated failure scenario.
- Connect RTO/RPO to app, storage, database, DNS, and operational steps.

## Problem

“Multi-AZ” can describe placement without enough surviving capacity. Redundant web nodes do not help if database writer, NAT path, queue consumer, or deployment control depends on one failed location. Availability is an end-to-end property.

## Definition and terminology

A Region contains multiple isolated Availability Zones. A subnet belongs to one AZ. **RTO** is the target time to restore service; **RPO** is the maximum acceptable data loss measured in time. A fault-domain design specifies the failure it tolerates and the capacity/data behavior after it.

## Internal operation

An ASG can span subnets in several AZs and rebalance placement. ALB nodes route to healthy targets across enabled AZs. EBS volumes are AZ-scoped; their snapshots and restored volumes have separate recovery steps. Database Multi-AZ behavior depends on the selected engine/deployment mode. EC2 control plane or app process recovery is not the same as data promotion. Cross-Region resources are not automatically replicated merely because both Regions exist.

## Execution lifecycle

Define failure → identify dependencies sharing the domain → maintain spare capacity/data copies → detect health change → stop routing to failed targets → shift or replace capacity → restore data path → validate user journey → measure RTO/RPO.

## Worked example 1 — N-1

Two AZs each carry 50% of 800 RPS, with instance capacity 500 RPS per AZ. If one AZ fails, surviving capacity 500 RPS < 800 RPS. “Two AZs” exists, but service only retains 62.5% capacity. To meet full load, each AZ needs at least `ceil(800/500)=2`? For 500 RPS per instance, one surviving AZ needs 2 instances (1,000 RPS); therefore deploy 2 per AZ, four total, then verify DB and network dependencies also sustain 800 RPS.

## Worked example 2 — RPO/RTO

If the business says RPO 5 minutes and RTO 30 minutes, hourly snapshots cannot satisfy the stated RPO by themselves. A tested transaction-log or replication path may be needed. Restore can still exceed RTO if DNS changes, credentials, network routes, and app capacity are manual. Run a timed failover drill and include detection and validation in the clock.

## Configuration lab

```bash
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names api-prod \
  --query 'AutoScalingGroups[].{Min:MinSize,Desired:DesiredCapacity,Max:MaxSize,AZs:AvailabilityZones[].ZoneName,Subnets:VPCZoneIdentifier}'
```

This reports placement config, not proof of resilience. Test simulated target loss, ASG activity, data failover, and user-facing SLO together.

## Alternatives and decision boundary

Multi-AZ is common for zonal resilience within one Region. Multi-Region active/passive or active/active design requires explicit data replication, conflict/consistency rules, routing, secrets, quotas, and recovery automation. Backups support recovery; replicas support availability but can replicate corruption.

## Tradeoffs

Spare capacity costs money but reduces failover delay. Replication reduces data-loss window but adds consistency and failure-coupling concerns. Multi-Region can improve geographic recovery and latency at significant operating complexity.

## Failure analysis

Check AZ-specific target count, subnet IP space, ASG max, service quota, EBS/database writer health, NAT and endpoint paths, queue consumers, and deployment automation. A control-plane action may be unavailable during an incident; practice expected operations.

## Debugging procedure

Draw dependency graph with AZ/Region labels. On drill, record detection, traffic shift, replacement, data promotion, and validation timestamps. Compare real RPO/RTO with target. Inspect AWS Health and service-specific events but do not equate status-page green with application health.

## Production checklist
- State exact tolerated failure and business RTO/RPO.
- N-1 compute and database capacity is load-tested.
- Backups are restored; failover is rehearsed.
- DNS, IAM, certificates, endpoints, and runbooks work in recovery location.

## Practical exercise

For 1,000 RPS and 200 RPS per instance, calculate per-AZ fleet for two-AZ N-1. Then introduce a single-AZ database writer and show why the app tier alone does not meet the objective.

## Exercise checks
- At least 5 serving instances must remain after one AZ fails.
- Data tier and service quotas are part of the fault domain.
- RTO/RPO have timed evidence, not architecture-diagram claims.

## Quick reference
- Redundancy must include capacity, data, route, identity, and operator path.
- Backup, replication, and failover solve different problems.

## Deepened mechanism: Prove surviving capacity and distinguish AZ from Region recovery

### Worked example 3 — N-1 with uneven AZ load

A fleet has 18 instances spread across three AZs, six each. Peak demand needs 12 instances. Losing one AZ leaves 12, so the count appears to fit exactly. But this assumes perfect balancing, no deployment surge, no spare capacity for health replacement, and no downstream failure. With a 20% headroom target, required surviving capacity is 14.4, so 12 is insufficient. Either provision more total capacity, reduce peak demand via admission/queueing, or accept a documented degradation mode. Test the actual ASG/AZ distribution and ALB behavior. Desired count alone does not prove N-1.

Availability Zones are separate failure domains within a Region, with independent infrastructure and high-bandwidth, low-latency connectivity. Multi-AZ deployment protects against some AZ failures, not regional failure, data corruption, bad releases or shared control-plane/dependency issues. Multi-Region adds data replication, routing and operational complexity. Define RTO (maximum restoration time) and RPO (acceptable data-loss interval) before selecting warm standby, pilot light or active-active. Replication lag and conflict semantics may dominate the design.

### Worked example 4 — RTO is not failover time alone

A service target is RTO 30 minutes and RPO 5 minutes. The database can fail over in 4 minutes, but DNS TTL is 10 minutes, clients cache endpoints for 20 minutes, and the application needs 8 minutes to warm. User recovery can exceed 20 minutes even if database recovery is fast. Measure each component and use end-to-end game days. For RPO, check actual replication lag and write acknowledgment semantics, not the configured interval alone.

### Production failure drill

Disable one AZ’s application capacity in a test environment. Confirm remaining targets can handle peak traffic, ASG launches replacements in surviving AZs, subnets have free addresses, NAT/endpoints and database paths work, and queues remain within age objectives. Measure p99, error rate and recovery time. Then test a regional dependency failure separately; do not assume the AZ drill covers it.

### Roman Hinglish explanation

HA diagram mein teen AZ banana kaafi nahi. Ek AZ hatao aur calculate karo ki bachi capacity peak traffic + safe headroom serve karegi ya nahi. 18 mein se 6 gaye to 12 bachte hain; requirement 12 hi ho to zero margin hai. Deployment, target health, subnet IPs, database aur NAT path bhi check karo. AZ redundancy same Region ke andar hai. Region failover ko RTO/RPO, data replication aur client routing chahiye. Failover ka timer sirf AWS component recovery nahi; DNS cache, app warm-up aur operator action bhi include karo. Game day se prove karo.

### Direct AWS references for these mechanisms

- [Regions and Availability Zones](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html) — AWS failure-domain terms.
- [Auto Scaling health checks](https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html) — replacement behavior under impaired capacity.
