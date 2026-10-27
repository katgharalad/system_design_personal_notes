# Lambda networking and VPC access

**Prerequisite:** VPC, subnets, route tables, security groups, DNS. **Sources:** [VPC configuration](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html), [VPC basics](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html), [NAT gateways](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html), [VPC endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html).

## Learning objectives
- Explain what changes when a Lambda function attaches to a VPC.
- Trace packets from a function to RDS, a public API, and an AWS service endpoint.
- Separate subnet routes, security groups, DNS, and IAM permissions.
- Diagnose IP exhaustion, missing egress, and connection timeouts with evidence.

## The actual problem

The phrase “put Lambda in a private subnet” often hides a reachability mistake. A function attached to a VPC can reach resources through the configured VPC network, but it does not automatically receive internet access. A subnet named `private` is not a security feature by itself: routing, security groups, DNS, and resource policies decide the path. Similarly, attaching the function to a public subnet does not give it a public IP and an internet route.

First list the destinations: RDS, internal services, S3, Secrets Manager, a third-party HTTPS API, or an on-premises endpoint. For each destination, record DNS name, address family, port, route, filter, identity permission, expected throughput, and timeout. Network reachability and service authorization are separate gates.

## Architecture and components

Lambda VPC configuration associates the function with selected subnets and security groups. AWS manages the network attachment; the function’s packets use the VPC paths those subnets provide. Select subnets in multiple Availability Zones for resilience where appropriate. The VPC subnet must have free addresses and the correct route-table association. Security groups attach to network interfaces and are stateful. Network ACLs are stateless subnet filters. Route tables choose a next hop; they do not grant permission.

Example database path:

```text
Lambda VPC attachment
  -> private app subnet route table
  -> local VPC route
  -> RDS ENI address
  -> RDS security group allows DB port from Lambda security group
  -> RDS listener and database authentication authorize connection
```

Example third-party API path:

```text
Lambda ENI -> private subnet route -> NAT gateway in public subnet
  -> internet gateway -> external API
```

For supported AWS services, a VPC endpoint may provide a private path. A gateway endpoint for S3 or DynamoDB updates route tables; an interface endpoint uses endpoint ENIs and security groups. Endpoint policy and IAM still control data access. A private route does not bypass authorization.

## Lifecycle and packet diagnosis

1. Function invokes and obtains its VPC network path.
2. Runtime resolves the destination name using configured DNS.
3. The packet uses the attached subnet’s route table.
4. Security group egress and destination ingress rules are evaluated; NACLs may also filter each direction.
5. The target service accepts the TCP/TLS connection and applies its own authentication and authorization.
6. Application timeout and retry behavior determine what the caller sees.

When a connection times out, inspect one hop at a time. First verify DNS resolution and resolved address. Then inspect subnet ID/AZ, route-table association, route target state, NAT/endpoint status, security group source/destination/port, NACL return path, and VPC Flow Logs reject records. If TCP connects but the request returns 403, the issue may be IAM, endpoint policy, resource policy, or application auth rather than routing.

## Worked example 1: RDS and public API

Function subnets are `10.40.16.0/20` in AZ-a and `10.40.32.0/20` in AZ-b. RDS is in private data subnets. Function must connect to PostgreSQL on 5432 and call `payments.example.net` over HTTPS.

For PostgreSQL, use local VPC routing and an RDS security-group ingress rule with source equal to the function security group and port 5432. Avoid a broad VPC CIDR source. The function execution role needs secrets access if it retrieves credentials from Secrets Manager; that role permission does not open port 5432. Database credentials do not replace SG rules.

For the public API, each selected private subnet needs a valid egress path, typically a NAT gateway in a public subnet whose route table sends `0.0.0.0/0` to an internet gateway. The private route table points its default route to the NAT gateway. If one NAT gateway serves multiple AZs, cross-AZ traffic can add cost and make the path depend on another AZ; evaluate per-AZ NAT or alternative egress design against availability and cost. A NAT gateway does not allow unsolicited inbound connections to the function.

## Worked example 2: address headroom during concurrency growth

Assume a subnet has 4,096 IPv4 addresses before AWS-reserved addresses and current use. It currently has 3,400 free addresses. A burst causes 800 more Lambda network attachments and other deployment activity may need 500 addresses. Approximate remaining headroom is `3,400 - 800 - 500 = 2,100`; this is an estimate, not a guarantee, because ENI/address allocation and other subnet consumers matter. Check `AvailableIpAddressCount`, ENIs, Lambda subnet configuration, and deployment surge in every AZ. A function with two configured subnets can fail asymmetrically if one subnet is exhausted.

Do not infer that concurrency equals one dedicated ENI per invocation. Lambda networking implementation and ENI reuse are service-managed; design for documented subnet address capacity and observed configuration, not a simplistic one-IP-per-request model.

