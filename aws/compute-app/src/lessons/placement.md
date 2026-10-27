## Learning objectives

Region, AZ, VPC, subnet, ALB target, aur data placement ka relationship accurately explain karo. One-AZ aur Region-wide failure alag model karo. N-1 capacity aur RTO/RPO assumptions calculate karo. Network placement failure diagnose karo.

## Problem: diagram mein two AZ likhna enough nahi

Ek architecture diagram mein “multi-AZ” badge hai. ALB public subnets AZ A/B mein. All ECS tasks private subnet A mein; PostgreSQL single AZ A. AZ A failure par ALB survive kar sakta hai, par healthy app target aur database dono lost. **Availability Zone fault isolation Region ke andar** hota hai; Region-wide failure ke liye separate multi-Region recovery design chahiye. [EC2 Regions and Zones](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html) Region ko separate geographic area, AZ ko Region ke within isolated location kehti hai. AWS resources automatically Regions mein replicate nahi hote.

VPC regional scope ka network hai. Ek subnet exactly one AZ mein rehta hai; resource subnet choose karke physical failure domain select karta hai. [VPC subnet guide](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html) subnet types route table se define karti hai: public subnet mein internet gateway route, private mein direct IGW route nahi. “Private” label resource automatically secure nahi banata; security groups, IAM, routing, endpoints/egress, TLS, and access policy check karo.

A Region choose karte waqt user proximity, data residency/legal requirements, service availability, quota, operational support, cost, and disaster-recovery needs record karo. AZ code jaise `us-east-1a` account mappings ke context mein samjho; cross-account exact location compare karna ho toh AZ ID relevant ho sakta hai. Design mein failure *scope* name karo: process, task, instance, AZ, Region, data corruption, operator error. Multi-AZ helps AZ failure; accidental delete, bad deployment, and Region outage ke liye independent controls chahiye.

## Internal operation: placement to serving traffic

1. VPC CIDR and two or more AZ subnet CIDRs choose. Subnets overlap nahi karte. Public ALB subnets and private app/data subnets decide karo.
2. Route tables: app ko DB tak private route; images/logs/secrets access ke liye NAT or VPC endpoints if required. Security groups allow ALB→app port, app→DB port, and restrict direct public access.
3. Compute service ko both private app subnet IDs do. Running task/instance ke actual AZ labels inspect karo. “Two subnets configured” does not prove scheduler actually runs healthy replicas in both.
4. ALB listeners/target groups app target register karte hain; health checks pass hone par requests route hoti hain. Target-group all-unhealthy fail-open behavior ko incident playbook mein note karo; do not claim health check is absolute traffic firewall.
5. Database Multi-AZ deployment/failover option independently configure and test karo. App tier redundancy cannot imply DB tier redundancy. Backups data corruption/ransomware protection ke liye separate hain; replica/failover backup ka replacement nahi.
6. AZ failure par remaining healthy targets serve karte hain *if* capacity, network egress, and data path survive. New tasks launch hone mein time lagta hai; RTO target versus warm-up measure karo.

## Worked example 1: two-AZ API under zone failure

Assume 800 RPS peak, mean handler 0.25 s, each ECS task safely handles 25 concurrent while meeting p95. Active estimate `800×0.25=200`; baseline 8 tasks. Place 4+4 gives normal capacity 8. A failure leaves 4, allowing ~400 RPS under same assumptions. If product promises no material degradation under one-AZ failure, survivor needs 8 safe tasks **at failure time** or scale within accepted RTO. Running 8+8 continuously costs more, but avoids scale delay; running 4+4 with capacity to launch 4 additional tasks in survivor may be acceptable if RTO/SLO permits. Need subnet IPs, service quotas, startup duration, target health time, and DB capacity for 800 RPS. “ALB in two AZs” solves only entry layer.

