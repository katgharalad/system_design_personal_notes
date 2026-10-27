# ECS networking and load balancing

**Prerequisite:** ECS capacity models. **Sources:** [ECS task networking](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-networking.html), [ALB target health](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html).

## Learning objectives
- Configure task subnet, ENI, SG, target type, port, and health path as one path.
- Separate ingress, service-to-service, and egress flows.
- Diagnose task IP exhaustion and private image/service access.

## Problem

An ECS service can start tasks that cannot reach the load balancer or dependencies. `awsvpc` creates a task network boundary but consumes one subnet address per task ENI and needs intentional SG/routing.

## Definition and terminology

In `awsvpc`, each task receives an ENI and private IP. ALB IP target groups route to task IPs. A task SG controls ENI traffic. Subnets determine AZ placement and available IPv4 addresses. Service discovery and load balancing are separate routing mechanisms. Public IP assignment, IGW route, NAT, and VPC endpoints are distinct.

## Internal operation

Scheduler selects a configured subnet/AZ; task ENI gets IP and SGs. ALB registers task IP/port, probes health, and routes when healthy. App-to-DB traffic uses task SG as source; response is statefully permitted. Private task image pulls and logs require connectivity to AWS service endpoints, NAT, or supported VPC endpoints. IP address headroom must include deployment surge, not just steady desired count.

## Execution lifecycle

Service launch → ENI allocation → DNS and route become usable → image pull/log setup → container listens → target register → health succeeds → traffic; stop drains target → task ends and ENI releases.

## Worked example 1

Service runs 60 tasks and deployment can temporarily double to 120. Subnet has 100 free IPs shared with other workloads; deployment may fail even though steady count 60 fits. Track usable subnet addresses and other ENI consumers; allocate more subnets or adjust rollout before increasing max.

## Worked example 2

ALB target uses port 8080 but task listens on 3000. Health fails. Confirm container port mapping, target group port/traffic-port, SG inbound 3000 from ALB SG, and `/health/ready` response. Do not open all ephemeral ports to public internet.

## Configuration lab

```json
{"awsvpcConfiguration":{"subnets":["subnet-private-a","subnet-private-b"],"securityGroups":["sg-api-task"],"assignPublicIp":"DISABLED"}}
```

Ensure routes support ECR/log/secret access and the task SG allows only intended clients. IDs are placeholders for a local exercise, not deployable infrastructure.

## Alternatives and decision boundary

`awsvpc` gives per-task network policy and is required for Fargate. Other ECS network modes can share host networking semantics for EC2 tasks, but reduce per-task boundaries and change port allocation. Choose based on compatibility and threat model.

## Tradeoffs

Per-task ENIs simplify SG isolation and observability, but consume IPs and increase ENI lifecycle operations. NAT is broad egress; endpoints can narrow service paths but add endpoint and policy management.

## Failure analysis

Pending ENI: subnet IP/ENI quota. No target: service/TG config or IAM. Unhealthy: port/path/protocol/SG. Task cannot pull: endpoint routes, DNS, execution role. DB timeout: route, SG, NACL, DNS, TLS, or DB saturation.

## Debugging procedure

Inspect service network config, task ENI, subnet/AZ, SG IDs, target health reason, VPC Flow Logs, DNS resolution, and app listener. Test each connection from a task in the same subnet and SG. Record both forward and return path.

## Production checklist
- Subnet IP budget includes rollout surge and scaling ceiling.
- ALB-to-task and task-to-dependency rules use SG references.
- Private task egress is documented and monitored.
- Health and target ports match actual process listeners.

## Practical exercise

Use a 3-AZ service with one full subnet and 80% rollout surge. Calculate minimum IP headroom per AZ. Inject one SG failure and one bad target port; identify different evidence.

## Exercise checks
- Per-AZ capacity includes possible placement imbalance.
- ECR, CloudWatch, and DB paths are not treated as one route.
- Source SG is ALB SG for app ingress.

## Quick reference
- ALB targets in awsvpc are task IPs.
- SG path, route, DNS, target health, and process port all matter.

## Trace the packet path

In `awsvpc`, each task has an ENI and task security group. Trace client → ALB listener → target group → task ENI → container port → response. Check IP target type, port, health path, ALB egress, task ingress, route, and process bind address. A process bound to `127.0.0.1` cannot receive packets through its task ENI.

Private-subnet egress may use NAT or service endpoints. Image pulls, logs, secrets, DNS, endpoint policy, and IAM each matter. An endpoint provides a private network path; it does not grant IAM access. Task ENIs consume subnet addresses, so one subnet can exhaust IPs while another has room. VPC Flow Logs show network accept/reject evidence but not application success.

## Worked diagnosis

A timeout suggests no timely reply; connection refusal often means a host replied but no process listens. Check DNS, forward and return routes, stateful security groups, stateless NACL ingress/egress, and listener. Correlate flow logs with task logs. Do not open all ports as the first step.

## Hinglish explanation

`awsvpc` task ka apna ENI hota hai. ALB se port aur response tak har hop check karo. SG stateful; NACL stateless. Endpoint IAM replace nahi karta. Pending task mein free subnet IP bhi check karo. Flow log packet batata hai, app ka success nahi.

## Trace the packet path

In `awsvpc` mode, each task gets an ENI in a subnet and the task security group attaches to that ENI. For an ALB request, trace client → listener → target group → task ENI → container port → response. Check target type (IP for `awsvpc` tasks), registered port, health path, ALB security-group egress, task security-group ingress from the ALB group, subnet route, and process bind address. A process on `127.0.0.1` can pass an in-container check but fail the ALB probe.

For egress, distinguish destination and name resolution. A private-subnet NAT route enables general outbound IPv4 but adds cost and a failure dependency. Interface endpoints provide private access to supported APIs; gateway endpoints cover specific services such as S3. Image pulls, log writes, secret retrieval, and AWS API calls need a route, DNS, endpoint policy, and IAM authorization. “No internet” does not mean “no AWS API path,” and an endpoint does not bypass IAM.

Task ENIs consume subnet addresses. A task may remain pending when its chosen subnet has no free address, even if another subnet does. Multiple subnets help only when placement and routing allow them. Avoid adding public IPs as a debugging shortcut; diagnose the missing route or endpoint.

## Worked diagnosis: timeout versus refusal

A timeout means no timely response; a refusal often means a host answered but no process accepted the port. Inspect DNS answer, both route directions, security groups (stateful), NACL ingress and egress (stateless), endpoint policy, and listener. Flow Logs can show accepted or rejected records, but cannot prove the application handled the request. Correlate network evidence with service logs. If a rule allows a port only from a client security group, confirm the source ENI actually has that group.

## Hinglish explanation

`awsvpc` mein task ka apna ENI aur security group hota hai. ALB se task port aur response tak path trace karo. SG stateful hai; NACL stateless, return path bhi check karo. Private AWS API access ke liye endpoint ya NAT path chahiye, par endpoint IAM permission replace nahi karta. Task pending ho toh subnet IP gino. Timeout ke basis par saari ports kholna fix nahi; pehle evidence lo.