## Worked example 3: private S3 access

A function downloads a 12 MB object from S3, transforms it, and writes a 2 MB result. Compare NAT and an S3 gateway endpoint. A gateway endpoint can keep supported S3 traffic on AWS’s private routing path and avoid NAT processing for that traffic. Add the endpoint to the correct route tables, review endpoint and bucket policies, and retain the function’s least-privilege `GetObject`/`PutObject` permissions. If requests still fail, check bucket region, KMS decrypt/encrypt permission, object key, endpoint policy, DNS, and application response. The endpoint does not grant S3 permissions.

## AWS configuration lab

Example update uses existing subnet and security-group IDs. This is a mutating AWS command; do not execute it against a production function during study.

```bash
aws lambda update-function-configuration \
  --function-name reservation-api \
  --vpc-config SubnetIds=subnet-app-a,subnet-app-b,SecurityGroupIds=sg-lambda

aws lambda get-function-configuration \
  --function-name reservation-api \
  --query '{State:State,LastUpdateStatus:LastUpdateStatus,Vpc:VpcConfig}'

aws ec2 describe-route-tables --filters Name=vpc-id,Values=vpc-example
aws ec2 describe-subnets --subnet-ids subnet-app-a subnet-app-b \
  --query 'Subnets[].{AZ:AvailabilityZone,CIDR:CidrBlock,Free:AvailableIpAddressCount}'
```

The function’s execution role needs permissions required for Lambda’s VPC network-interface management. AWS-managed policies can grant broader actions than the function’s business permissions; scope and review them. Distinguish service-managed networking permissions from runtime permissions such as `secretsmanager:GetSecretValue` or `s3:GetObject`.

## Production incident: RDS connects, external call hangs

Symptoms: database reads succeed; third-party calls time out only after VPC attachment. Compare a known-good non-VPC test and the affected function’s subnet IDs. Inspect each subnet route table for the NAT default route, NAT gateway state, public-subnet route to the internet gateway, NAT subnet public address behavior, security-group egress on 443, NACL ephemeral return ports, DNS answers, and external allowlist. Check VPC Flow Logs for `REJECT`, NAT metrics for port allocation or packet drops, and application logs for DNS vs connect vs TLS timeout. Mitigate with a known-good egress path or rollback the VPC change; do not open every port to `0.0.0.0/0` as a diagnosis shortcut.

## Alternatives and tradeoffs

Use a VPC attachment when private VPC resources or controlled network paths require it. If a function only calls public AWS APIs, VPC attachment may add routing and subnet design without benefit; make the security decision from current service behavior and policy requirements. A NAT gateway supports general outbound IPv4 but has hourly and data-processing costs. PrivateLink endpoints narrow service paths and reduce dependency on internet egress but add endpoint cost, policies, DNS, and AZ placement choices. A proxy or service API can centralize access but adds a network hop and operational owner.

## Practical exercise

Draw paths from one Lambda to (A) private PostgreSQL, (B) a public payment API, and (C) S3 with an endpoint. For each, annotate subnet/AZ, route, security group, NACL, DNS, IAM or resource policy, and timeout. Inject one missing route and one missing IAM action; give different evidence and fixes.

## Exercise checks
- RDS path uses local VPC routing and narrowly scoped SG rules; IAM does not open a TCP port.
- Public API path has a working NAT/default route or another explicit egress design.
- S3 endpoint changes routing; IAM, bucket policy, KMS policy, and endpoint policy still apply.
- Diagnosis separates DNS, route, filter, connection, TLS, and authorization symptoms.
- Subnet free-IP headroom is checked in every selected AZ.

## Quick reference
- VPC attachment changes network reachability, not IAM authorization.
- Public subnet does not automatically give Lambda a public IP.
- Private subnet does not automatically have outbound internet.
- Routes, SGs, NACLs, DNS, endpoint policy, and IAM are separate checks.
- Plan subnet IP headroom and AZ distribution for scaling and deployment.

## Roman Hinglish explanation

Lambda ko VPC mein attach karna private database tak network path deta hai; public internet apne aap nahi deta. Packet ko subnet se nikalna hai, route table ko next hop batana hai, security group ko allow karna hai, aur return path bhi sahi hona chahiye. RDS ke liye same VPC ka local route ho sakta hai; public API ke liye private subnet se NAT tak, phir internet gateway tak route chahiye. S3 ya kisi AWS service ka endpoint ek service-specific private path deta hai, general internet nahi. Timeout aaye to sab ports kholne se pehle layer identify karo: DNS resolve hua? TCP connect hua? TLS certificate match hua? Database ne authenticate kiya? Flow Logs aur exact application error se answer milega. Do AZ ke subnet hona single-AZ dependency ko redundant nahi banata.
