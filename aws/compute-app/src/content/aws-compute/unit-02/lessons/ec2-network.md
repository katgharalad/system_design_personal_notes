# EC2 networking, ENIs, addresses, and security groups

**Prerequisite:** VPC architecture. **Sources:** [VPC subnets](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html), [security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html), [instance addressing](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-instance-addressing.html).

## Learning objectives
- Trace a packet from client to ENI and back.
- Separate routing, address translation, and security filtering.
- Debug private/public address and security-group mistakes.

## Problem

An instance can run but remain unreachable because a route is missing, address assignment is wrong, SG source is incorrect, NACL is restrictive, or the process listens only on loopback. “Open port 443” is not a full packet-path explanation.

## Definition and terminology

An ENI provides private addresses, security groups, and attachment metadata inside a subnet. A subnet is an AZ-scoped CIDR. Route tables select next hops; an Internet Gateway provides an internet path for a public subnet when the instance also has a public address and policy permits it. NAT Gateway provides outbound initiation for private IPv4 clients. Security groups are stateful allow rules; network ACLs are stateless subnet-level rules. These controls do not replace host firewalls or application authorization.

## Internal operation

Inbound traffic requires a reachable destination address, a route to the VPC, applicable network filters, an ENI rule allowing the flow, and a process listening on the destination port. Return traffic must have a valid route; stateful SG tracking permits response packets for an allowed connection. For ALB-to-instance traffic, the instance SG should allow the app port from the ALB SG, not from the entire internet. Public IPv4 association and IGW route are separate configuration facts.

## Execution lifecycle

Resolve DNS → choose destination IP → route to VPC/IGW/NAT/endpoint → evaluate subnet NACL and ENI SG → deliver to guest NIC → host firewall → socket → app auth → response path.

## Worked example 1

ALB listener accepts HTTPS 443. Target uses HTTP 8080. ALB SG allows client 443 and egress 8080; instance SG allows 8080 from ALB SG. If the instance SG allows only 443, target health fails even though browser TLS succeeds at the ALB. The listener port and target port are different hops.

## Worked example 2

A private instance needs package updates. Adding a public IP alone is not enough if subnet route lacks `0.0.0.0/0 → NAT Gateway`; a NAT path also requires an internet-connected public subnet. For S3 access, a gateway endpoint may avoid NAT data processing, but route policy and bucket/IAM policy still must allow the operation.

## Configuration lab

```bash
aws ec2 describe-network-interfaces --filters Name=attachment.instance-id,Values=i-0123456789abcdef0
aws ec2 describe-route-tables --filters Name=association.subnet-id,Values=subnet-0123456789abcdef0
aws ec2 describe-security-groups --group-ids sg-0123456789abcdef0
```

Do not solve a failed connection by opening `0.0.0.0/0` broadly. Identify source ENI, destination port, route, and expected return path first.

## Alternatives and decision boundary

Use VPC endpoints for supported AWS service paths when policy, DNS, and endpoint type fit. Use NAT for general outbound IPv4. PrivateLink provides service-specific connectivity without general internet routing. Choose based on exposure, service support, cost, and DNS behavior.

## Tradeoffs

Multiple ENIs can support isolation or appliance patterns but increase routing complexity. Public addressing reduces egress complexity at the cost of larger exposure. SG references scale better than hard-coded ephemeral IP lists inside a VPC.

## Failure analysis

Check DNS answer, route table, IGW/NAT state, SG ingress and egress, NACL both directions, ENI attachment, source/destination checks, host firewall, listener bind address, and app logs. Verify the actual source IP/SG as seen at each hop.

## Debugging procedure

Use Reachability Analyzer for supported modeled paths, VPC Flow Logs for accepted/rejected traffic evidence, and `ss -lntp` on the guest for listener state. Correlate trace ID and target health. Test from the same subnet/source security group as the failing caller.

## Production checklist
- No direct admin port exposure; use SSM or tightly scoped approved access.
- Instance ingress is limited to known upstream SGs.
- Private workloads use explicitly designed egress and VPC endpoints.
- Flow logs and change audit are enabled for critical paths.

## Practical exercise

Diagnose an ALB `unhealthy` target where browser connection to ALB works. Build a packet-hop table with source, destination, port, route, SG, and expected result.

## Exercise checks
- ALB listener 443 is not confused with target port 8080.
- App SG accepts only the ALB SG as source.
- Network ACL return traffic and process listener are checked.

## Quick reference
- Route table chooses path; SG/NACL filter; host firewall and app decide further.
- Public subnet route does not assign a public IP by itself.
- Prefer SG-to-SG rules for tier boundaries.

## Deepened mechanism: Trace ENI, route, security policy, and return traffic

### Worked example 3 — three gates for a private service

An EC2 instance in a private subnet calls a service in another VPC over Transit Gateway. Verify the source subnet route points to the TGW, the TGW route table propagates or explicitly contains the destination CIDR, and the destination VPC route points back through the TGW. Then check both security groups and NACLs, DNS resolution, and overlapping CIDRs. A route in one direction without a return route causes timeout. Security groups are stateful; NACLs are stateless and need return ephemeral ports. Use Reachability Analyzer for supported network paths and Flow Logs for observed accept/reject evidence.

An ENI is a virtual network interface with private addresses, security groups and subnet placement. It can have primary and secondary addresses and can be attached subject to instance and service limits. Moving an ENI can preserve a private address in some designs, but it is not a substitute for load balancing or multi-AZ recovery. Public IPv4 assignment and internet reachability are separate: a public address plus route to an internet gateway and permissive policy are needed for direct internet path. Private subnet egress commonly uses NAT or service endpoints.

### Worked example 4 — security group versus NACL

A client reaches an ALB listener, but the target connection times out. Confirm ALB security group ingress on the listener port and target security group ingress from the ALB security group on the target port. The target security group does not need a broad internet source. Then inspect subnet NACLs for the request and ephemeral return path. If flow logs show ACCEPT but the app refuses the connection, check listener process and host firewall rather than widening VPC rules.

### Production runbook

Test name resolution from the same subnet; inspect route table association; verify source/destination and port; compare security-group rules; check NACL; then inspect host firewall and process. Use VPC Flow Logs for traffic-level evidence, Reachability Analyzer for configured path analysis, and packet capture only when authorized and necessary. Record which boundary rejected traffic before changing a policy.

### Roman Hinglish explanation

Network ko hop-by-hop trace karo. Source ENI kis subnet mein hai? Subnet route table packet ko kahan bhejti hai? Destination ke paas return route hai? Security group allow karta hai? NACL dono direction mein sahi ephemeral ports allow karti hai? DNS sahi private IP deta hai? In checks ka order rakho; direct `0.0.0.0/0` kholna diagnosis nahi hai. Security group stateful hota hai, NACL stateless. EC2 instance `running` hone se app port reachable prove nahi hota. Reachability Analyzer expected path batata hai; Flow Logs actual traffic ka evidence dete hain.

### Direct AWS references for these mechanisms

- [Route tables](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html) — subnet route selection.
- [Security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html) — stateful interface-level rules.
- [Network ACLs](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html) — stateless subnet rules.
- [Reachability Analyzer](https://docs.aws.amazon.com/vpc/latest/reachability/what-is-reachability-analyzer.html) — configured-path analysis.
