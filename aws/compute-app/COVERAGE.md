# AWS Compute content QA report

Checked 2026-10-27. **All units remain Draft.** The module is usable for study; it has not passed a full manual technical review or completed the ten-unit curriculum. This report describes authored material, not a certification of production architecture.

## Current expansion audit

The original inventory discrepancy is resolved: **89 existing chapters**, not 83. The earlier 83 counted expanded chapters but omitted the five base Unit 1 chapters and the base Lambda lifecycle chapter. Unit counts are U1 5, U2 10, U3 1, U4 12, U5 12, U6 10, U7 10, U8 10, U9 9, U10 10. Eight new Lambda chapters expand the curriculum to **97 total chapters** (91 expanded-module chapters plus six base chapters). Current authored files: **53/97**; outline-only: **44/97**. Authored breakdown: U1 5/5, U2 10/10, U3 9/9, U4 12/12, U5 12/12, U6 1/10, U7 1/10, U8 1/10, U9 1/9, U10 1/10. “Authored” means a text file exists and passes basic structural checks; it does not mean the unit is complete or reviewed.

Question allocation is U1 50, U2 55, U3 60, U4 55, U5 45, U6 30, U7 35, U8 35, U9 20, U10 40: **425 total**. Unit 2 has 55 individually authored EC2 scenarios. Unit 3 has L01–L60: four preserved questions plus 56 individually authored Lambda scenarios. Unit 4 has 12 individually authored scenarios; 248 records across U4–U10 remain template-generated and are not individually authored or validated. Questions in this project are original interview-style practice; they are not represented as questions reported from actual company interviews.

Current code offers editable, locally saved exercise answers and configuration, a self-review checklist, and a synthetic-rate compute cost calculator. The checklist does not grade meaning. Four Manim animations are rendered: Lambda lifecycle, SQS redelivery, EC2 Auto Scaling, and ECS task reconciliation. Tests validate chapter IDs/counts, source and follow-up references, basic authored text presence, and declared animation asset existence; they do not prove chapter depth or technical completeness.

## Live coverage matrix

“Authored” is a structural count. “Reviewed” means source/lesson spot-check in this batch, not external subject-matter approval. Exercise count is the number of authored lessons with a practical task; local response entry and self-review are available, but they do not provide semantic grading.

| Unit | Lessons authored | Reviewed | Questions | Manim rendered | Exercises | Status |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| 1 · Compute fundamentals | 5/5 | Prior source/content QA | 50 | 0 | 5 | Draft; needs integration review |
| 2 · EC2 deep dive | 10/10 | AWS source spot-check; 55 questions individually authored | 55 | 1 | 10 | Draft; full technical/editorial review remains |
| 3 · Lambda and serverless | 9/9 | AWS source spot-check; 56 new questions individually authored | 60 | 2 | 9 | Draft; full technical/editorial review remains |
| 4 · Containers and orchestration | 12/12 | AWS docs spot-check; content deepening; 12 authored scenarios | 55 (12 authored, 43 templated) | 1 | 12 | Draft; needs full chapter depth, code/config examples, more authored questions, and technical review |
| 5 · Compute comparisons | 12/12 | Not reviewed in this batch | 45, templated | 0 | 12 | Draft; questions need individual authorship |
| 6 · Modern application architecture | 1/10 | Not reviewed in this batch | 30, templated | 0 | 1 | Draft; 9 outline-only lessons |
| 7 · Compute economics | 1/10 | Not reviewed in this batch | 35, templated | 0 | 1 | Draft; 9 outline-only lessons |
| 8 · Supporting infrastructure | 1/10 | Not reviewed in this batch | 35, templated | 0 | 1 | Draft; 9 outline-only lessons |
| 9 · Hybrid and specialized workloads | 1/9 | Not reviewed in this batch | 20, templated | 0 | 1 | Draft; 8 outline-only lessons |
| 10 · Architecture defense | 1/10 | Not reviewed in this batch | 40, templated | 0 | 1 | Draft; 9 outline-only lessons |

## Phase A — Unit 1 implementation

| Lesson | Chapter words (`wc -w`, includes code and URLs) | Worked examples | Practical work | Interview questions |
| --- | ---: | ---: | --- | ---: |
| Workload characterization | 2,160 | 2 | Local Python capacity worksheet, three calculations | 10 |
| VM and container runtime | 1,928 | 2 | Local Docker starter, deployment/failure trace | 10 |
| Operational ownership | 1,894 | 2 | Responsibility table and execution-model classification | 10 |
| State, scale, and failure | 1,839 | 2 | Local queue simulation, N-1 capacity calculations | 10 |
| Regions and AZs | 1,827 | 2 | Local topology audit, RTO/RPO and failure drills | 10 |
| **Total** | **9,648** | **10** | **Five practical activities** | **50** |

Each chapter now has objectives, problem, mechanism, two worked examples, a failure analysis, alternatives, practical work, exercises with checks, a quick reference, and direct AWS documentation links. Learn view renders full chapter. Reference view combines definitions, quick notes, failure and diagnostic cues, and configuration worksheet. Original lesson IDs remain stable for saved study records.

Technical corrections: conventional container kernel sharing is distinguished from AWS Fargate task isolation; AZ fault isolation is stated as within a Region; standard Lambda Event Function, eligible Lambda Managed Instances, and durable function duration models are separate; RDS Proxy pooling, transaction multiplexing, pinning, and SQL limits are explained and cited. Lambda/DB scenario uses distinct concurrency and database capacity budgets.

## Interview bank and flow

