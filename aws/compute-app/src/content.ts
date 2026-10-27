export type UnitId = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10';
export type UnitEntry = readonly [UnitId, string, string];
export type Lesson = {
  id: string;
  unit?: UnitId;
  title: string;
  purpose: string;
  prerequisite: string;
  sources: string[];
  problem: string;
  definition: string;
  intuition: string;
  internals: string;
  lifecycle: string;
  implementation: string;
  code: string;
  alternatives: string;
  tradeoffs: string;
  failure: string;
  debugging: string;
  production: string;
  exercise: string;
  exerciseCheck: string[];
  quick: string[];
};

const baseUnits: UnitEntry[] = [
  ['01', 'Compute fundamentals', 'Draft: five expanded chapters; review in progress'],
  ['02', 'EC2 deep dive', 'Planned'],
  ['03', 'Serverless and Lambda', 'Draft: Lambda lifecycle lesson and visual lab'],
  ['04', 'Containers and orchestration', 'Planned'],
  ['05', 'AWS compute comparisons', 'Planned'],
  ['06', 'Modern application architecture', 'Planned'],
  ['07', 'Compute economics', 'Planned'],
  ['08', 'Supporting infrastructure', 'Planned'],
  ['09', 'Hybrid and specialized workloads', 'Planned'],
  ['10', 'Architecture defense', 'Planned'],
];
const expandedUnitById = new Map(expandedUnits.map(unit=>[unit[0],unit]));
export const units: UnitEntry[] = baseUnits.map(unit=>expandedUnitById.get(unit[0])??unit);

