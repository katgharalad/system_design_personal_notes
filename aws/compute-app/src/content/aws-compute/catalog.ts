import type { Lesson, UnitEntry, UnitId } from '../../content';
import { lessonText } from '../../lessonText';

type Chapter = { id: string; unit: UnitId; title: string; purpose: string; prerequisite: string; sources: string[] };
type Module = { unit: UnitId; title: string; status: string; chapters: Chapter[] };
type ChapterRow = [string, string, string, string, string[]];
const makeChapters = (unit: UnitId, rows: ChapterRow[]): Chapter[] => rows.map(([id,title,purpose,prerequisite,sources]) => ({id,unit,title,purpose,prerequisite,sources}));

export const modules: Module[] = [
  { unit: '03', title: 'Lambda and serverless', status: 'Draft · expanded lessons in progress', chapters: makeChapters('03', [
    ['lambda-invocation-models','Lambda invocation models and event contracts','Distinguish synchronous push, asynchronous push, and poll-based event source mappings; trace who owns delivery and retries.','Workload characterization',['lambda-invocation-methods','lambda-event-architecture','lambda-event-source-mapping']],
    ['lambda-concurrency','Lambda concurrency, quotas, and scaling','Calculate concurrency and RPS limits; distinguish account quota, function scaling rate, reserved concurrency, and provisioned concurrency.','Lambda execution lifecycle',['lambda-concurrency','lambda-scaling-behavior']],
    ['lambda-networking','Lambda networking and VPC access','Trace ENIs, subnet routing, security groups, DNS, egress, and database paths; diagnose why VPC attachment changes reachability.','VPC architecture',['lambda-vpc-config','vpc-user-guide','vpc-endpoints']],
    ['lambda-configuration','Lambda configuration, runtimes, memory, timeout, and ephemeral storage','Choose memory, CPU, timeout, environment, architecture, and /tmp settings from measured behavior and supported runtime lifecycle.','Lambda execution lifecycle',['lambda-timeout','lambda-env-config','lambda-execution']],
    ['lambda-security','Lambda identity, permissions, secrets, and isolation','Separate execution role, resource policy, caller identity, KMS, secret retrieval, and least-privilege boundaries.','AWS IAM roles',['lambda-execution-role','lambda-resource-policy','lambda-responsibility']],
    ['lambda-retries-integrations','Lambda integrations, retries, idempotency, and event source mappings','Model duplicates, batch failure, visibility timeout, retry owner, partial batch response, DLQ, and replay for common triggers.','Invocation models',['lambda-event-source-mapping','lambda-sqs-config','lambda-sqs-errors','lambda-retry-behavior','sqs-at-least-once']],
    ['lambda-observability-deploy','Lambda observability, versions, aliases, and safe deployment','Correlate logs, metrics, traces, init duration, errors, throttles, and deployment versions; route traffic through aliases with rollback checks.','Lambda configuration',['lambda-monitoring','lambda-versions','lambda-aliases','lambda-deployment']],
    ['lambda-durable-models','Lambda durable workflows and compute boundaries','Distinguish per-invocation timeout from durable execution timeout and compare Event Functions, durable functions, Managed Instances, Fargate, and Step Functions by lifecycle.','Retries and integrations',['lambda-durable','lambda-durable-concepts','lambda-durable-config','lambda-fargate','lambda-managed']]
  ]) },
  { unit: '02', title: 'EC2 deep dive', status: 'Draft · content built; technical review pending', chapters: makeChapters('02', [
    ['ec2-model','EC2 architecture and the virtual machine model','Trace the instance boundary, Nitro, control plane, and guest responsibilities.','Compute fundamentals',['compute','nitro','ec2-instance-lifecycle']],
    ['ec2-instance-choice','Instance families and resource selection','Choose CPU, memory, GPU, storage, and network capacity from measured workload shape.','EC2 architecture',['ec2-instance-types','compute']],
    ['ec2-boot','AMIs, boot sequence, and user data','Build repeatable instance launch and explain what happens between RunInstances and readiness.','EC2 architecture',['ec2-ami','ec2-userdata','ec2-launch-template']],
    ['ec2-ebs','EBS, instance store, and persistence','Choose block storage and reason about snapshots, durability, throughput, and recovery.','EC2 boot sequence',['ebs-volumes','ebs-snapshots','ec2-instance-lifecycle']],
    ['ec2-network','EC2 networking, ENIs, addresses, and security groups','Follow packets to an instance and diagnose path or policy failures.','VPC and subnets',['vpc-subnets','ec2-security-groups','ec2-networking']],
    ['ec2-operations','SSH, Linux operations, deployment, and security','Operate a Linux host with least privilege, patching, diagnostics, and safe deploys.','EC2 boot sequence',['ec2-ssm','ec2-userdata','wellarchitected-review']],
    ['ec2-alb','Application Load Balancers and health checks','Trace listener, rule, target registration, health, and request routing.','EC2 networking',['alb-health','ec2-alb']],
    ['ec2-asg','Auto Scaling Groups and scaling policies','Design desired capacity, launch templates, warmup, policies, and lifecycle.','EC2 instance choice',['ec2-asg','asg-target','asg-health','asg-warmup']],
    ['ec2-ha','Availability Zones and failure recovery','Prove N-1 capacity and distinguish instance, AZ, and Region recovery.','Auto Scaling Groups',['ec2-regions','ec2-asg','wellarchitected-review']],
    ['ec2-troubleshooting','EC2 production troubleshooting and performance','Use evidence to isolate CPU, memory, storage, network, launch, and health failures.','EC2 operations',['ec2-troubleshoot','ec2-cloudwatch','alb-health']]
  ]) },
  { unit: '04', title: 'Containers and orchestration', status: 'Draft · content built; technical review pending', chapters: makeChapters('04', [
    ['container-isolation','Containers, VMs, and isolation','Explain process isolation, namespaces, cgroups, images, and task boundaries.','EC2 architecture',['containers','fargate-isolation']],
    ['container-images','Images, layers, and Dockerfiles','Build small reproducible images and reason about cache, provenance, and supply chain.','Containers and isolation',['ecr-user-guide','containers']],
    ['container-local','Container lifecycle and local execution','Run, inspect, stop, signal, and debug a containerized service.','Docker images',['containers']],
    ['container-storage','Container networking and persistence','Trace bridge/awsvpc networking and separate ephemeral filesystems from durable data.','Container lifecycle',['ecs-task-networking','fargate-isolation']],
    ['container-ecr','ECR image distribution','Publish immutable artifacts and control pull permissions and replication.','Docker images',['ecr-user-guide','ecs-task']],
    ['ecs-fundamentals','ECS clusters, tasks, task definitions, and services','Map ECS control objects to running tasks and desired-state reconciliation.','ECR image distribution',['ecs-task','ecs-services']],
    ['ecs-capacity','ECS on EC2 and Fargate','Select capacity model and understand placement, isolation, and host ownership.','ECS fundamentals',['ecs-capacity','fargate-isolation']],
    ['ecs-networking','ECS networking and load balancing','Connect task ENIs, security groups, target groups, and service discovery.','ECS capacity',['ecs-task-networking','ec2-alb']],
    ['ecs-deploy','Health, scaling, and safe deployments','Design health checks, rollout limits, circuit breaker rollback, and autoscaling.','ECS networking',['ecs-deployments','ecs-scaling']],
    ['kubernetes-core','Kubernetes fundamentals','Explain API objects, reconciliation, scheduling, probes, and resource requests.','Container orchestration',['eks-kubernetes','eks-architecture']],
    ['eks-production','EKS architecture and deployment','Trace EKS control plane, nodes, CNI, IAM, add-ons, upgrades, and workload rollout.','Kubernetes fundamentals',['eks-architecture','eks-compute','eks-pod-identity']],
    ['ecs-eks-decision','ECS and EKS decision framework','Choose a platform from workload needs, team skills, ecosystem, and operating cost.','ECS fundamentals; EKS architecture',['containers','eks-architecture','wellarchitected-review']]
  ]) },
  { unit: '05', title: 'AWS compute comparisons', status: 'Draft · content built; technical review pending', chapters: makeChapters('05', [
    ['compare-lambda-ec2','Lambda or EC2','Compare event execution with virtual machines under latency, scale, and control constraints.','Workload characterization',['compute','lambda-execution','ec2-instance-lifecycle']],
    ['compare-lambda-fargate','Lambda or Fargate','Choose between function invocation and continuously running container tasks.','Lambda and ECS fundamentals',['lambda-fargate','lambda-durable','ecs-capacity']],
    ['compare-ecs-eks','ECS or EKS','Compare orchestration surface, portability, ecosystem, and team operating load.','Container orchestration',['containers','ecs-services','eks-architecture']],
    ['compare-ecs-capacity','ECS on EC2 or Fargate','Reason about host control, capacity efficiency, placement, isolation, and cost.','ECS capacity models',['ecs-capacity','fargate-isolation']],
    ['compare-container-vm','Container or VM','Select packaging and isolation model from OS, hardware, density, and security needs.','Runtime models',['compute','nitro','fargate-isolation']],
    ['compare-beanstalk','EC2 or Elastic Beanstalk','Separate deployment platform automation from the compute beneath it.','EC2 operations',['entry-options','compute']],
    ['compare-entry-options','Lightsail, Beanstalk, or EC2','Choose a control boundary for a small web application as requirements evolve.','EC2 and deployment models',['entry-options','compute']],
    ['compare-apprunner','App Runner or ECS','Compare simplified web deployment with a configurable container service.','ECS fundamentals',['containers','ecs-services','apprunner-guide','apprunner-availability','ecs-express-mode']],
    ['compare-batch-workers','AWS Batch or persistent workers','Match finite queued jobs and scheduling requirements to always-on consumers.','Queue and worker patterns',['compute','batch-user-guide','sqs-at-least-once']],
    ['compare-kubernetes-serverless','Kubernetes or serverless','Account for platform ownership, workload fit, and organizational cost.','EKS and Lambda',['modern-apps','lambda-fargate','eks-architecture','serverless-guide']],
    ['compare-scaling','EC2 Auto Scaling or Lambda scaling','Compare instance capacity planning with per-request concurrency and quotas.','EC2 and Lambda scaling',['asg-target','lambda-concurrency']],
    ['compare-managed-control','Managed services or infrastructure control','Set an explicit ownership boundary and a decision trigger.','Service responsibility',['compute','wellarchitected-review']]
  ]) },
  { unit: '06', title: 'Modern application architecture', status: 'Draft · content built; technical review pending', chapters: makeChapters('06', [
    ['arch-monolith','Monolith architecture','Trace a deployable unit and reason about coupling, release, and scaling.','Compute fundamentals',['modern-apps','wellarchitected-review']],
    ['arch-modular','Modular monoliths and service boundaries','Define boundaries around invariants and ownership before splitting processes.','Monolith architecture',['modern-apps','wellarchitected-review']],
    ['arch-microservices','Microservices and independent ownership','Evaluate independent deployment against distributed-systems costs.','Modular monoliths',['modern-apps','wellarchitected-review']],
    ['arch-sync-async','Synchronous and asynchronous communication','Choose request/response or message handoff based on latency and failure semantics.','Service boundaries',['sqs-at-least-once','modern-apps']],
    ['arch-events','Event-driven architecture','Design event contracts, delivery, idempotency, ordering, and replay.','Async communication',['sqs-at-least-once','eventbridge-user-guide']],
    ['arch-serverless','Serverless application architecture','Compose API, functions, queues, workflow, data, and observability.','Event-driven architecture',['modern-apps','lambda-execution','apigateway-user-guide']],
    ['arch-containers','Container application architecture','Build a reliable container service around tasks, health, networking, and deployment.','ECS fundamentals',['ecs-services','ecs-capacity']],
    ['arch-kubernetes-platform','Kubernetes as an organizational platform','Test whether a platform team and workload estate justify Kubernetes.','EKS architecture',['eks-architecture','modern-apps']],
    ['arch-modernization','Application modernization and migration','Move incrementally with strangler routing, data ownership, and rollback.','Service boundaries',['modern-apps','wellarchitected-review']],
    ['arch-complexity','Operational complexity and tradeoffs','Make cognitive load, failure surface, and ownership visible in design reviews.','Modernization',['modern-apps','wellarchitected-review']]
  ]) },
  { unit: '07', title: 'Compute economics', status: 'Draft · content built; price inputs illustrative', chapters: makeChapters('07', [
    ['cost-foundations','AWS compute billing foundations','Separate meters, usage dimensions, commitments, and shared costs.','Workload characterization',['purchasing','cost-explorer']],
    ['cost-ondemand','EC2 On-Demand pricing','Model runtime, attached resources, data transfer, and regional assumptions.','Billing foundations',['purchasing','ec2-pricing']],
    ['cost-ri','Reserved Instances','Explain billing discount scope and distinguish it from capacity reservation.','On-Demand pricing',['purchasing','ec2-reserved-instances']],
    ['cost-savings-plans','Savings Plans','Compare commitment flexibility and utilization risk.','Reserved Instances',['purchasing','savings-plans']],
    ['cost-spot','Spot interruption economics','Evaluate interruptible capacity with checkpointing and diversification.','On-Demand pricing',['purchasing','spot-interruptions']],
    ['cost-capacity','Capacity Reservations and assurance','Separate capacity assurance from price discounts and reason about idle reservation cost.','Purchasing models',['ec2-capacity-reservations','purchasing']],
    ['cost-rightsize','Right-sizing compute','Use utilization distributions, bottleneck evidence, and safety margin.','Cost measurement',['compute-optimizer','ec2-instance-types']],
    ['cost-utilization','Utilization and scaling economics','Connect idle headroom, scale policy, queue delay, and availability.','Right-sizing',['purchasing','asg-target','ecs-scaling']],
    ['cost-service-choice','Lambda, EC2, and Fargate cost comparison','Compare equal useful work with all material noncompute costs exposed.','Service comparison',['purchasing','lambda-fargate','ecs-capacity']],
    ['cost-case-study','Worked monthly workload cost model','Run sensitivity analysis with labeled example inputs and explicit exclusions.','Cost foundations',['purchasing','ec2-pricing','lambda-pricing','fargate-pricing']]
  ]) },
  { unit: '08', title: 'Supporting infrastructure', status: 'Draft · content built; technical review pending', chapters: makeChapters('08', [
    ['infra-vpc','VPC architecture','Trace address space, subnets, route tables, and service attachments.','Regions and AZs',['vpc-user-guide','vpc-subnets']],
    ['infra-routing','Subnets, routing, gateways, NAT, and endpoints','Diagnose egress and private service access hop by hop.','VPC architecture',['vpc-route-tables','vpc-nat-gateway','vpc-endpoints']],
    ['infra-network-security','Security groups and network paths','Model stateful packet filtering and least-open network paths.','VPC routing',['ec2-security-groups','vpc-security']],
    ['infra-iam','IAM roles and least privilege','Trace principal, policy evaluation, resource policy, and session credentials.','AWS identity basics',['iam-roles','iam-policy-evaluation']],
    ['infra-api','API Gateway integration patterns','Compare proxy, direct integration, auth, throttling, mapping, and timeouts.','Lambda architecture',['apigateway-user-guide','lambda-execution']],
    ['infra-messaging','SQS, SNS, and event-driven communication','Design delivery, visibility, retries, DLQs, fanout, and idempotency.','Async architecture',['sqs-at-least-once','sqs-visibility','sns-user-guide']],
    ['infra-s3','S3 object storage and compute integration','Use object keys, policies, event notifications, lifecycle, and consistency correctly.','IAM roles',['s3-user-guide','s3-event-notifications']],
    ['infra-database','RDS, PostgreSQL, and connection management','Control connection demand, transaction boundaries, pooling, and recovery.','VPC and IAM',['rds-user-guide','rds-proxy','rds-pinning']],
    ['infra-observability','CloudWatch, logs, metrics, and tracing','Correlate symptoms across request, compute, queue, and database.','Production operations',['cloudwatch-user-guide','xray-user-guide']],
    ['infra-iac','Infrastructure as code and deployment integration','Review change plans, immutable rollout, drift, rollback, and secret boundaries.','Production deployment',['cloudformation-user-guide','cdk-user-guide','wellarchitected-review']]
  ]) },
  { unit: '09', title: 'Hybrid and specialized workloads', status: 'Draft · content built; technical review pending', chapters: makeChapters('09', [
    ['special-batch','AWS Batch architecture','Map job queue, scheduler, compute environment, and job attempt.','Queues and workers',['batch-user-guide','compute']],
    ['special-scheduling','Batch scheduling and compute environments','Choose queue priority, fair share, capacity, and retry boundaries.','AWS Batch architecture',['batch-compute-environments','batch-user-guide']],
    ['special-gpu','GPU and accelerated computing','Match accelerator software, memory, topology, and data pipeline.','Instance selection',['ec2-instance-types','eks-ml']],
    ['special-ml','Training and inference compute','Separate throughput-oriented training from latency-sensitive serving.','Accelerated compute',['sagemaker-training','sagemaker-inference','eks-ml']],
    ['special-outposts','AWS Outposts','Evaluate local infrastructure with AWS-managed control-plane integration.','Hybrid placement',['outposts-user-guide','compute']],
    ['special-edge-zones','Local Zones and Wavelength','Place latency-sensitive components near users while keeping dependencies feasible.','Regions and AZs',['local-zones','wavelength-user-guide']],
    ['special-ecs-anywhere','ECS Anywhere and hybrid containers','Operate external instances as ECS capacity and account for connectivity and host ownership.','ECS fundamentals',['ecs-anywhere','compute']],
    ['special-placement','Workload placement and data residency','Turn legal and physical constraints into verifiable placement controls.','Hybrid foundations',['wellarchitected-review','outposts-user-guide']],
    ['special-economics','Specialized infrastructure economics','Compare utilization, reservation, data movement, and operational scarcity.','Compute economics',['purchasing','ec2-instance-types']]
  ]) },
  { unit: '10', title: 'Architecture defense', status: 'Draft · case interviews authored; review pending', chapters: makeChapters('10', [
    ['case-small-web','Case 1 · Small production web application','Design a small backend and defend the simplest acceptable production shape.','Units 02–08',['wellarchitected-review','entry-options','compute']],
    ['case-bursty-api','Case 2 · Bursty REST API','Choose compute and scale safely under 100× traffic change.','Units 02–08',['lambda-concurrency','asg-target','ecs-scaling']],
    ['case-background','Case 3 · Reliable background processing','Handle retries, duplicates, poison messages, and long jobs.','Units 04, 08, 09',['sqs-at-least-once','sqs-visibility','batch-user-guide']],
    ['case-high-traffic','Case 4 · High-traffic application','Defend request routing, scale, database budget, and overload controls.','Units 02, 05, 08',['alb-health','rds-proxy','wellarchitected-review']],
    ['case-container-prod','Case 5 · Containerized production deployment','Choose ECS/EKS, EC2/Fargate, rollout, and operational ownership.','Units 04, 05',['containers','ecs-services','eks-architecture']],
    ['case-regional','Case 6 · Regional resilience','Set RTO/RPO and design AZ and Region recovery with testable failure paths.','Units 02, 08',['ec2-regions','wellarchitected-review']],
    ['case-cost','Case 7 · Cost-constrained architecture','Reduce spend while preserving explicit service objectives.','Unit 07',['purchasing','cost-explorer']],
    ['case-ai-inference','Case 8 · AI inference service','Place model serving by latency, accelerator, scaling, and data constraints.','Unit 09',['sagemaker-inference','eks-ml','compute']],
    ['case-opef-inspired','Case 9 · OPEF-inspired backend (hypothetical)','Defend a backend using the stated hypothetical stack without assuming private implementation details.','Units 05–09',['apigateway-user-guide','sqs-at-least-once','rds-user-guide','wellarchitected-review']],
    ['case-redesign','Case 10 · Architecture under changing constraints','Redesign from observed bottlenecks and changed SLOs, not from fashion.','Units 02–09',['wellarchitected-review','modern-apps','purchasing']]
  ]) }
];

