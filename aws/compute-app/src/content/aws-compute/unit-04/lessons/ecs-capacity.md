# ECS on EC2 and Fargate

**Prerequisite:** ECS fundamentals. **Sources:** [ECS capacity options](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/capacity-launch-type-comparison.html), [Fargate task isolation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html).

## Learning objectives
- Identify which infrastructure each capacity model manages.
- Select EC2, Fargate, or ECS Managed Instances from host-control, utilization, and workload constraints.
- Model placement, scaling delay, isolation, and responsibility boundaries.

## Problem

“Fargate is always safer” and “EC2 is always cheaper” are both weak claims. The right choice depends on resource shapes, utilization, startup, host requirements, team ability, and density. Both designs still need reliable app and network behavior.

## Definition and terminology

ECS is the orchestrator. **Fargate** is serverless container capacity where AWS provisions/operates underlying infrastructure and tasks get documented isolation. **ECS on EC2** places tasks on instances you own and patch; you control host family and fleet. **ECS Managed Instances** is a separate capacity provider model in which AWS manages EC2 instance provisioning and lifecycle while exposing specific capacity choices. Verify current feature matrix before deciding.

## Internal operation

With EC2 capacity, ECS scheduler places task against registered host resources and constraints; ASG/capacity provider supplies instances. Host daemon, AMI, patch, reserved resources, fragmentation, and scale-out readiness are your concern. Fargate allocates task-shaped capacity; no host daemon or instance AMI for customer to maintain. ENI/subnet IPs, task CPU/memory combinations, quotas, platform version, and deployment surge still matter. Managed Instances shifts host lifecycle work but must not be conflated with Fargate.

## Execution lifecycle

Task desired → capacity provider selects/requests capacity → scheduler satisfies placement → image starts → health gates traffic → scale/stop tasks → provider scales underlying capacity according to its own model.

## Worked example 1

Ten tasks each need 0.5 vCPU, 1 GiB and run 24/7. Compare measured Fargate task charges against EC2 instance cost plus idle reserve, EBS, data transfer, and operations. EC2 can pack tasks densely if shapes fit, but leave capacity for deployment surge and AZ loss. Do not compare only vCPU rate.

## Worked example 2

A task requires host-level kernel module or custom privileged agent. Fargate may not expose the host feature; validate the service support boundary. EC2 capacity may fit but adds patching and host hardening. If custom host requirement is not actually necessary, remove it and regain managed execution options.

## Configuration lab

```json
{"capacityProviderStrategy":[{"capacityProvider":"FARGATE","weight":1}]}
```

Strategy syntax is illustrative. For EC2, define capacity provider with ASG and managed scaling; set instance types and subnets across AZs; monitor scale-out lag and reserved capacity. Never mix pricing assumptions across capacity providers without equivalent runtime and architecture.

## Alternatives and decision boundary

Prefer Fargate for variable task count and low host-ops appetite when task constraints fit. Prefer EC2 when host control, specialized instance, dense steady utilization, or unsupported Fargate capability is required. Evaluate ECS Managed Instances as its own managed host option. EKS choice is separate from capacity type.

## Tradeoffs

EC2 gives granular purchase strategy and density but risks stranded capacity and host toil. Fargate simplifies fleet ownership but may cost more under sustained utilization and has feature boundaries. Managed Instances aim to preserve EC2 choices with more managed lifecycle; inspect current availability and supported configuration.

## Failure analysis

EC2 tasks pending: host CPU/memory, port, attribute, agent, or AZ imbalance. Fargate tasks pending: subnet IPs, quota, unsupported shape/platform, image pull, IAM, or service availability. Deploy surge may fail even when steady state fits.

## Debugging procedure

Inspect task placement failure reason, capacity provider association, cluster registered resources, ASG activities, task ENI, quotas, and deployment maximum. Reproduce with a small task using same subnet/role and image. Evaluate host pool and task-level metrics separately.

## Production checklist
- Compare equivalent useful work and include idle, network, storage, and labor costs.
- Keep capacity for rollout and AZ loss.
- Verify current service limits and hardware support.
- Set separate ownership/runbook for host-based capacity.

## Practical exercise