export const lessons: Lesson[] = [
  {
    id: 'workload', title: 'Start with the workload', purpose: 'Describe the work before choosing a service.', prerequisite: 'None', sources: ['compute', 'wellarchitected-workload', 'lambda-fargate', 'lambda-timeout', 'lambda-concurrency', 'rds-proxy', 'rds-pinning', 'wellarchitected-review'],
    problem: 'Team ko jaldi service name chahiye, lekin service name se design start karne par wrong constraints miss ho sakte hain. Ek API request, video render, aur nightly data job ka runtime pattern alag hai. Pehle work ko measure karo; phir service choose karo.',
    definition: 'Compute CPU, memory, aur execution time provide karta hai. Storage data ko execution ke baad bhi rakhta hai. Networking request aur data ko components ke beech move karti hai. **Workload** in resources, people, process, aur reliability needs ka complete set hai.',
    intuition: 'Suppose property-screening API par kabhi 10 requests/second aur kabhi 2,000 requests/second aati hain. Average traffic dekhkar server size decide mat karo. Peak arrival, per-request duration, memory, downstream database capacity, aur acceptable delay likho. Agar API 100 ms mein answer de par database 200 connections hi le sakta hai, compute scale karna alone problem solve nahi karega.',
    internals: 'Request ko execution slot chahiye. Approximate in-flight work = arrival rate × average service time. 100 requests/second × 0.2 second ≈ 20 concurrent requests. Ye Little’s Law ka simple planning estimate hai, guarantee nahi. Queue, retries, connection pools, aur burst profile actual demand badal sakte hain. CPU-bound work ko CPU capacity chahiye; memory-bound work ko memory; I/O wait ko concurrency aur downstream limits.',
    lifecycle: '1. User request ya scheduled event arrives.\n2. Network layer route karta hai.\n3. Compute runtime work accept karta hai ya queue/throttle hota hai.\n4. Runtime storage/database ko call karta hai.\n5. Response ya job result record hota hai.\n6. Metrics se next capacity decision hota hai.',
    implementation: 'Neeche worksheet ko real measurements se fill karo. Peak aur sustained values alag rakho. Requirements mein owner, data residency, failure target, aur budget bhi include karo. Service decision document mein unknowns ko explicit likho.',
    code: `workload: property-screening-api\narrival: 100 rps sustained; 2000 rps burst\navg_runtime: 220 ms\npeak_in_flight_estimate: 2000 * 0.22 = 440\nmemory_per_execution: measure in load test\nlatency_target: p95 < 800 ms\nstate: request stateless; results stored in database\ndownstream_limit: PostgreSQL max useful connections = measure\nrecovery_target: define with product owner\nunknowns: burst length, retry rate, regional requirements`,
    alternatives: 'EC2, Lambda, ECS/Fargate, Batch, aur managed platforms sab compute dete hain, but execution model aur operational responsibility different hai. Short event work Lambda fit ho sakta hai; continuously running service ke liye container ya VM evaluate karo; finite batch work ke liye Batch.',
    tradeoffs: 'Short-lived burst mein idle servers cost badha sakte hain; continuously busy work mein per-invocation model ki economics alag ho sakti hai. More control usually more OS, scaling, deployment, aur patch ownership laata hai. Price calculation region-specific rates aur measured utilization se karo.',
    failure: 'Average-only capacity plan peak par throttle karega. Retries load amplify kar sakte hain. Database max connections, API quotas, aur network egress compute se pehle fail ho sakte hain.',
    debugging: 'CloudWatch aur application metrics mein arrival rate, p95/p99 latency, error rate, concurrency, queue age, CPU, memory, aur downstream saturation compare karo. Deployment time aur traffic spike ko timeline par align karo. Ek metric se conclusion mat nikalo.',
    production: 'Authentication, least-privilege IAM, multi-AZ availability, rollback, tracing, cost alerts, aur data lifecycle ko requirement sheet mein include karo. Capacity test mein failure aur retry traffic bhi simulate karo.',
    exercise: 'Ek image-processing API ke liye 50 rps average, 500 rps 5-minute burst, aur 3-second processing time diya hai. In-flight estimate nikalo. Phir three unknowns likho jo service choice badal sakte hain.',
    exerciseCheck: ['Burst in-flight estimate ≈ 1,500, before retries.', 'CPU/memory per request, acceptable queue delay, and downstream limits are plausible unknowns.', 'A service recommendation must state its assumptions.'],
    quick: ['Start with traffic, duration, state, latency, failure, and team constraints.', 'In-flight work ≈ arrival rate × service time.', 'Measure downstream capacity before scaling compute.', 'No service is the default answer for every workload.']
  },
  {
    id: 'runtime', title: 'Physical server, VM, and container', purpose: 'Know what is isolated and what you manage.', prerequisite: 'Start with the workload', sources: ['compute', 'containers', 'nitro', 'ecs-task', 'fargate-isolation', 'ecs-capacity', 'sqs-at-least-once', 'ecs-arm'],
    problem: '“Container is a small VM” bolne se isolation aur ownership dono confuse hote hain. Interview mein runtime boundary explain karna zaroori hai, kyunki security, startup, scaling, aur debugging isi par depend karte hain.',
    definition: 'Physical server hardware hai. VM apna guest OS run karta hai aur hypervisor hardware resources partition karta hai. Conventional Linux containers commonly share a host kernel; Fargate tasks have separate AWS-documented isolation boundaries. Image packaged filesystem aur metadata hai; running container us image se started process hai.',
    intuition: 'Ek host ko apartment building samjho: hypervisor independent guest OS ko CPU/memory deta hai. Conventional container process ko isolated view deta hai; Fargate tasks separately isolated hote hain. Ye analogy sirf isolation boundary ke liye hai; real security kernel, runtime, permissions, aur configuration par depend karti hai.',
    internals: 'EC2 Nitro-based instances lightweight Nitro Hypervisor aur hardware offload use karte hain. VM guest OS boot karta hai. Container runtime image layers read karta hai, process start karta hai, aur namespaces/cgroups jaise OS mechanisms se isolation/resource controls deta hai. ECS task definition image, CPU, memory, network, logging, aur role declare karti hai. ECS service desired task count maintain karti hai.',
    lifecycle: 'VM path: instance type/AMI choose → network attach → guest OS boot → app start → health check. Container path: code build → image push to ECR → ECS task definition revision → task starts on EC2/Fargate capacity → health check → service replaces unhealthy task.',
    implementation: 'Local container build ka point reproducible package banana hai. Neeche tiny Dockerfile run karo; container stop karne par process stop hota hai. Is lesson ke neeche server.mjs aur Dockerfile download karo. Durable data ko external storage mein rakho. Production image pin karo aur vulnerability scan karo.',
    code: `# Dockerfile\nFROM node:22-alpine\nWORKDIR /app\nCOPY server.mjs ./\nUSER node\nEXPOSE 3000\nCMD ["node", "server.mjs"]\n\n# local checks\ndocker build -t lab-api:local .\ndocker run --rm -p 3000:3000 lab-api:local\n# test: curl http://127.0.0.1:3000/health`,
    alternatives: 'VM choose karo jab custom OS configuration, specialized instance, ya host control required ho. Container choose karo jab packaged app, repeatable deploy, aur orchestrated replicas useful hon. Lambda ZIP ya container image dono package forms support karta hai, lekin uska execution model container service jaisa nahi hai.',
    tradeoffs: 'VM stronger guest OS boundary aur broad host control deta hai, but OS patching tumhari responsibility hoti hai. Container startup aur packaging efficient ho sakte hain, but ECS on EC2 aur Fargate task isolation boundaries alag samajhni padti hain. ECS/Fargate host management reduce karta hai; ECS/EC2 more host control deta hai.',
    failure: 'Image works locally but fails in ECS because port, architecture, IAM, secret, or network config different hai. Container process crash hone par service replace karegi, lekin in-memory state lost hoga. VM boot par user data fail ho sakta hai.',
    debugging: 'ECS stopped reason, task events, container exit code, logs, health check, security group, aur ECR pull permissions check karo. EC2 par system logs, user data output, CPU/memory, network path, aur OS service status check karo.',
    production: 'Minimal image, non-root process, immutable image tag/digest, image scanning, secret management, resource limits, centralized logs, and controlled rollout use karo. Host isolation ko application authorization ka replacement mat samjho.',
    exercise: 'Ek team ke paas Linux daemon hai jo custom kernel feature use karta hai. Kya Fargate, EC2 VM, ya Lambda se start karoge? Requirement ke against choose karo aur one test propose karo.',
    exerciseCheck: ['EC2 VM is a defensible starting point for host/kernel control.', 'Fargate/Lambda fit depends on specific supported runtime and required capability.', 'Test the kernel feature in the target instance type before committing.'],
    quick: ['VM has a guest OS; conventional containers commonly share a host kernel; Fargate tasks have separate isolation.', 'Image is package; container is a running process.', 'ECS task definition is a blueprint; task is a running copy.', 'Host control and operational effort move together.']
  },
  {
    id: 'ownership', title: 'Managed, IaaS, PaaS, serverless', purpose: 'Track who owns each operational layer.', prerequisite: 'Physical server, VM, and container', sources: ['compute', 'entry-options', 'modern-apps', 'lambda-fargate', 'lambda-execution', 'lambda-durable', 'lambda-managed', 'lambda-timeout', 'lambda-responsibility'],
    problem: '“Serverless means no servers” wrong hai. Servers exist; management boundary shift hoti hai. Architecture decision mein team ko clear hona chahiye ki OS, runtime, deployment, scaling, aur code ka owner kaun hai.',
    definition: 'IaaS mein EC2 jaisi infrastructure capacity milti hai aur guest OS/app tum manage karte ho. PaaS-style platform, jaise Elastic Beanstalk, deployment aur environment operations automate karta hai. Serverless, jaise ordinary Lambda ya Fargate, host provisioning reduce karta hai; app code, permissions, data, aur behavior tumhari responsibility rehti hai.',
    intuition: 'Agar team ko patching aur capacity planning ke liye time nahi hai, managed path attractive hai. But agar custom agent, special host setting, ya precise instance control chahiye, EC2/managed-instance option better fit ho sakta hai. “Managed” ka matlab zero ops nahi; tumhe deploy, observe, secure, aur debug karna hi hai.',
    internals: 'Lambda event receive karke execution environment prepare karta hai, runtime handler call karta hai, aur reuse possible hota hai. Fargate ECS/EKS containers ke liye managed compute capacity deta hai. ECS control plane tasks schedule karta hai. Elastic Beanstalk underlying resources provision karta hai; current AWS guide Standard EC2 aur Cluster/EKS mode describe karta hai. Service-specific boundaries current docs se verify karo.',
    lifecycle: 'Requirement → service model choose → IAM/network/deploy define → platform capacity start karta hai → application runs → health/telemetry collect → incident mein service events aur app logs dono inspect. Managed layer kuch tasks leta hai, lekin application lifecycle team own karti hai.',
    implementation: 'Ownership table likho. Ek deployment ke liye har layer ka responsible owner mark karo: physical host, hypervisor, guest OS, runtime, app code, IAM, data backup, alerts. Security review aur runbook isi table se start ho sakte hain.',
    code: `layer                  EC2               Lambda\nphysical host          AWS               AWS\nhypervisor             AWS               AWS\nguest OS patching       your team         AWS platform\nfunction/app code       your team         your team\nIAM permissions         your team         your team\ndata and access policy  your team         your team\nalerts and runbooks     your team         your team`,
    alternatives: 'Lightsail simpler bundled path de sakta hai. EC2 widest VM control deta hai. Elastic Beanstalk application platform operations simplify karta hai. Lambda event handler fit karta hai. ECS/Fargate persistent container services ke liye useful hai. Product boundary ko marketing category se infer mat karo.',
    tradeoffs: 'Managed service infrastructure work reduce karta hai, but available runtime options, invocation model, and configuration boundaries constrain kar sakte hain. EC2 flexibility deta hai, par patch, replacement, autoscaling, aur host security workload badhata hai.',
    failure: 'Shared responsibility unclear ho to team IAM policy, app library patch, backup, ya alert ka owner assign nahi karti. Platform automatic scale kare, phir bhi database bottleneck ya bad code fix nahi hota.',
    debugging: 'Issue ko boundary se classify karo: application error, IAM denial, network path, service quota, platform event, ya downstream saturation. AWS Health/service status aur CloudWatch logs/metrics check karo, phir app trace correlate karo.',
    production: 'Runbook mein ownership table, escalation, deployment rollback, secret rotation, patch policy, IAM review, and quota monitoring rakho. Cost owner bhi assign karo; managed services charge remove nahi karte.',
    exercise: 'Ek small team ko bursty image metadata API launch karni hai. EC2, Lambda, aur ECS/Fargate ke ownership rows banao. Assumptions likhkar initial option defend karo.',
    exerciseCheck: ['The choice names traffic and runtime assumptions.', 'Ownership covers IAM, code, data, and monitoring even for managed compute.', 'A trigger to revisit the decision is stated.'],
    quick: ['Serverless shifts server work; it does not erase infrastructure.', 'Application security and data remain your responsibility.', 'Use ownership tables when comparing options.', 'Managed is a spectrum, not a single service property.']
  },
  {
    id: 'scale', title: 'State, scale, and failure', purpose: 'Scale work without losing data or moving bottlenecks.', prerequisite: 'Start with the workload', sources: ['compute', 'lambda-fargate', 'ecs-capacity', 'ecs-task', 'asg-target', 'asg-health', 'alb-health', 'ecs-scaling', 'rds-proxy'],
    problem: 'App replicas badhana easy lagta hai, lekin session state local RAM mein ho to next request wrong replica par ja sakti hai. Scaling design state location, capacity limit, aur failure recovery se linked hai.',
    definition: 'Stateless process request ke liye required durable state external system se leta hai. Stateful workload state ko local process/volume ke saath coordinate karta hai. Vertical scaling ek worker ko larger capacity deta hai. Horizontal scaling replicas add karta hai. Autoscaling metric ke basis par desired capacity adjust karta hai.',
    intuition: 'Do web servers behind load balancer imagine karo. Agar user session server A ki RAM mein hai aur next request B par gayi, login lost lagega. Session ko shared store ya signed token mein move karne se frontend replicas easier scale karte hain. Database phir stateful bottleneck ban sakta hai; use separately design karo.',
    internals: 'ALB requests distribute karta hai. ECS service desired count maintain karti hai; EC2 Auto Scaling group instances replace/add kar sakta hai; Lambda demand par concurrency increase karta hai within quotas and scaling behavior. Scaling speed, health checks, warm-up, and downstream capacity matter. Queue consumers backlog drain karte hain, but high arrival rate backlog increase kar sakti hai.',
    lifecycle: 'Traffic grows → metric crosses target → capacity request issued → instance/task/environment ready → health check passes → traffic shifts → downstream sees more calls. Failure path: worker fails → health check detects → routing stops → replacement starts → retried work must be safe.',
    implementation: 'Capacity worksheet: desired concurrency aur per-worker safe concurrency measure karo. Then replicas = ceil(desired / safe per worker), plus failure headroom. Load test mein one replica kill karo aur p95, error rate, recovery time record karo.',
    code: `burst_rps = 500\navg_service_seconds = 0.30\nin_flight_estimate = 150\nsafe_in_flight_per_replica = 25  # measured, not guessed\nbase_replicas = ceil(150 / 25) = 6\n# add failure headroom and test downstream capacity`,
    alternatives: 'Vertical resize simplest ho sakta hai jab app shared-memory architecture par hai. Horizontal replicas availability aur burst capacity improve kar sakte hain. Queue asynchronous work ko absorb kar sakti hai. Data layer ke liye read replicas, cache, sharding, ya schema/query optimization context ke hisaab se evaluate karo.',
    tradeoffs: 'More replicas ke saath connection counts, duplicate retries, coordination, aur deployment complexity badh sakte hain. Vertical scaling hardware ceiling tak limited hai. Queue latency accept karni padti hai. Spot capacity cheap ho sakti hai but interruption handling required hai.',
    failure: 'Scale-out downstream DB exhaust kare; retry storm service ko aur overload kare; health check too shallow ho to broken replica healthy dikhe; too aggressive ho to restart loop bane.',
    debugging: 'Timeline par desired/running capacity, launch failures, target health, queue age, p95, 5xx, DB connections, and throttles dekhna. Event logs se pata karo scale request actually fulfilled hui ya quota/capacity issue aaya.',
    production: 'Idempotency keys, timeouts, backoff with jitter, queue dead-letter handling, connection pooling, graceful shutdown, multi-AZ placement, and capacity limits design mein include karo.',
    exercise: '1200 rps burst, 250 ms average service time, 30 safe concurrent requests per replica: initial replica count calculate karo. Ek AZ fail hone par remaining capacity ke liye kya plan karoge?',
    exerciseCheck: ['In-flight estimate = 300.', 'At least 10 replicas are needed before failure headroom.', 'Multi-AZ placement and spare capacity are addressed.'],
    quick: ['Stateless process keeps durable state outside the worker.', 'Scale compute and downstream systems together.', 'Horizontal scale requires health and replacement paths.', 'Retries and duplicate work must be safe.']
  },
  {
    id: 'placement', title: 'Regions and Availability Zones', purpose: 'Place capacity to meet latency, availability, and data rules.', prerequisite: 'State, scale, and failure', sources: ['compute', 'ec2-regions', 'vpc-subnets', 'alb-health', 'wellarchitected-review'],
    problem: 'Ek instance ek AZ mein hai. Agar woh AZ unavailable ho, single-instance app bhi unavailable ho sakti hai. Region aur AZ selection ko user latency, fault tolerance, regulatory requirements, aur service availability se connect karo.',
    definition: 'Region separate geographic area hai. Availability Zone us Region ka isolated location group hai. VPC Region ke AZs tak span kar sakta hai; ek subnet exactly one AZ mein hota hai. EC2 instance specific AZ mein launch hota hai.',
    intuition: 'Two AZ design mein each AZ mein app capacity rakho. Load balancer healthy targets ko route karega. Agar ek AZ fails, doosre AZ ko surviving traffic handle karna hoga. Sirf “multi-AZ” checkbox se enough capacity guarantee nahi milti.',
    internals: 'AWS Regions isolated hain; resources automatically cross-Region replicate nahi hote. Subnet AZ-bound hai, so network placement compute placement define karti hai. ALB multi-AZ targets expose kar sakta hai. Data store ka replication/failover separate configuration hai; app tier redundancy data tier redundancy imply nahi karti.',
    lifecycle: 'Region choose → VPC CIDR design → at least two AZ subnets create → instances/tasks place → load balancer targets register → health check pass → failover drill. For disaster recovery, Region-level failure scenario alag plan karo.',
    implementation: 'Region choose karne se pehle availability, latency, compliance, and cost check karo. Deployment diagram mein subnet-A and subnet-B, application replicas, load balancer, database failover path, and egress path show karo.',
    code: `Region: us-east-1  # example only\nAZ A: public subnet (ALB), private subnet (app)\nAZ B: public subnet (ALB), private subnet (app)\nApp: >=1 healthy replica per AZ; test failover capacity\nData: separate multi-AZ durability/failover design\nNetwork: route tables, security groups, egress path checked`,
    alternatives: 'Single AZ development workload acceptable ho sakta hai if downtime risk explicitly accepted. Multi-AZ regional HA ke liye standard option hai. Multi-Region complex hai; use tab jab business RTO/RPO, geography, ya sovereignty require kare.',
    tradeoffs: 'Multi-AZ redundancy cost aur cross-AZ traffic add kar sakti hai, but AZ failure impact reduce karti hai. Multi-Region latency and resilience improve kar sakta hai, lekin data consistency, deployment, routing, and failover complexity significant hai.',
    failure: 'Both replicas accidentally same AZ mein; only one subnet configured; database single AZ; spare capacity missing; health checks pass despite broken dependency; Region outage ke liye no plan.',
    debugging: 'EC2/ECS task placement, subnet IDs, target group health, AZ labels, route tables, security groups, and AWS Health events check karo. Failure drill ka timeline use karke determine karo kaunsa tier recovery delay cause karta hai.',
    production: 'AZ spreading verify karo, quotas and capacity check karo, RTO/RPO define karo, backups test karo, failover runbook rehearse karo, and cost of cross-AZ data transfer account karo.',
    exercise: 'Architecture diagram mein ALB two AZs mein hai but all ECS tasks one AZ mein hain. AZ failure par kya hoga? Minimum correction aur validation test likho.',
    exerciseCheck: ['ALB surviving does not keep app running if all tasks are in failed AZ.', 'Place healthy task capacity in more than one AZ.', 'Run an AZ failure or task-drain test and observe target health and latency.'],
    quick: ['Region is geographic; AZ is an isolated location in a Region.', 'Subnet belongs to one AZ.', 'Multi-AZ app requires capacity and data paths in multiple AZs.', 'Cross-Region recovery needs a separate design.']
  },
  {
    id: 'lambda-lifecycle', unit: '03', title: 'Lambda execution lifecycle', purpose: 'Trace Init, Invoke, reuse, concurrency, and downstream pressure.', prerequisite: 'Start with the workload; State, scale, and failure', sources: ['lambda-execution','lambda-concurrency','rds-proxy','rds-pinning'],
    problem: 'First response slow hai aur burst par database errors aate hain. Init, handler, concurrency, aur database ko separate trace karo.',
    definition: 'Standard Lambda Event Function ka execution environment Init ke baad handler Invoke karta hai. Ek environment ek time par ek invocation handle karta hai. Idle environment reuse ho sakta hai, guaranteed nahi.',
    intuition: 'A first request ke liye Init karta hai. Second request A ko reuse kar sakti hai. Agar A busy hai, overlapping third request ke liye B jaisa second environment chahiye. B apna Init karta hai.',
    internals: 'Runtime aur extensions initialize hote hain, phir handler event process karta hai. Normal successful invoke ke baad environment freeze aur reuse possible hai. Error/timeout par reset ho sakta hai. New concurrent request ko separate environment chahiye. Ye standard Event Function model hai; Managed Instances aur Web Functions ke rules alag hain.',
    lifecycle: 'Request → Init if no ready environment → Invoke → result → possible freeze/reuse → eventual shutdown. Overlap → another environment and its Init, subject to quotas and scaling behavior.',
    implementation: 'Animation mein predictions answer karo. Lambda concurrency lab mein RPS, duration, concurrency cap, aur DB connections change karo. Real workload par traces aur load test se estimates verify karo.',
    code: 'arrival = 120 requests/second\nduration = 0.25 second\nconcurrency_estimate = 30\ndatabase_budget = 20 useful connections\n# Bound or reshape demand; test before increasing concurrency',
    alternatives: 'Provisioned concurrency pre-initializes environments for latency. Reserved concurrency allocates and caps concurrency. RDS Proxy can pool connections where suitable. Queue asynchronous work ko delay ke saath smooth kar sakti hai.',
    tradeoffs: 'Low cap database protect kar sakta hai but synchronous callers throttle honge. Provisioned concurrency has extra cost. Pooling DB capacity create nahi karta. Queue latency aur duplicate handling add karti hai.',
    failure: 'Cold Init latency ko handler latency samajhna; warm reuse guaranteed assume karna; reserved concurrency ko cold-start fix bolna; DB cap ignore karna; retries se load amplify karna.',
    debugging: 'CloudWatch ConcurrentExecutions, Throttles, Duration, Init timing, errors, and downstream DB connection and query metrics ko one timeline par compare karo.',
    production: 'IAM, idempotency, timeout, backoff, connection reuse health checks, quotas, and event-source-specific retry behavior document karo. Version and alias settings verify karo.',
    exercise: '120 RPS × 0.25 s ka concurrency estimate nikalo. DB 20 connections allow karta hai aur each active invocation one connection use kar sakta hai. Ek safe starting experiment defend karo.',
    exerciseCheck: ['Estimate = 30 active invokes.', 'DB connection budget may bind before compute quota.', 'Bounded test and caller-visible throttle tradeoff stated.'],
    quick: ['Init precedes first Invoke in a new environment.', 'Warm reuse is possible, not guaranteed.', 'Overlap needs another environment for standard Event Functions.', 'Bound compute using downstream capacity evidence.']
  }
, ...expandedLessons];
import { expandedLessons, expandedUnits } from './content/aws-compute/catalog';
