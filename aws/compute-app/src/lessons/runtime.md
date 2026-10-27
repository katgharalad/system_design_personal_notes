## Learning objectives

VM, container image, running container, ECS task definition, ECS task, aur service ka difference explain karo. Guest OS aur Fargate task isolation ko accurately compare karo. Packaging, deployment, health, aur failure path trace karo.

## Problem and exact boundary

“Container = small VM” interview mein weak answer hai. VM virtual hardware par **guest OS** boot karta hai. Conventional Linux container process isolation aur resource controls use karta hai; same host ke containers usually host kernel share karte hain. Image immutable package layers aur metadata ka set hai; container us image se run hua process hai. [AWS compute guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html) aur [container guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-container-service.html) execution model aur management boundary ko service choice mein central rakhte hain.

Is general kernel statement ko Fargate tasks par directly apply mat karo. [AWS Fargate documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html) says each Fargate task has own isolation boundary and does **not** share underlying kernel, CPU, memory, or ENI with another task. Task ke andar multiple containers ho sakte hain; task isolation aur container process isolation different layers hain. Fargate ko “ordinary shared-host container” kehna incorrect hai. ECS on EC2 mein tum cluster instances own karte ho; task placement aur host hardening responsibility ka portion tumhare paas aata hai.

Hardware → hypervisor → guest OS → app is useful VM mental model. AWS Nitro instances mein Nitro System virtualization/offload functions provide karta hai; exact components instance family ke hisaab se differ karte hain. EC2 instance AMI, instance type, subnet, security group, IAM instance profile, EBS, aur user data ke saath launch hota hai. Guest OS boot, services start, aur health checks ke baad traffic receive karta hai. “EC2 instance running” ka matlab app healthy hona nahi.

Container path: source build → image layers → ECR registry → task definition revision → ECS scheduling → capacity allocation (EC2 ya Fargate) → image pull → process start → task/service health → load balancer target healthy → traffic. Task definition config blueprint hai; task running instantiation hai. ECS **service** desired task count aur deployments maintain karta hai. One-off task service ke bina bhi run ho sakta hai. Service restart app state recover nahi karta; local memory lost hogi.

## Internal operation: what actually starts

Local Docker build mein `Dockerfile` base image, files, user, command specify karta hai. Build output image ID hai. Image registry mein push karna deploy nahi. ECS task definition mein image URI/digest, CPU/memory, roles, environment/secrets, port mapping, log driver, aur network settings define karte ho. ECS service placement constraints aur capacity strategy ke saath task start request karta hai. Fargate task-level CPU/memory configurations allowed combinations se choose karne padte hain. Launch path mein registry authentication, image pull, network interface creation, IAM permissions, logging, process start—har stage fail ho sakta hai. ECS service events aur stopped reason stage identify karne mein help karte hain.

Health checks layered hain. Process `RUNNING` ho sakta hai, but application `/health` 500 de. ECS container health check aur ALB target-group health check separate signals hain; deployment settings decide karte hain kab target traffic lega aur unhealthy task replace hoga. Grace period warm-up ko protect kar sakta hai, lekin bad app ko forever mask nahi karna chahiye. Readiness route critical dependencies verify kare, par transient DB outage par every task simultaneously unhealthy mark karna dangerous ho sakta hai. Liveness aur readiness ko deliberate define karo.

## Worked example 1: API deployment

Assume Node API port 3000, 40 RPS steady, 300 RPS peak, stateless request handler, 512 MiB measured peak memory. Team wants repeatable rollout and no guest OS maintenance. ECS on Fargate plausible start hai. App image ECR mein push karo; task definition mein CPU/memory pair supported by Fargate, task execution role for image/logs/secrets, separate task role for app AWS API calls, `awslogs`, port 3000. Service desired count 2, subnets in two AZs, security group accepts port 3000 only from ALB security group. ALB listener forwards to target group, target health `/ready`. Image digest pin karo so rollback exact version par ho. Container logs CloudWatch mein aur service events inspect karo.