Data: suppose DB single writer in AZ A. App B might have all 8 tasks yet cannot complete writes after A fails. Configure appropriate RDS Multi-AZ strategy, understand failover time/connection behavior, and test. RTO is maximum acceptable service restoration time; RPO is maximum acceptable data loss measured back from failure. Both are business requirements, not properties inferred from “Multi-AZ”. If RTO 30 seconds and actual failover 90 seconds, architecture misses requirement even if eventual recovery succeeds.

```text
Region X
  AZ A: ALB node — app tasks A — DB primary/data path
  AZ B: ALB node — app tasks B — DB standby/failover path
  Shared design questions: Can B handle full peak? Can DB fail over? Does routing recover within RTO?
```

## Worked example 2: Region outage and data residency

Assume payments API operates in Region X, business RTO 4 hours, RPO 15 minutes for catastrophic Region failure. Multi-AZ in X protects one AZ, not full Region. Candidate multi-Region pattern: provision deployable app in Region Y; replicate data with verified delay/consistency properties; independent credentials, KMS keys, secrets, DNS/traffic control, monitoring and runbooks. Warm standby may reduce cost but increase recovery time; active-active lowers failover latency but complex writes/consistency. Data residency may prohibit cross-border replication; choose allowed Region and explicitly accept/reduce risk instead of silently replicating. To meet RPO, measure replication lag during burst/failure; to meet RTO, rehearse promotion, routing, cache warm-up, client reconnection, and dependency readiness. Region architecture is a separate design, not checkbox.

Alternative one-Region multi-AZ remains sensible when business accepts Region-disaster recovery via backups and longer RTO. More Regions are not automatically better: cross-Region write conflicts, deployment drift, data transfer cost, and operator burden can increase incident risk.

## Practical lab: free topology audit

Use architecture canvas or paper. Draw:

```text
VPC 10.0.0.0/16
AZ A public 10.0.0.0/24; app 10.0.10.0/24; data 10.0.20.0/24
AZ B public 10.0.1.0/24; app 10.0.11.0/24; data 10.0.21.0/24
ALB → app task A and B → DB failover path
```

CIDRs illustrative, not deployment recommendation. Mark each route/security-group edge, health endpoint, secrets/image/logs egress, and capacity after removing AZ A. Remove AZ B next. If either deletion leaves zero healthy app or DB path, document failure. Add one RTO and RPO statement and name test evidence required. This lab is local and free; actual ALB, NAT, compute, and DB deployment can be billable.

Read-only AWS commands for an existing account, if available:

```bash
aws ec2 describe-subnets --filters Name=vpc-id,Values=vpc-EXAMPLE
aws elbv2 describe-target-health --target-group-arn TARGET_GROUP_ARN
```

First output should show `AvailabilityZone` and subnet CIDRs; second shows target state/reason. Placeholder IDs must be replaced with existing resources. These commands do not provision resources; permissions and configured Region required. Cross-check app task placement in ECS/EC2 console or API.

## Failure analysis: two-AZ ALB, one-AZ app

Incident: 02:14 AZ A impaired. ALB DNS remains reachable. Requests return 503 or fail; ECS desired count 6, running count drops to zero. Service network config included only private subnet A. DB also in A. Diagnose in order: AWS Health and AZ event; ECS events and task placement; ALB target health and reasons; service subnet list; DB health/failover; network route/security groups. Root cause is not ALB availability—it has no usable app/data path. Add subnet B and desired placement policy, ensure B can host full required load, configure data failover, then test failover and latency. Be careful: after changing subnets, tasks may still cluster in one AZ depending on capacity and scheduling; verify actual placement. Backups do not immediately restore API.

Second failure class: tasks in both AZs, but each app subnet egress routes through NAT in A. Loss of A blocks B's secret/image/logs fetch or outbound API. Check route tables, NAT gateway placement and architecture, VPC endpoints, and connectivity during drill. Multi-AZ compute without multi-AZ dependency paths is incomplete.

## Alternatives and interview reasoning

