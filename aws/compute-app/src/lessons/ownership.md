## Learning objectives

EC2, Elastic Beanstalk, Lambda, ECS/Fargate ke operations owners identify karo. “Managed” ko per-layer decision samjho. Lambda Event Functions, Managed Instances, durable functions, aur Fargate execution models ko separate explain karo. Incident mein responsibility boundary trace karo.

## Problem: managed ≠ no operations

“Serverless mein server nahi hote” wrong. Hardware hai; AWS kuch layers operate karta hai. Application code, IAM permissions, data policy, dependency behavior, observability, aur incident response team se disappear nahi hote. Architecture interview mein “AWS manages it” tabhi useful hai jab exact **it** name karo. [AWS Lambda shared responsibility guidance](https://docs.aws.amazon.com/lambda/latest/dg/runtime-management-shared.html) runtime updates ko deployment mode ke hisaab se split karti hai. [Compute decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html) management overhead ko explicit factor rakhta hai.

Ownership layers: data center, physical host, hypervisor, guest OS, language/runtime, dependencies, application code, identity/permissions, deployment, scaling policy, data backup, monitoring, incident playbook. EC2 mein AWS underlying infrastructure operate karta hai; guest OS, patches, app, security groups, workload scaling tum own karte ho. Elastic Beanstalk app environment provisioning/deployment automate karta hai, but underlying AWS resources account mein run hote hain aur app/data responsibility tumhari rehti hai. Lambda managed execution environment provide karta hai; code, IAM, configuration, and safe downstream behavior tum own karte ho. ECS with Fargate host fleet manage nahi karna padta; task definition, image, network, permissions, logs, scaling, aur rollout tum set karte ho.

| Layer | EC2 | ECS on Fargate | Lambda Event Function |
| --- | --- | --- | --- |
| Physical host | AWS | AWS | AWS |
| Guest OS/host fleet operations | Team | AWS-managed task platform | AWS-managed platform |
| Application runtime/dependencies | Team | Team packages image | Shared by runtime/deployment mode; team owns dependencies |
| Code, data, IAM, observability | Team | Team | Team |
| Admission/scaling configuration | Team | Team sets service/auto scaling | Team sets quotas, concurrency, triggers, retry behavior |

Table responsibility shorthand hai, compliance certification nahi. Exact patches, base image, runtime updates, and platform version rules current docs se verify karo. Container image ke application packages ko AWS automatically secure nahi karta.

## Internal operation: service models

EC2 IaaS-style virtual machine: AMI select, instance launch, guest OS boot, app services run, load balancer target becomes healthy. Tum launch template, Auto Scaling group, replacement, patch/AMI pipeline, logs, and rollback design karte ho. EC2 flexibility high, host operational burden high.

Elastic Beanstalk PaaS-style workflow mein application version/environment define karte ho; service underlying resources provision/configure karta hai. Current [Lightsail–Beanstalk–EC2 decision guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/lightsail-elastic-beanstalk-ec2.html) Beanstalk Standard EC2 mode aur Cluster/EKS mode describe karta hai. Beanstalk free *service charge* ka matlab underlying EC2/EKS/ELB/CloudWatch resources free nahi. Beanstalk use karke bhi deployment rollback, secrets, database lifecycle, and cost monitor karo.

Lambda Event Function event/invocation ke response mein code run karta hai; execution environment reuse possible hai, guaranteed nahi. Local memory/cache ko durable state mat samjho. Default timeout 3 seconds; standard Event Function timeout 1–900 seconds configure hota hai. [Timeout docs](https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html) note karti hain ki Lambda Managed Instances ke asynchronous aur supported event-source invocations 5,400 seconds tak ja sakte hain; synchronous aur kuch event sources 900-second boundary par rehte hain. [Managed Instances](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances.html) selected EC2 instance families par Event Functions run karta hai while Lambda instance lifecycle, OS/runtime patching, routing, load balancing, aur scaling policies manage karta hai. Ye all Lambda functions ka default nahi. [Durable functions](https://docs.aws.amazon.com/lambda/latest/dg/durable-invoking.html) workflow state aur waits manage karte hain; asynchronous durable execution up to one year span kar sakti hai, synchronous invocation 15 minutes. One-year workflow ko one-year continuous CPU execution mat samjho.

ECS/Fargate different model hai: containerized long-lived service ya task, CPU/memory allocation, network and IAM policy. Fargate host fleet operations reduce karta hai, but team service desired count, deployment policy, load balancer, secrets, image, and application health own karti hai. Lambda vs Fargate decision mein “serverless vs serverless” label se kuch decide nahi hota; execution shape, job duration, connection behavior, packaging, and cost assumptions dekho.

## Worked example 1: small API launch

Assume team of three, HTTP API 5 RPS average, 200 RPS 2-minute burst, 100–300 ms handler, no persistent process state, PostgreSQL downstream. Goal: ship in 3 weeks, p95 under 1 second. Lambda Event Function with API front door plausible because bursty short requests and minimal host work; but DB connections test critical. 200 × .3 = 60 concurrent average-duration estimate; DB safe connection capacity 40? Then cap/connection pooling or query refactor needed. A container on Fargate could reuse a bounded connection pool per replica, but that does not automatically fix expensive SQL. EC2 gives host control unnecessary under stated needs and adds patch/AMI work. Initial choice changes if persistent connection requirement, specialized runtime, or stable always-on utilization dominates. Document what was measured and what triggers reevaluation.

Ownership checklist: function code/version/team, runtime mode, dependency scanning, execution role, resource policy/API authorization, secret rotation, DB backup owner, logs/metrics owner, on-call alert, retry semantics. AWS platform can be healthy while app returns 500.

## Worked example 2: batch transform with state

Assume user upload triggers 25-minute video transform, custom `ffmpeg` build, 2 vCPU, 4 GiB memory, output in S3, 20 jobs/hour. Standard Lambda Event Function with 15-minute timeout cannot run a single 25-minute invocation. Lambda Managed Instances may permit eligible async invocations up to 90 minutes if service/regional/instance requirements fit, but cost/parallelism and packaging need evaluation. ECS/Fargate task started from queue is straightforward long-running container candidate; AWS Batch also candidate for finite jobs. Durable function suitable when process is multiple steps separated by waits, not automatically ideal for one continuous CPU transform. After worker writes S3 but before acknowledging message, retry may rerun job; use idempotent output key/status and cleanup policy. This is operations ownership even in managed compute.

## Practical lab: responsibility and timeout decision

Free paper/local exercise. Create `ownership.csv` with columns `layer,aws,team,evidence,runbook`. Fill one row per layer for EC2, Fargate, Lambda. For each row state action during incident. Example:

```text
layer: application dependency
AWS: provides platform boundary
team: pins library version, scans, tests, deploys fix
runbook: identify affected artifact; roll forward or back
```

Then classify ten jobs: 30-second request, 20-minute media transform, 3-day approval workflow, always-on streaming worker, scheduled 5-minute ETL. Identify invocation timeout and state requirement; do not assign service only from duration. For live AWS exploration, `aws lambda get-function-configuration --function-name NAME` reads config but requires credentials and may access billable account resources. Lab itself does not deploy or charge.

## Failure analysis: 500 after deploy

At 09:00 new Lambda version deployed. At 09:03 500 rate jumps to 30%; AWS Health no event. Logs show `AccessDeniedException` on `secretsmanager:GetSecretValue`; function duration unchanged; DB health normal. First mitigate with rollback of version/alias or restore least-privilege permission. Then compare execution role policy and secret ARN/environment changes. Check whether function role can read exact secret, whether KMS decrypt permission also needed, and whether secret endpoint/network path exists. Do not assume platform outage. Verify 500s return baseline after fix, then record test that catches missing permission before production.

Alternative incident: function duration and DB latency both rise after query change, IAM fine. Roll back query or bound traffic; AWS Lambda platform is performing correctly. “Managed” means host work delegated, not application diagnosis delegated. Runbook should specify evidence before escalating platform issue: error class, request IDs, service metrics, deployment timeline, and AWS Health when relevant.

## Alternatives and interview reasoning

Lightsail attractive for simple websites/bundled pricing but feature/integration constraints must be checked. Beanstalk offers managed app environment over underlying resources; EC2 gives direct host control; ECS/Fargate packages persistent container services without host fleet; Lambda serves invocation-driven code. No fixed ranking. Team size, operating experience, runtime support, configuration boundaries, latency, bill model, and future migration cost matter. AWS Well-Architected review asks whether teams understand operational priorities, workload health, failure response, cost, security, and reliability—not whether they used fashionable service names. [Review questions](https://docs.aws.amazon.com/wellarchitected/latest/framework/appendix.html).

Interview framing: for every candidate say “AWS operates X; team owns Y.” Then describe one deployment failure and one data failure. If interviewer changes constraint to custom kernel agent, move toward EC2. If changes to unpredictable 20-ms events, Lambda may fit. If long-running container service needed, Fargate/ECS may fit. Name the *decision trigger* rather than claiming architecture permanent.

## Lifecycle ownership in a real release

Assume team Lambda function ko container image se deploy karti hai. AWS-managed platform ke bawajood image ke Node/Python libraries, base-image updates, code dependency licenses, IAM role, and data policy team own karti hai. Release record mein source commit, image digest, config version, secret references, and rollback version save karo. Agar next day base image security advisory aaye, responsibility “AWS patch karega” kehna insufficient hai: check whether advisory customer-supplied image layer mein hai; rebuild, test, and publish new digest. [Lambda runtime shared-responsibility page](https://docs.aws.amazon.com/lambda/latest/dg/runtime-management-shared.html) deployment mode ke hisaab se runtime patch boundary detail karti hai. Operational runbook mein owner and proof of update record karo.

Service failure ko ownership diagram par locate karo. A function can be invoked successfully but fail IAM check; platform response healthy but API response 500. ECS task can run but wrong ALB path make target unhealthy. EC2 status checks pass but app process dead. Beanstalk environment can be healthy at infrastructure level while data migration breaks requests. Har case mein “AWS service up?” se pehle application signal, target signal, IAM/config, dependency, and platform signal ko separate dekho. This classification prevents both needless AWS escalation and blind application rollback.

More managed model se capacity policy responsibility bhi disappear nahi. Lambda reserved concurrency wrong value rakhoge toh good traffic throttle ho sakta hai; value unlimited chhodoge toh DB overload ho sakta hai. Fargate service min/max tasks aur metric policy tum configure karte ho; wrong health threshold restart loop bana sakta hai. Beanstalk environment settings and underlying resource bill tumhare account mein hain. EC2 ASG launch template stale ho toh unhealthy replacement repeatedly bad version launch karega. Interview mein owner table ko living runbook banao: layer, owner, evidence, escalation, rollback, cost tag. “Managed” ko one-dimensional score mat do.

## Exercises

1. 80 RPS × 0.25 s = ? **Check:** 20 concurrent average-duration estimate. If each opens one DB connection and DB safe limit 12, owning Lambda config alone does not protect DB. Propose bounded concurrency plus pooling/query change and measure user impact.
2. 25-minute job: list which timeout statement applies to standard Event Functions, eligible Managed Instances async functions, and durable workflows. **Check:** standard 15 minutes; eligible Managed Instances async/event source up to 90; durable async workflow up to one year, not equivalent to continuous worker duration.
3. Beanstalk environment has monthly bill while service line item is zero. **Check:** underlying EC2/EKS, ALB, logs, storage, data transfer charges still need owner.

## Video companion

[Building Modern Apps with AWS: Choosing the Approach that Works for You](https://www.youtube.com/watch?v=OJD3UMuU8Zk) ke verified English auto-captions serverless aur container operational models ko compare karte hain. Video dekhte waqt responsibility table fill karo: application, runtime, host, scaling, and deployment mein kaun kya own karta hai? Recording conceptual framing ke liye useful hai; latest Lambda duration models aur Beanstalk modes ke liye current AWS docs use karo. Auto-captions imperfect ho sakte hain.

## Quick reference

 serverless = management boundary, not absence of machines. Customer still owns code, IAM, data, dependencies, alerting. Lambda execution models have different duration limits. Beanstalk has modes; verify underlying resources. Fargate task image and security config remain yours. When incident occurs, locate failing layer before assigning owner.

**Evidence:** [compute guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html), [entry options](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/lightsail-elastic-beanstalk-ec2.html), [Lambda runtime responsibility](https://docs.aws.amazon.com/lambda/latest/dg/runtime-management-shared.html), [Lambda timeout](https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html), [Managed Instances](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances.html), [durable invocation](https://docs.aws.amazon.com/lambda/latest/dg/durable-invoking.html).