Choose a capacity model for a variable video service with 45-minute jobs, custom libraries, and sensitive files. State whether task isolation, GPU availability, and egress policy change your decision. Compare monthly cost only after load profile is measured.

## Exercise checks
- 45-minute duration alone does not force EC2; Fargate/Lambda support and limits need validation.
- Host control and task isolation requirements are explicit.
- Cost includes utilization and operating cost, not only listed compute price.

## Quick reference
- ECS is control plane; EC2/Fargate/Managed Instances supply capacity.
- Fargate removes host management, not task IAM/network duties.

## Capacity is multidimensional

EC2 capacity includes compatible CPU, memory reservations, ports, architecture, AZ placement, and host availability. Idle CPU can coexist with placement failure because memory or ports bind first. Fragmentation leaves unused resources that cannot fit the task shape. Capacity providers can scale an Auto Scaling group, but instance launch, bootstrap, ECS registration, and image pull take time. Fargate removes host selection but still uses quotas, supported sizes, subnet IPs, and downstream capacity. Measure each limit and scaling delay.

## Worked calculation

Each host has 4 vCPU and 16 GiB; each task reserves 1 vCPU and 3 GiB. CPU fits four tasks; memory fits five, so CPU binds before overhead. Six hosts across three AZs yield at most 24 tasks. Losing one AZ leaves four hosts or 16 slots. Demand of 18 means no N-1 capacity. Recompute with actual reservations, daemon overhead, placement rules, and deployment surge. If reactive scale is slower than queueing budget, maintain warm capacity or apply admission control.

## Hinglish explanation

Capacity sirf CPU percentage nahi. Task ko CPU, memory, port, architecture, AZ aur IP chahiye. EC2 placement fragment ho sakta hai; Fargate mein quota aur subnet IP limit hai. Scale delay aur AZ loss ko math mein jodo. DB bottleneck ke aage compute badhana queue ko shift karta hai.

## Capacity is a chain of constraints

For ECS on EC2, capacity is a vector, not one CPU percentage. A task needs a compatible instance type, remaining CPU and memory reservations, any required host port, supported architecture, and placement across Availability Zones. An instance may show idle CPU while no task fits because memory or a port is exhausted. Fragmentation leaves free resources that are not large enough in the required shape. Capacity providers connect ECS to an Auto Scaling group and can manage scaling from task demand, but host launch, bootstrap, agent registration, and image pull take time. Keep warm capacity based on measured launch delay and burst needs, not a universal percentage.

Fargate moves host selection and patching to AWS. The task still consumes service quota, subnet IP space, supported task sizes, and downstream capacity. A service can fail in one AZ when that subnet lacks addresses even if another subnet has room. Monitor free addresses and distribute tasks across zones. Yesterday’s successful placement does not prove quota or IP headroom during a synchronized scale event.

Capacity provider strategy affects which providers satisfy placement and how base/weight influence distribution. It does not create an EC2 host instantly. Correlate desired/running/pending tasks with ASG activity, provider scaling, instance state, and placement errors. If reactive scale-out is slower than the queueing budget, use a warm floor or admission control. Scaling compute past database capacity moves the queue rather than fixing it.

## Worked calculation: fit and AZ loss

Assume each EC2 host has 4 vCPU and 16 GiB; each task reserves 1 vCPU and 3 GiB. CPU suggests four tasks per host; memory permits five, so CPU binds at four before overhead and daemon tasks. Six hosts across three AZs yield at most 24 tasks. Losing one AZ leaves four hosts or 16 slots. If normal demand needs 18 tasks, the fleet is not N-1 capable even if pre-failure average CPU looked low. Recalculate with actual reservations, placement constraints, and deployment surge.

For Fargate, calculate with quota, IP addresses, supported sizes, and downstream budget. Cap autoscaling against the narrowest dependency; queue or shed work at that limit.

## Hinglish explanation

Capacity ek CPU number nahi. Task ko sahi CPU, memory, port, architecture, AZ aur IP chahiye. EC2 mein free CPU ke baad bhi memory/port placement rok sakte hain; Fargate mein quota aur subnet IP limit rehti hai. Scale-out mein launch aur pull time lagta hai. AZ loss aur deploy surge ke baad kitne tasks fit honge, calculate karo. DB limit ke baad compute badhaoge toh bottleneck bas aage shift hoga.
