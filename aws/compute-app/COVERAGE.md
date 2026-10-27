# AWS Compute content QA report

Checked 2026-10-27. **Unit 1 status: Draft. Unit 3 Lambda lifecycle: Draft.** The module is usable for study; it has not passed a full manual technical review or completed the ten-unit curriculum. This report describes authored material, not a certification of production architecture.

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

Mechanisms were checked against official [Fargate isolation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html), [Lambda timeout](https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html), [Managed Instances](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances-best-practices.html), [durable invocation](https://docs.aws.amazon.com/lambda/latest/dg/durable-invoking.html), [RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html), [pinning](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html), [ASG target tracking](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html), [ASG health](https://docs.aws.amazon.com/autoscaling/ec2/userguide/health-checks-overview.html), [ALB target health](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html), [Region/AZ definitions](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html), [VPC subnets](https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html), [SQS at-least-once delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html), and [Well-Architected review questions](https://docs.aws.amazon.com/wellarchitected/latest/framework/appendix.html). The source map has 29 direct AWS pages, guide heading maps, and discovered guide links; not every discovered link was reviewed.

Eight YouTube links were extracted from the decision guides. `yt-dlp` listed English automatic captions for all eight. Five English VTT caption tracks were fetched and checked for study points; three caption downloads returned HTTP 429. The Source map records title, exact status, and a short original takeaway for each reviewed video. Relevant lessons link the five reviewed videos as historical companions. Current AWS docs remain technical authority. No full copyrighted transcript or invented caption content is stored in the repository.

## Phase B — checks and limits

`npm test`: 16 tests pass across source-backed content structure, question/source IDs, follow-up graph, numeric examples, local persistence, architecture, and decision simulator. `npm run build`: TypeScript and Vite build pass; static output is in `aws/compute/`. Content gate checks chapter sections, obvious placeholders, balanced code fences, source-link domains, 50 Unit 1 questions plus four Lambda questions, complete answer/rubric fields, lesson coverage, valid source and follow-up IDs, and Draft status. Word count is diagnostic, not proof of quality. Manual spot-checks corrected the four identified AWS claims. The source registry verifies direct page availability, but link existence alone does not validate every claim.

Remaining gaps: Unit 3 has one draft Lambda chapter; Units 2 and 4–10 remain Planned. 371 questions remain to reach the 425 target. EC2, broader Lambda, ECS/Fargate, economics, infrastructure, hybrid, and full architecture-defense chapters need textbook treatment. Some advanced Unit 1 answers are under 150 words and may need further expansion after interview trials. AWS configuration examples are not deployed or validated in a live account; local exercises are free and cloud steps are labeled billable. Full semantic answer assessment, AI interviewer, and three verified YouTube caption downloads are absent. The content has not undergone independent subject-matter review, so Unit 1 remains **Draft**.

## Verify locally

From `aws/compute-app/`: `npm ci`, `npm test`, `npm run build`. From repository root: `python3 -m http.server 4173`; open `/aws/compute/`. Building regenerates static deployable files. No commit or push performed for this overhaul.

## Phase C — visual Lambda first deliverable

One 43-second Manim Community scene (`lambda-execution-lifecycle-v1`) shows a standard on-demand Event Function: new environment Init, first Invoke, possible warm reuse, overlapping requests needing a second environment, and possible database connection growth, and eventual Shutdown. The storyboard records objectives, assumptions, direct AWS sources, chapters, checkpoints, and a Roman Hinglish explanation. MP4, WebM, poster PNG, and WebVTT are in the public assets and static build. The player has play/pause, speed, captions, chapter seeking and lesson links. Four prediction checkpoints gate playback. A separate React slider lab estimates concurrency, admission under a chosen cap, and potential database connection demand. Four linked interview questions progress from mechanism to capacity defense. No additional scene is claimed complete.

The AWS lifecycle and concurrency pages were reviewed against the scene. It explicitly excludes Lambda Managed Instances and Web Functions, does not imply warm reuse is guaranteed, and treats timeline width as conceptual. A database lane represents possible connection demand, not query timing. No AWS account was used. See `animations/README.md` for pinned tools, render cache, and reproducible commands.