Single AZ can be explicit dev/test tradeoff when downtime acceptable. Multi-AZ is usual building block for regional high availability and fault isolation within Region. Multi-Region is for specified Region failure, geography/latency, or policy targets—requires explicit data and traffic design. Edge/Local Zones address different latency placement; not substitutes for Region DR by default. [AWS Well-Architected review](https://docs.aws.amazon.com/wellarchitected/latest/framework/appendix.html) pushes workload-level failure questions rather than counting AZ labels.

Interview sequence: define failure scope → map every tier to AZ/Region → calculate surviving capacity → state data replication/failover semantics → estimate/test RTO/RPO → inspect dependent routes → discuss cost and operational complexity. If interviewer says “one AZ down,” remove all resources and routes in that AZ on paper. If “Region down,” assume no automatic cross-Region copy. If “bad deploy,” AZ redundancy does not help; need rollback/version isolation.

## Testing placement, not trusting configuration

One-AZ failure drill safely approximate karne ke liye production AZ ko actually shut down karna necessary nahi. Staging mein selected AZ ke app tasks drain/remove karo, new launch placement restrict karo, and target health + user request success observe karo. This tests some app-layer behavior, but full AZ outage simulation nahi: network, control plane, managed DB failover, and egress dependencies still differ. Result ko “one-AZ app capacity drill” label karo, full regional resilience certification nahi. AWS Fault Injection Service ya controlled game day advanced option ho sakta hai, but blast radius and bill review chahiye. Checklist: before/after healthy targets by AZ, p95/error rate, DB failover time, queue age, autoscaling activities, subnet IP availability, and operator intervention.

Network egress example: private app subnet B ka default route NAT gateway A ko point karta hai. A fail hone par existing task local DB path se kuch work continue kar sakta hai, lekin replacement task ECR se image pull nahi kar pata. Secrets Manager and CloudWatch paths bhi affected ho sakte hain. “App B alive” partial availability hai. Route table per subnet inspect karo; required AWS services ke VPC endpoints aur NAT architecture intentional configure karo. AZ-local egress ya redundant path failover target ke hisaab se choose karo; endpoint policy and security groups bhi test karo. Network diagram mein arrows drawn hone se connectivity prove nahi hoti.

Data failover mein RTO and RPO independently measure karo. RDS standby promotion ke dauran existing DB connections break sakte hain; app ko reconnect with backoff and idempotent retry design chahiye. Writes that timed out may have committed, so blindly replaying payment operation double charge create kar sakta hai. Stable operation ID and status lookup use karo. Backups verify data restore, but restore time may exceed failover RTO. Multi-Region copy ho toh replication lag plus promotion steps RPO/RTO determine karte hain. Availability target choose karna finance/product decision hai; implementation team must return measured drill evidence.

## Exercises

1. 900 RPS × .2 s, 30 safe in-flight/task. Baseline count? **Check:** 180 active; 6 tasks. Two AZs 3+3 are insufficient for zero-degradation one-AZ failure; survivor must handle six.
2. ALB in A/B, app in A/B, RDS single AZ A. AZ A fails. **Check:** app B remains but DB writes fail; design data failover separately and test reconnection.
3. RTO 15 minutes, RPO 5 minutes. Failover takes 12 minutes but replication lag reached 9 minutes at incident. **Check:** RTO met, RPO missed. Improve lag/failure mode and retest.

## Quick reference

 Region = separate geographic area; AZ = isolated location within Region; VPC regional; subnet one AZ. AZ redundancy requires healthy serving capacity and dependency path in survivor. Multi-Region needs explicit replication, failover, policy, and tests. RTO measures time to restore; RPO measures tolerated data loss. App tier, data tier, network egress, and secrets/logs paths each need placement review.

**Evidence:** [Regions and Zones](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html), [VPC subnets](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html), [ALB health](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html), [Well-Architected review](https://docs.aws.amazon.com/wellarchitected/latest/framework/appendix.html).