```text
Client → ALB (AZ A + AZ B) → ECS service
                              ├─ Fargate task A → database
                              └─ Fargate task B → database
ECR image → task definition revision → deployment → healthy targets
```

Assume measured safe 20 concurrent requests/task. 300 RPS × 0.20 seconds = 60 concurrent → three tasks baseline. Two task service peak insufficient. If one AZ fails and other AZ should handle peak, surviving AZ must host three safe tasks, plus rollout/headroom. IP availability, Fargate quota/capacity, launch time, and DB connections verify karo. Three tasks total across two AZs do **not** prove single-AZ failure capacity. For production set desired count and autoscaling policy from load test, not from image size.

## Worked example 2: custom host agent

Security team requires kernel-level network probe and a host agent with privileged access. Fargate tasks expose managed task environment, not arbitrary host control. EC2 launch path evaluate karo. Requirements list: exact kernel module, OS version, instance family, agent privilege, maintenance window. Build one isolated test instance, install agent, verify data collection and app compatibility. Choose ECS on EC2 if container packaging remains valuable; choose plain EC2 service if orchestrator adds no value. In both cases guest OS patching, AMI updates, node replacement, capacity, and security are team work. Alternative “Fargate is more secure” is not sufficient answer if required capability impossible.

## Practical local implementation

Free local exercise; no AWS billing. Existing starter files under **Local exercise files**. Run:

```bash
docker build -t lab-api:local .
docker run --rm -p 3000:3000 lab-api:local
curl -i http://127.0.0.1:3000/health
```

Build context must contain `Dockerfile` and `server.mjs`. `-p` maps local port 3000 to container port 3000; it does not create load balancing. Stop process, start another container, and observe in-memory counters reset. Then intentionally change app listening port without changing `docker run -p`; curl should fail. Check `docker logs` and `docker ps`, fix mapping. If Docker unavailable, read files and trace expected start sequence on paper.

Billable AWS deployment is separate: ECR repository, ECS cluster/service, Fargate tasks, ALB, CloudWatch logs, and networking can incur charges. Do not run cloud commands as part of free exercise. For configuration study, sketch task definition fields and security-group path; compare with [ECS task definition docs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html).

## Failure analysis: tasks start then stop

Incident: deployment revision 42 desired 4, running 0. ECS event says tasks stopped after start; ALB has zero healthy targets; CloudWatch app log empty. Debug in lifecycle order. `describe-services` events → `describe-tasks` stopped reason and container exit code → execution role permission → registry/image architecture → task network to ECR/logs → container command → app bind address/port → health check. If `CannotPullContainerError`, app code did not start: inspect ECR permission, image URI, network/NAT or VPC endpoints. If exit code 1 with stack trace, start command/config/secrets inspect. If task remains running but target unhealthy, check target port, security groups, health path, startup time, and listener routing. Fix the stage that evidence identifies; raising desired count repeats the failure.

Suppose tasks healthy only locally. Local machine had `DATABASE_URL`, ECS task lacks secret; app exits. Add secret reference with correct IAM permissions and network path. Deploy one revision, confirm logs, task count, target health, then increase traffic. Roll back to known digest if availability is impacted. Note: “task running” and “target healthy” are separate checks.

## Alternatives, interview reasoning, reference

VM gives guest OS control, familiar process model, specialized instance selection. Cost: image/OS patching, autoscaling, fleet health, rollout. Container packaging makes repeatable deploys; ECS service maintains desired tasks; Fargate removes instance fleet management while limiting host control. Lambda can accept a container *image package*, but execution remains event/function based; it is not the same as ECS persistent container service. Choose from runtime behavior, required privileges, control, team capacity, and failure recovery. [Fargate vs Lambda guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/fargate-or-lambda.html) is comparison starting point.