export const expandedUnits: UnitEntry[] = modules.map(m => [m.unit,m.title,m.status]);
const headings = (text: string) => {
  const result: Record<string,string> = {};
  let active: string | null = null;
  for (const line of text.split('\n')) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      active = heading[1].trim().toLowerCase();
      result[active] = '';
    } else if (active) {
      result[active] += `${line}\n`;
    }
  }
  return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,value.trim()]));
};
const section = (h: Record<string,string>, ...names: string[]) => names.flatMap(n => {
  const key = n.toLowerCase();
  const match = Object.keys(h).find(candidate => candidate === key || candidate.startsWith(`${key}:`) || candidate.startsWith(`${key} ·`));
  return match ? [h[match]] : [];
}).find(Boolean) ?? '';
const codeBlock = (text: string) => text.match(/```[^\n]*\n([\s\S]*?)```/)?.[1]?.trim() ?? '';
export const expandedLessons: Lesson[] = modules.flatMap(module => module.chapters.map(chapter => {
  const text = lessonText[chapter.id] ?? '';
  const h = headings(text);
  const checks = section(h,'Exercise checks').split('\n').map(s=>s.replace(/^\s*[-*]\s*(?:\[[ x]\]\s*)?/, '').trim()).filter(Boolean);
  return {
    id:chapter.id, unit:chapter.unit, title:chapter.title, purpose:chapter.purpose, prerequisite:chapter.prerequisite, sources:chapter.sources,
    problem:section(h,'Problem'), definition:section(h,'Definition and terminology','Definition'), intuition:section(h,'Mental model','Intuition'),
    internals:section(h,'Internal operation'), lifecycle:section(h,'Execution lifecycle','Request lifecycle'),
    implementation:section(h,'Configuration lab','Worked example','Worked example and calculation'), code:codeBlock(text),
    alternatives:section(h,'Alternatives and decision boundary','Alternatives'), tradeoffs:section(h,'Tradeoffs'),
    failure:section(h,'Failure analysis','Failure modes'), debugging:section(h,'Debugging procedure'), production:section(h,'Production checklist'),
    exercise:section(h,'Practical exercise','Exercise','Debugging and exercise','Interactive exercise','Practical interview sequence'), exerciseCheck:checks, quick:section(h,'Quick reference').split('\n').map(s=>s.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean)
  };
}));
