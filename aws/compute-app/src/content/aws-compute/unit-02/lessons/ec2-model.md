# EC2 architecture and the virtual machine model

EC2 ko managed VM service ke roop mein padho. AWS physical fleet, control plane, aur Nitro infrastructure operate karta hai; tum guest OS, instance configuration, app, identity, data, patch policy, aur recovery design own karte ho. Goal hai request se healthy process tak ka exact path samajhna.

**Prerequisite:** Compute fundamentals. **Sources:** [EC2 compute guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html), [Nitro System](https://docs.aws.amazon.com/ec2/latest/instancetypes/ec2-nitro-instances.html), [instance lifecycle](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html).

## Learning objectives

- Instance, AMI, instance type, EBS volume, ENI, key pair, and security group ko distinguish karo.
- Launch, boot, health, stop, start, reboot, hibernate, and terminate ke implications trace karo.
- AWS-managed boundary aur guest-OS responsibility interview mein clearly state karo.

## Problem

“I launched an EC2 instance” production readiness ka proof nahi. Instance `running` ho sakta hai jabki cloud-init failed, app process stopped, target group unhealthy, disk full, ya database unreachable ho. Har layer ka separate state and evidence hota hai. Interview mein candidate ko control-plane state ko application readiness samajhne ki galti nahi karni chahiye.

## Definition and terminology

An **instance** is a virtual server with a selected CPU/memory/network/storage profile. An **AMI** provides the bootable root image and launch metadata. An **EBS volume** is network-attached block storage with a lifecycle independent of one host when configured to persist. An **ENI** is a virtual network interface with private addresses and security groups. A **launch template** records reusable launch parameters. A **security group** is a stateful network filter attached to an interface or resource.

EC2 instance state is a control-plane state. `pending` means launch is in progress; `running` means the virtual machine is running; `stopping`/`stopped` apply to EBS-backed instances; `shutting-down`/`terminated` describe removal. OS boot and application health happen inside those states. Stop/start normally moves an EBS-backed instance to new underlying host hardware and can change its public IPv4 address; instance-store contents do not survive stop. Reboot generally retains the host placement and attached EBS data. Termination behavior for the root EBS volume depends on its delete-on-termination setting.

## Mental model

Treat launch as a dependency graph, not a button: select subnet and IP plan → attach ENI and security groups → attach boot and data volumes → start guest firmware/kernel → run OS services and user data → start application → pass target health check. Each arrow can fail independently. “EC2 health check green” does not establish that `/health/ready` can reach PostgreSQL.

## Internal operation

The EC2 API asks the regional control plane to allocate a compatible host and materialize the requested instance shape. Nitro offloads networking, storage, and management functions from the host CPU, while Nitro Hypervisor isolates supported instances. Guest Linux still schedules processes, mounts filesystems, applies firewall rules, and serves the app. EBS I/O travels through the virtual storage path; ENI traffic follows VPC routing and security policy. AWS manages physical fleet firmware and facilities; your account controls instance launch policy and guest configuration. Exact features differ by instance family, virtualization generation, and Region, so choose from the current type matrix rather than assumptions.

## Execution lifecycle

1. `RunInstances` evaluates AMI, type, subnet, IAM instance profile, storage mapping, and network permissions.
2. EC2 allocates capacity; the instance enters `pending`.
3. The guest boots. Cloud-init or EC2 user data may run, depending on image configuration and launch settings.
4. OS services and application start. This stage needs logs and an app readiness signal.
5. Load balancer target health determines whether normal traffic can reach the instance.
6. Stop/reboot/replace/terminate changes different state and persistence boundaries; verify each before automation.

## Worked example 1 — identify state loss

A web process stores uploaded files in `/var/app/uploads` on the root EBS volume. An Auto Scaling group replaces an unhealthy instance. The replacement starts from the AMI and does not contain the old instance’s new local files. EBS persistence attached to one replaced instance does not imply the replacement will mount that same volume. Move durable user objects to S3 or a designed shared file system; keep the VM disposable. Test replacement while a request writes a file.

## Worked example 2 — boot and health timing

Suppose a host takes 40 s to boot, user data takes 70 s, app warm-up takes 25 s, and the load balancer needs two successful checks 10 s apart. Earliest expected registration is about 145 s plus health-check scheduling. A 60 s health-check grace period can be too short. Measure p50/p95 launch-to-ready time; set health grace and deployment timeout from observed startup, not from EC2 `running` time.

## Configuration lab

```bash
aws ec2 describe-instances \
  --instance-ids i-0123456789abcdef0 \
  --query 'Reservations[].Instances[].{State:State.Name,AZ:Placement.AvailabilityZone,Type:InstanceType,Subnet:SubnetId,PrivateIP:PrivateIpAddress}'
aws ec2 describe-instance-status --instance-ids i-0123456789abcdef0 --include-all-instances
```

First command shows control-plane placement; second reports system and instance status checks. Neither replaces application logs or target health. Never put long-lived secrets in user data: launch metadata may be visible to principals allowed to inspect it. Fetch scoped secrets at runtime through an instance role and a secrets service.

## Alternatives and decision boundary

Use EC2 when host/OS control, specialized instance shapes, persistent processes, or existing VM operations matter. ECS/Fargate can run containers without host management; Lambda fits event-shaped work with its execution constraints; Batch adds job queueing/scheduling. A VM is not automatically more reliable: reliability depends on replacement, state, AZ placement, health checks, and tested recovery.

## Tradeoffs

Control allows custom agents, kernel settings, and predictable long-lived process behavior. It adds guest patching, AMI lifecycle, capacity planning, SSH/SSM access controls, scaling policy, and host-level incident work. Fleet automation reduces per-host toil but creates launch-template, rollout, and bootstrap dependencies.

## Failure analysis

- `running`, app down: check systemd/container process, cloud-init output, app logs, and listener bind address.
- Instance status check fails: inspect system reachability, kernel panic, exhausted memory, or platform event.
- System status check fails: correlate EC2 status and AWS Health before changing guest configuration.
- App works locally but target unhealthy: verify port, path, host header, target type, SG path, and response code.
- Stop/start loses data: determine whether data lived on instance store, root disk with delete-on-termination, or attached volume.

## Debugging procedure

Build one UTC timeline with EC2 state transitions, status checks, serial console or SSM output, cloud-init logs, app logs, target health, and deployment events. Change one layer at a time. Before terminating a host, snapshot or export evidence according to incident policy. Verify replacement host AMI version, subnet, IAM role, security-group rules, and launch-template version against a known-good instance.

## Production checklist

- Pin a reviewed AMI and version launch templates; roll updates through an ASG rather than pets.
- Use SSM Session Manager where possible; scope instance role and operator access.
- Keep durable state outside disposable host storage.
- Separate system, instance, application, and load-balancer health signals.
- Define patch windows, rollback, backup tests, and replacement drills.

## Practical exercise

Draw the launch dependency graph for an internet-facing Node API. Mark which principal can call each API, which data persists after replacement, and which health signal gates traffic. Then force a host replacement and prove user data survives.

## Exercise checks

- `running` is not equivalent to application readiness.
- Replacing a host does not migrate arbitrary local files into the new instance.
- User data is bootstrap input, not a secret store or a reliable config-management system by itself.

## Quick reference

- AMI = boot image; type = resource shape; instance = running VM.
- EBS and instance store have different persistence/lifecycle semantics.
- ENI, VPC route tables, and SGs define different parts of packet reachability.
- Verify service readiness with app-level evidence.

## Deepened mechanism: Nitro, guest responsibility, and where “the server” ends

### Worked example 3 — host failure versus guest failure

A fleet has 40 instances. One instance fails the EC2 system status check, while its application health endpoint still appears successful from a stale dashboard. A second instance passes both EC2 checks but returns HTTP 500. These are different layers. A system check concerns AWS host/network infrastructure; an instance check observes guest reachability and boot/network state; an ALB health check runs an application-level probe. Do not infer customer health from one signal. Configure Auto Scaling health checks to include ELB when target health should drive replacement, then verify replacement does not erase unsaved local state.

Nitro uses dedicated hardware and a lightweight hypervisor to provide virtualized CPU, memory, networking and storage paths. This changes the implementation of virtualization, but does not mean the guest OS is managed for you. You still patch the guest, configure its firewall and users, protect credentials, monitor its filesystems and recover its application. AWS owns the physical host and service control plane. A bare-metal instance changes guest access to hardware features, but remains an AWS-managed physical host with instance lifecycle and service boundaries.

### Incident trace — instance starts, service never becomes healthy

Start with EC2 state transitions and system/instance status checks. Then inspect console output and serial console where supported; check cloud-init logs, systemd unit state, disk capacity, DNS, route and security-group path. Confirm the process binds to the expected interface and port. Compare target registration and health-check reason codes. Record launch-template version, AMI ID, user-data digest and deployment time. A successful `running` state proves the hypervisor launched a VM, not that your service is ready. Make readiness a real application contract and prevent the ALB from sending requests until the target is healthy.

### Interview defense

If the interviewer asks why EC2 rather than Fargate, connect a concrete requirement—kernel module, host agent, device access, operating-system customization—to the control boundary. Then accept the cost: patching, capacity planning, host monitoring and replacement. If the requirement is only “we need containers,” that alone does not prove EC2 is required.

### Roman Hinglish explanation

VM ko ek box samjho, lekin teen layers yaad rakho: AWS physical host aur control plane chalata hai; guest OS tumhari team manage karti hai; app ki readiness bhi tumhari responsibility hai. Nitro VM ko hardware-backed isolation deta hai, par Linux patch, IAM, service config aur recovery automatically nahi karta. EC2 ka `running` status sirf itna batata hai ki instance lifecycle start hua. App healthy hai ya nahi, ALB health check aur application telemetry se pata chalega. Interview mein har requirement ko layer se map karo: host control chahiye to EC2 ka reason do; sirf packaging chahiye to container ka reason EC2-specific nahi hai.

### Direct AWS references for these mechanisms

- [EC2 instance status checks](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/monitoring-system-instance-status-check.html) — system, instance, attached EBS, and application health boundaries.
- [EC2 instance lifecycle](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html) — instance state transitions and stop/start behavior.