Interview answer sequence: define artifact and running unit → explain isolation → trace launch lifecycle → name who manages host → show health and failure path → decide under constraints. If interviewer asks “what if task dies?”, ECS service replaces task to maintain desired count, but user requests during replacement may fail if insufficient healthy targets; durable work needs idempotent retry or external state. If “what if image tag changes?”, digest pinning or immutable tags protect reproducibility.

## Deployment mechanics and recovery budget

Rolling deployment ko “new container start” tak mat simplify karo. ECS service desired count aur deployment configuration ke basis par old/new task overlap allow karta hai. For each revision ask: kitne old tasks still healthy hain? Kitne new tasks launch ho sakte hain? ALB target ko healthy mark hone mein kitna time? Agar image 2 GiB aur pull path slow hai, new tasks ka startup application boot se pehle delay ho sakta hai. Agar database migration old code ke saath incompatible hai, rollback image alone restore nahi karega. Deploy order: backward-compatible schema, new app, traffic validation, later cleanup. Bad revision ko stop/rollback karo, target health aur user error rate observe karo. Exact deployment knobs current [ECS service deployment documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html) se verify karo before production.

Container process ko graceful stop signal handle karna chahiye. Task shutdown par in-flight HTTP request drain, queue message acknowledgment, and connection close ka plan chahiye. Agar process signal ignore kare aur forced termination ho, in-flight work retry ya duplicate ho sakta hai. Isliye durable job ID, idempotent output, aur queue visibility timeout test karo. Local test mein process kill karke dekho state kahaan lost hoti hai. Runtime layer ko application correctness ka substitute mat samjho.

Security discussion mein isolation ke alawa permissions aur network bhi lao. Task execution role ECR pull and logs ke liye; task role application AWS API calls ke liye. Dono ko same broad role mat banao. Secrets image mein bake mat karo; runtime secret reference use karo, but boot-time secret fetch ke network/permission failure ka playbook likho. Fargate task isolation documented hai, phir bhi one task ke andar compromised app process apne granted role ke permissions misuse kar sakta hai. Image digest, vulnerability scans, non-root execution where supported, outbound restrictions, and least-privilege role reduce blast radius. Threat model “AWS manages host” par end nahi hota.

## Exercises

**Exercise:** 500 RPS, mean 0.1 s, measured safe 25 in-flight/task. Baseline count? **Check:** 50 concurrent; 2 tasks baseline, before AZ failure/rollout headroom. Next: one AZ fails; remaining AZ needs 2 safe tasks; test capacity and data path.

## Video companions

[Using Containers, Part 1: How to containerize anything](https://youtu.be/JpHlAV7P-Sw) ke verified English auto-captions Dockerfile build, image, ECR registry, aur non-root user ke practical flow ko show karte hain. Local starter run karne ke baad video mein package → registry → deployment distinction notice karo. [AWS re:Invent 2022: What's new and what's next with Amazon ECS](https://youtu.be/El64yANTmIA) ECS control plane, tasks, Fargate engine, aur deployment speed discuss karti hai. [Containers Office Hours: Developing a Container App with CDK](https://youtu.be/64DzoDM_kQc) SQS-backed worker aur ECS service ko demo mein jodti hai. Ye recordings older hain; current Fargate isolation, task definition fields, and quotas ke liye AWS docs authoritative hain. Auto-captions imperfect ho sakte hain.

## Quick reference

 image = package; container = running process; task definition = versioned configuration; task = running unit; service = desired count and deployment. Conventional containers often share a host kernel; Fargate tasks have separate documented isolation boundary. Task execution role lets ECS pull/log; task role grants app permissions. Check stopped reason before changing capacity. Health of process, task, target, and endpoint differ.

**Evidence:** [ECS task definitions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html), [Fargate task boundary](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html), [ECS capacity models](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/capacity-launch-type-comparison.html), [Nitro instances](https://docs.aws.amazon.com/ec2/latest/instancetypes/ec2-nitro-instances.html).

**Additional mechanism:** [SQS standard at-least-once delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html) explains why idempotent worker behavior matters. [ECS ARM task definition](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-arm-specifying.html) shows CPU architecture selection.
