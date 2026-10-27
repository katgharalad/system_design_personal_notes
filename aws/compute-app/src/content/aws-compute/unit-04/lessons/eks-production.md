# EKS architecture and deployment

**Prerequisite:** Kubernetes fundamentals. **Sources:** [EKS architecture](https://docs.aws.amazon.com/eks/latest/userguide/eks-architecture.html), [EKS compute choices](https://docs.aws.amazon.com/eks/latest/userguide/eks-compute.html), [Pod identity](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html).

## Learning objectives
- Separate AWS-managed control plane from customer-managed data plane and add-ons.
- Compare managed node groups, Auto Mode, Fargate, and self-managed nodes.
- Deploy a workload with IAM, network, rollout, and upgrade plans.

## Problem

“EKS is managed Kubernetes” is incomplete. AWS manages Kubernetes control plane availability; the team still chooses and operates nodes or other compute, CNI, add-ons, IAM access, version upgrades, policy, workloads, and cost boundaries according to selected mode.

## Definition and terminology

An EKS cluster provides AWS-managed Kubernetes control plane integrated with customer VPC/network configuration. Data plane can use managed node groups, self-managed EC2, EKS Auto Mode, Fargate, or supported hybrid compute. Managed node groups automate node lifecycle but use EC2/ASG resources in the account. Auto Mode extends AWS management over more data-plane functions. Workload IAM should use a supported Pod identity mechanism, not shared node credentials by default.

## Internal operation

Kubernetes API objects flow through the control plane. Nodes run kubelet/container runtime and connect through VPC CNI networking. EKS cluster endpoint access, node role, Pod identity, CNI permissions, and security groups are separate. Add-ons such as DNS, network plugin, storage driver, and ingress controller have compatibility/version requirements. Upgrades must account for API deprecations, add-on compatibility, PodDisruptionBudgets, and capacity for node replacement.

## Execution lifecycle

Create cluster/control-plane access → configure nodes/capacity → install compatible add-ons → apply workload and Pod identity → schedule and attach network/storage → expose service → upgrade control plane/add-ons/nodes in tested sequence.

## Worked example 1

Three replicas request 1 vCPU and 2 GiB. Node group has 4 vCPU/16 GiB instances, but allocatable is lower; DaemonSets reserve resources. A rolling node update plus workload surge can require extra nodes. Model bin packing and AZ spread using allocatable values, not instance headline totals.

## Worked example 2

Pod calls S3 and gets AccessDenied. Node role has S3 access, but Pod identity is misconfigured or policy subject does not match service account. Verify workload identity association, role trust, service-account annotation/association, and role policy. Avoid granting S3 access to every Pod via node role.

## Configuration lab

```bash
aws eks describe-cluster --name lab --query 'cluster.{Version:version,Status:status,Endpoint:endpoint,Subnets:resourcesVpcConfig.subnetIds}'
kubectl get nodes -o wide
kubectl get pods -A -o wide
```

Compare cluster API status, node readiness, and workload readiness. Local commands are read-only examples; actual cluster operations can incur cost.

## Alternatives and decision boundary

Use EKS when Kubernetes APIs, ecosystem, portability, or platform standardization justify its operational surface. Auto Mode can shift more infrastructure operations to AWS. ECS can be simpler for AWS-native task scheduling. Fargate in EKS changes node management for supported Pods but has constraints; it is not the same as a full general-purpose node.

## Tradeoffs

Kubernetes flexibility increases add-on, upgrade, policy, and incident complexity. Managed control plane reduces control-plane operation but not workload engineering. EKS cluster fees and node/task resources must be included in cost model. Version skew and API removal make upgrades ongoing work.

## Failure analysis

Pods pending: nodes, taints, IPs, quota, requests. Nodes NotReady: kubelet, CNI, IAM, network. DNS failure: CoreDNS and VPC path. API inaccessible: endpoint, authn/authz, network. Upgrade failure: compatibility and disruption budget.

## Debugging procedure

Start with `kubectl get events`, node conditions, Pod describe/logs, EKS control-plane logs, add-on version, and IAM mapping. Correlate node launch/ASG events with deployment. For networking, inspect Pod IP allocation and VPC routes/SGs.

## Production checklist
- Control plane, node, add-on, and workload upgrade policies exist.
- Pod identities and RBAC are least privilege.
- Node capacity spans AZs with rollout headroom.
- Cluster costs and ownership have named teams.

## Practical exercise

Deploy an API to a managed node group; give its service account read-only access to one S3 prefix. Rotate node group version and verify disruption budget and Pod identity remain correct.

## Exercise checks
- Control plane and worker lifecycle responsibilities are separated.
- Pod access does not depend on broad node role.
- Upgrade includes add-ons, APIs, and N-1 capacity.

## Quick reference
- EKS manages control plane; selected compute mode determines data-plane duties.
- Managed node group still uses customer-account EC2 resources.
- EKS Auto Mode and Fargate are distinct options with different boundaries.

## Control plane, data plane, and identity

EKS manages control-plane availability. Nodes, CNI, DNS, storage drivers, add-ons, policies, observability, and workloads remain operational concerns. Managed node groups automate parts of EC2 lifecycle, not capacity planning, disruption, node upgrades, and placement. Check Kubernetes version, EKS platform, add-on versions, CRDs, admission webhooks, and AMIs together during upgrades. A healthy API server does not prove CNI or CSI works. [EKS architecture](https://docs.aws.amazon.com/eks/latest/userguide/eks-architecture.html).

VPC CNI pod addresses consume subnet and ENI capacity. Pods can stay pending with CPU headroom if IPs run out. Plan CIDRs for peak plus rollout surge; inspect scheduler events, CNI logs, subnet free addresses, and ENI limits. Use Pod Identity or IRSA for workload IAM; restrict metadata access. Kubernetes RBAC and IAM protect different APIs. [EKS networking](https://docs.aws.amazon.com/eks/latest/userguide/eks-networking.html).

## Incident drill

Pods remain pending after a traffic spike. Check requests, taints, affinity, PVC, and IP assignment before adding CPU. Add address or node capacity only when evidence identifies that limit. Do not drain healthy nodes until replacement capacity is ready.

## Hinglish explanation

Control plane managed hai, data plane ke nodes, CNI, DNS aur add-ons ka design chahiye. CPU free hone par bhi pod IP ke bina pending ho sakta hai. Upgrade mein CNI/CSI compatibility check karo. Workload identity do; node role metadata se expose mat hone do.

## Upgrade and recovery procedure

Before an EKS upgrade, inventory Kubernetes API usage, deprecated resources, EKS add-ons, third-party controllers, admission webhooks, CNI/CSI versions, node AMIs, and disruption budgets. In a test cluster, upgrade one supported step at a time, then verify DNS, pod networking, storage mounts, IAM identity, ingress, autoscaling, and logging. In production, preserve spare node capacity while replacing nodes and check PodDisruptionBudgets. A budget can block voluntary eviction; it cannot make an unhealthy workload available.

For pending workloads, combine Kubernetes and AWS evidence: `kubectl describe pod` for scheduling and sandbox events; node conditions for readiness; CNI logs for IP allocation; CloudTrail for AWS API authorization; and subnet/ENI capacity metrics for address pressure. Kubernetes RBAC and IAM protect different control planes. During mitigation, keep healthy nodes serving and add capacity in a subnet that can actually allocate Pod addresses.

## Exercise: verify workload identity

Map a service account to a narrowly scoped role in a nonproduction cluster. From a pod, call one allowed AWS API and one deliberately denied action. Verify the principal in the response and audit logs, then confirm an ordinary pod cannot use the node role through IMDS. Record agent and policy prerequisites; an association object alone does not prove the credential path works.