50 distinct Unit 1 questions, ten per lesson. Stable IDs C01–C15 preserved. Every record has unit/topic, concepts, level 1–5, assessment type, scenario, assumptions, English model answer, Roman Hinglish explanation, three-point rubric, misconceptions, two linked follow-up IDs, source IDs, prerequisites, and revision lesson. Answer length: 73–246 words; eleven complex answers are 150+ words. Hinglish explanations are at least 43 words. Distribution:

| Assessment type | Count |
| --- | ---: |
| Fundamental understanding | 5 |
| Explain internals | 5 |
| Code and configuration | 7 |
| Numerical engineering | 8 |
| Architecture and service choice | 13 |
| Production debugging | 6 |
| Progressive interviewer pressure | 6 |

Scenarios include Lambda/PostgreSQL overload; RDS Proxy pinning; queue backlog; Lambda duration models; ECS image/health failures; ARM image mismatch; at-least-once worker retry; ASG replacement; scale-out causing DB exhaustion; ALB all-unhealthy behavior; AZ loss; RTO/RPO; multi-Region data rules. Question paths change constraints and link back to study notes. Interview bank still supports single-question self-score. New mock interviewer supports 5- and 10-question topic drills and 10/20/40-question Unit 1 sessions. It collects English answers, reveals model/rubric, asks learner to check covered criteria, follows a curated diagnostic/harder question edge, and saves missed criteria and summary locally. It makes **no semantic or AI grading claim**.

## Source evidence

Six decision guides remain indexed as curriculum outline. The chapters materially use the [compute guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html), [container guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-container-service.html), [Fargate/Lambda guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/fargate-or-lambda.html), and [Lightsail/Beanstalk/EC2 guide](https://docs.aws.amazon.com/decision-guides/latest/decision-guides/lightsail-elastic-beanstalk-ec2.html). The modern-app and purchasing guides are indexed for later units, not claimed as deeply integrated into Unit 1.

Mechanisms were checked against official [Fargate isolation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html), [ECS task health](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/healthcheck.html), [ECS deployment circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html), [ECS storage](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_data_volumes.html), [Fargate ephemeral storage](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-storage.html), [EKS architecture](https://docs.aws.amazon.com/eks/latest/userguide/eks-architecture.html), [EKS networking](https://docs.aws.amazon.com/eks/latest/userguide/eks-networking.html), [EKS Pod Identity](https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html), [Lambda timeout](https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html), [Managed Instances](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances-best-practices.html), [durable invocation](https://docs.aws.amazon.com/lambda/latest/dg/durable-invoking.html), [RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html), [pinning](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html), [ASG target tracking](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html), [ASG health](https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html), [ALB target health](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html), [Region/AZ definitions](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html), [VPC subnets](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html), [SQS at-least-once delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html), and [Well-Architected review questions](https://docs.aws.amazon.com/wellarchitected/latest/framework/appendix.html). The source map has 29 direct AWS pages, guide heading maps, and discovered guide links; not every discovered link was reviewed. Unit 4 additions received documentation spot-checks, not independent expert approval.

Eight YouTube links were extracted from the decision guides. `yt-dlp` listed English automatic captions for all eight. Five English VTT caption tracks were fetched and checked for study points; three caption downloads returned HTTP 429. The Source map records title, exact status, and a short original takeaway for each reviewed video. Relevant lessons link the five reviewed videos as historical companions. Current AWS docs remain technical authority. No full copyrighted transcript or invented caption content is stored in the repository.

## Phase B — checks and limits

Current validation: `npm test` passes 23 tests and `npm run build` passes against the expanded 97-chapter, 425-question inventory. The production build warns that the main JavaScript chunk is larger than 500 kB after minification. Word count is diagnostic, not proof of quality. Source references are direct AWS docs, but a link alone does not validate every claim.

Remaining gaps: Unit 2 now has expanded notes, 55 individually authored scenarios and one rendered animation; Unit 3 has nine authored chapters, its 60-question allocation and two rendered animations. Both units still need full technical/editorial review and more visual explanations. Unit 4 has added mechanisms, 12 individually authored questions, and one rendered animation; 43 questions remain generated and all 12 chapters need much more textbook depth, multiple worked examples, and further technical review. The remaining template-generated questions across Units 4–10 need individual replacement or editorial authorship. Units 5–10 need deeper content; many chapters remain outlines. AWS examples are not deployed or validated in a live account; cloud steps must remain labeled billable. Full semantic answer assessment and three verified YouTube caption downloads remain absent. No unit has independent subject-matter approval. **Do not mark any unit complete.**

## Verify locally

From `aws/compute-app/`: `npm ci`, `npm test`, `npm run build`. From repository root: `python3 -m http.server 4173`; open `/aws/compute/`. Building regenerates static deployable files. No commit or push performed for this overhaul.

## Phase C — visual Lambda first deliverable

Four rendered Manim scenes are integrated: Lambda lifecycle (43 seconds), SQS redelivery (20 seconds), EC2 Auto Scaling (25 seconds), and ECS task reconciliation (16 seconds). The ECS scene distinguishes placement, image pull, `RUNNING`, and ALB health; shows replacement with unchanged failing inputs; and links to Unit 4 lessons and interview questions. Each scene has Python source, storyboard, assumptions, Hinglish explanation, AWS references, chapters, prediction checkpoints, MP4/WebM/poster/WebVTT, and lesson links. The player has play/pause, speed, captions, chapter seeking and lesson links. The Lambda lifecycle player has a separate React concurrency lab. The other prioritized scenes remain unbuilt.

The AWS lifecycle and concurrency pages were reviewed against the scene. It explicitly excludes Lambda Managed Instances and Web Functions, does not imply warm reuse is guaranteed, and treats timeline width as conceptual. A database lane represents possible connection demand, not query timing. No AWS account was used. See `animations/README.md` for pinned tools, render cache, and reproducible commands.
