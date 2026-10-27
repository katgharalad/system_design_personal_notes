# ECS and EKS decision framework

**Prerequisite:** ECS fundamentals and EKS architecture. **Sources:** [AWS container decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-container-service.html), [ECS services](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_services.html), [EKS architecture](https://docs.aws.amazon.com/eks/latest/userguide/eks-architecture.html).

## Learning objectives
- Compare control surface, ecosystem, portability, workload fit, and team ownership.
- Explain how organizational scale changes platform cost.
- Defend a reversible decision with measurable revisit triggers.

## Problem

“Kubernetes is the industry standard” is not a workload requirement. “ECS is simpler” is not enough if the team depends on Kubernetes operators or APIs. The choice affects delivery speed, failure modes, staffing, and platform ownership for years.

## Definition and terminology

ECS is AWS-native container orchestration with ECS task/service APIs. EKS runs upstream Kubernetes API concepts with AWS-managed control-plane operation and multiple compute choices. Both can run containers on EC2 or managed capacity. EKS is not automatically portable: IAM, networking, storage, ingress, and managed add-ons can be AWS-specific. ECS is not inherently less capable for a service; compare required orchestration features.

## Internal operation

ECS service scheduler maintains desired task count and integrates AWS task definitions, capacity providers, and target groups. EKS controllers reconcile Kubernetes objects; team operates add-ons/policies and chooses compute mode. Both need image supply chain, network, identity, health, capacity, rollout, and observability. EKS introduces API server/RBAC/CRD/controller lifecycle; ECS introduces its own task/service model and ecosystem.

## Worked decision

Small team owns six AWS services, has no Kubernetes platform team, and needs HTTP APIs plus workers. Start with ECS/Fargate or EC2 based on host/control/cost needs; add queues and deployment automation. If the organization later requires Kubernetes operators, shared platform APIs, and multi-cloud scheduling, evaluate EKS with staffed ownership and migration cost. Do not create a cluster to “future proof” without a trigger.

## Configuration lab

Create a decision record with: required API/features; node/host needs; team on-call skill; number of workloads/clusters; upgrade owner; portability goal; workload density; security controls; monthly cost model; exit/migration cost. Score evidence, not preference.

## Alternatives and decision boundary

App Runner historically simplified source/image-to-web-service deployment, but AWS’s current guide says it is closed to new customers and recommends ECS Express Mode for new equivalents. Existing customers can continue using App Runner. This availability change is a reason to verify service lifecycle before recommending it. Lambda, Batch, and managed application platforms may avoid a general-purpose orchestrator entirely.

## Tradeoffs

ECS can reduce control-plane/add-on overhead and align with AWS primitives. EKS offers a broad ecosystem and Kubernetes standard API, at the cost of upgrades, cluster operations, and platform engineering. Fargate and EC2 choices affect capacity ownership independently of ECS vs EKS.

## Failure analysis

A platform decision fails when team cannot patch it, cannot observe it, workloads need unsupported host access, or complexity dominates product work. Revisit only after measurable signals: deployment bottleneck, feature gap, utilization/cost, compliance, or team ownership change.

## Debugging procedure

Compare a representative service deployment and failure drill on candidate platforms. Measure lead time, rollback, p95, utilization, on-call pages, upgrades, and per-service cost. Include platform labor and migration risk.

## Production checklist
- Named platform owner and upgrade/on-call plan.
- Required workload APIs/features verified on current AWS offering.
- Capacity model and migration path written.
- Decision has trigger and review date.

## Practical exercise

Choose ECS or EKS for a 20-person org operating 80 services across 3 teams. Add constraints: Kubernetes operator requirement, 24/7 upgrade SLO, and no platform team. State what evidence changes your choice.

## Exercise checks
- Distinguish orchestrator from compute capacity.
- Include operating ownership and lifecycle state of AWS services.
- Recommendation names alternative and revisit trigger.

## Quick reference
- EKS is a Kubernetes control plane, not “managed everything.”
- ECS and EKS both require app, security, cost, and availability operations.
- Verify current service availability before architecture selection.

## Decide by the operating model

ECS exposes AWS-native task, service, and deployment APIs. EKS provides the Kubernetes API and ecosystem, with AWS managing the control plane. EKS does not manage every controller, node, add-on, policy, upgrade, or application incident. Managed node groups automate parts of EC2 node lifecycle; teams still plan capacity, disruption, AMI and add-on compatibility. [EKS architecture](https://docs.aws.amazon.com/eks/latest/userguide/eks-architecture.html).

Portability is conditional. Kubernetes manifests can move while IAM, load balancers, storage, networking, telemetry, and autoscaling remain cloud-specific. Name the portability level required. Compare who operates upgrades, incidents, workload identity, admission controls, and cost. Run the same service through build, deploy, scale, AZ loss, rollback, and diagnosis before selecting a platform.

## Worked case

A team asks for Kubernetes to avoid lock-in but uses AWS load-balancer controller, EBS storage, IRSA, and CloudWatch. Its workload uses Kubernetes APIs; its platform contract remains AWS-specific. If a second cloud is a real requirement, specify replacement controllers and test migration. If the need is internal standard APIs, EKS may still fit.

## Hinglish explanation

EKS managed control plane deta hai, managed everything nahi. ECS aur EKS ko team skill, required APIs, on-call aur operational cost se compare karo. Kubernetes manifest portable hone se IAM, storage aur networking portable nahi ho jaate. Decision ko real failure drill se defend karo.

## Decision record template

Record workload duration and trigger, task/pod resource shape, traffic pattern, state and storage, network boundary, deployment needs, security requirements, dependency limits, recovery objective, team skills, and expected operating cost. Separate hard constraints from preferences. Then write the candidate, one credible alternative, evidence, failure modes, and a revisit trigger. Example trigger: “Revisit ECS if the organization adopts a supported Kubernetes operator that becomes a product requirement,” not “revisit when the platform feels old.”

Compare total operating burden. ECS still needs task definitions, IAM, networking, health, service deployment, and observability. EKS adds Kubernetes API objects and cluster-level responsibilities such as version/add-on compatibility, controllers, admission, RBAC, and node lifecycle depending on the selected compute mode. Fargate changes host management; it does not settle the ECS-versus-EKS decision by itself. A team can choose EKS Fargate or ECS Fargate and still have different APIs, deployment workflows, and support burden.

## Three-stage interview defense

First state the decision and workload assumptions. Next explain the lifecycle and the operational tasks the team accepts. Finally change one constraint: require a Kubernetes operator, add custom host software, move to sustained predictable utilization, or reduce on-call staffing. Explain whether the choice changes and what measurements would settle remaining uncertainty. A defensible answer has a condition under which it would be wrong.

## Unit 4 closed-book assessment

Answer before opening earlier chapters. Use English for the interview response. State assumptions, calculations, the AWS boundary, and evidence that would change your choice.

### 1. Conceptual explanation

Explain the difference between an image digest, task-definition revision, running ECS task, and ECS service. State which item changes when code is rebuilt and which component restores desired count.

**Self-check:** Digest identifies image bytes; task definition is a launch template revision; task is a running instance; service reconciles desired count and deployment state.

### 2. Internal mechanism

A task is RUNNING, its container health check passes, and ALB marks its IP target unhealthy. Trace the independent checks and name evidence for each hop.

**Self-check:** Compare target reason, port/path, task ENI and security group, route, process bind address, and container health result. RUNNING and container health do not prove ALB reachability.

### 3. Configuration exercise

A private ECS task must pull from ECR, write logs, retrieve one secret, and read one S3 prefix. Describe roles, endpoint/network paths, and policy boundaries without broad internet egress.

**Self-check:** Separate execution role from task role; list registry/image data, logs, secret, and S3 paths; check DNS, endpoint policies, security groups, and scoped IAM. A route does not grant permission.

### 4. Numerical capacity problem

An API needs 500 requests/second. Load tests show one task safely sustains 200 requests/second. Tasks are split evenly across two AZs. How many tasks must run before failure so one AZ loss still serves 500 requests/second?

**Self-check:** The surviving AZ needs `ceil(500/200) = 3` tasks. Even placement therefore needs six tasks total, three per AZ, before failure. Validate that the test rate includes downstream and tail-latency constraints; include rollout surge.

### 5. Production debugging

EKS Pods are Pending; nodes have spare CPU and memory. Events report sandbox network setup failure. Give three checks and a safe recovery sequence.

**Self-check:** Inspect CNI logs/configuration, subnet free IPs and ENI limits, and node/subnet placement. Add usable address capacity or correct supported CNI allocation; keep healthy nodes serving until replacements become Ready.

### 6. Architecture comparison

A stable service runs 40 tasks continuously. The team can patch EC2 hosts but has no Kubernetes need. Compare ECS on EC2 with ECS on Fargate and state what measurement settles cost.

**Self-check:** Compare host ownership, placement control, sustained utilization, scaling, isolation, and total cost. Benchmark useful throughput and include idle/headroom capacity, storage/network, and operations. Do not infer cheaper from list price alone.

### 7. Multi-stage defense

An AZ fails during a new release and the database reaches its connection limit. Explain mitigation order, what to preserve, and which changed requirement might force another compute model.

**Self-check:** Bound admission and DB connections; preserve healthy capacity; stop or roll back using a known image digest and compatible schema; verify target health and queue age. Revisit the platform if isolation, host control, duration, or required APIs are unsupported.

Score each answer for accurate mechanism, explicit assumptions, concrete evidence/calculation, and a tradeoff or failure boundary. This is self-study; the app does not grade answer meaning.
