# VPC architecture

**Prerequisite:** Regions and Availability Zones. **Sources:** [Amazon VPC](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html), [subnets](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html), [route tables](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html).

## Learning objectives
- Explain VPC CIDR, subnets, ENIs, routes, and AZ scope from first principles.
- Trace a request path across public ingress, private compute, and data tier.
- Diagnose overlap, missing route, IP exhaustion, and unintended exposure.

## First principles: addressing and routing

An IP prefix identifies a range. A subnet divides a VPC CIDR and belongs to one AZ. Each resource receives an ENI/address. A route table maps destination prefixes to targets; longest-prefix match selects the most specific matching route. A route only describes where to send packets; security groups, NACLs, DNS, and application listeners still affect success. CIDR overlap breaks routing between connected networks and is expensive to fix after adoption.

## Architecture walkthrough

Client resolves public DNS → internet-facing ALB ENI in public subnets → listener selects target → task/instance ENI in private app subnet → DB ENI in isolated subnet. App outbound path to public API uses NAT or a supported private service path. Each subnet route table and SG boundary should be drawn. Public subnet is a routing property (route to IGW); it does not itself assign a public IP to each host.

## Worked example

VPC `10.40.0.0/16`; three AZs. Reserve `/24` public and `/20` private-app subnets per AZ, plus isolated DB ranges. A `/20` has 4,096 addresses, minus AWS-reserved addresses per subnet and existing ENIs. If service can reach 500 task ENIs during surge across three AZs, distribute address demand and leave room for endpoints, ALB nodes, NAT, and other consumers. Exact usable count depends on subnet size and AWS reservations.

## Configuration lab

```bash
aws ec2 describe-route-tables --filters Name=vpc-id,Values=vpc-0123456789abcdef0
aws ec2 describe-subnets --filters Name=vpc-id,Values=vpc-0123456789abcdef0 \
  --query 'Subnets[].{AZ:AvailabilityZone,CIDR:CidrBlock,Free:AvailableIpAddressCount,PublicIP:MapPublicIpOnLaunch}'
```

These read-only commands expose routing and IP headroom. Do not create billable NAT Gateways in this lab. Simulate paths on paper or local test harness.

## Alternatives and tradeoffs

Separate VPCs isolate routing/admin boundaries but add connectivity and DNS complexity. Shared VPC/subnets can simplify connectivity but increase shared blast radius. NAT provides general outbound path; service endpoints can provide narrower routes for supported AWS services. Choose CIDR and segmentation from expected growth and trust boundaries.

## Failure investigations

1. **Private Lambda cannot call external API.** Check attached subnet route, NAT in public subnet, NAT health, SG egress, NACL return path, DNS, and external allowlist. A VPC-attached function does not gain internet access automatically.
2. **App cannot reach DB after AZ expansion.** Inspect subnet route associations, DB SG source, DNS, NACLs, and overlapping CIDR. Compare working/failing AZ ENIs and VPC Flow Logs.

## Production checklist

- Address plan avoids future peering/VPN overlap.
- Public ingress and private egress are explicit.
- Per-AZ IP headroom includes rollout and failover.
- Flow logs, DNS, route ownership, and change review exist.

## Practical exercise

Draw VPC for ALB, three app AZs, RDS, S3, and external API. Mark each route, SG source, DNS name, and egress mechanism. Inject missing NAT route and DB SG rule; give different evidence and remediation.

## Exercise checks
- Each subnet is placed in one AZ and uses the intended route table.
- The public ALB path and private application egress path are separate.
- Security group rules name the source and destination tier; routes alone do not permit traffic.
- A VPC-attached Lambda has no public internet path unless the subnet routing provides one.
- The diagnosis checks DNS, routes, filters, and service health as separate layers.

## Quick reference

- Subnet is AZ-scoped; VPC spans AZs within one Region.
- Route, filter, address, and listener are separate facts.
- Private subnet does not imply outbound internet.
