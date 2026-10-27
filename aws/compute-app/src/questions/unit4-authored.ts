import type { InterviewQuestion } from '../questions';
import { expandedLessons } from '../content/aws-compute/catalog';

type Draft = Pick<InterviewQuestion, 'lesson'|'topic'|'prompt'|'answer'|'explanation'|'rubric'|'mistakes'|'hint'|'followUp'|'difficultyLevel'|'assessmentType'|'scenario'|'assumptions'|'learningObjective'|'followUps'|'prerequisites'|'revisionNotes'>;
const drafts: Draft[] = [
  {
    lesson:'container-images',topic:'Image architecture and process shutdown',
    prompt:'A service image builds and runs on an ARM developer laptop, but ECS tasks on x86 EC2 instances fail at startup with an executable format error. After the image is corrected, deployments still lose in-flight work during shutdown. Explain both failures and the release changes you would make.',
    scenario:'The CI runner is ARM64; production capacity is x86_64. The process receives SIGTERM during a rolling deployment.',
    assumptions:['No emulation is configured in production.','The application can be changed to handle shutdown signals.'],
    answer:'First inspect the image manifest and task architecture. The local success only proves the ARM image runs on ARM; build an x86_64 image or publish a multi-platform manifest, then deploy its digest and test on the target runtime. Do not change IAM or networking because the error names an executable-format mismatch. For shutdown, use an exec-form entrypoint or ensure the wrapper forwards SIGTERM. Stop accepting new requests, drain bounded in-flight work, close pools, flush required logs, and exit before the orchestrator grace period. Work interrupted after an external side effect must remain idempotent. Add architecture and digest checks to CI, plus a termination test using the production image.',
    explanation:'Pehle image architecture match karo; network ya IAM iska fix nahi. Phir process shutdown test karo: TERM lo, naye requests roko, bounded drain karo, pool close karo. Queue ya request repeat ho sakta hai, isliye side effect idempotent rakho.',
    rubric:['Identifies architecture mismatch from manifest and runtime platform','Explains signal forwarding and bounded graceful shutdown','Pins digest and validates on target platform','Accounts for retry/idempotency after interruption'],
    mistakes:['Changing security groups for an architecture error','Assuming SIGTERM guarantees all work finishes','Deploying a mutable tag without recording digest'],hint:'Compare image platform with task platform, then trace SIGTERM to the application process.',
    followUp:'How would your answer change if one image must serve both ARM and x86 capacity?',difficultyLevel:4,assessmentType:'Production debugging',
    learningObjective:'Diagnose image/platform and process-lifecycle failures using artifact and runtime evidence.',followUps:['U04-Q002','U04-Q009'],prerequisites:['container-images'],revisionNotes:['container-images']
  },
  {
    lesson:'container-isolation',topic:'Container threat boundaries',
    prompt:'Two customers submit untrusted archive-processing jobs. Your team proposes placing every job in a container on one ECS EC2 cluster. What boundary does this provide, what can cross it, and what architecture would you choose?',
    scenario:'Jobs run native decoders and each task currently has access to an application task role and outbound internet.',
    assumptions:['Customers are mutually untrusted.','Workload isolation is a security requirement, not only resource fairness.'],
    answer:'A conventional Linux container isolates processes and resource views but shares the host kernel. Privileged settings, host mounts, broad capabilities, or kernel vulnerabilities can weaken that boundary. First remove privileged mode and host mounts, minimize capabilities, run non-root, constrain CPU/memory, and scope task roles and egress. Separate the ECS execution role from the application task role. Then decide whether shared EC2 hosts meet the tenant threat model. If compromise of one job must not expose another tenant or the host, use stronger isolation or dedicated capacity; Fargate provides a different task isolation and host-ownership model, but does not remove application IAM, network, or dependency risks. Validate the selected boundary with security review and an escape-response exercise.',
    explanation:'Container ko VM boundary mat bolo. Linux jobs host kernel share karte hain. Pehle privilege, mount, role aur egress restrict karo; phir tenant threat model ke hisaab se dedicated ya stronger isolation chuno. Fargate host manage karta hai, app permissions nahi.',
    rubric:['States conventional container kernel-sharing boundary','Names concrete escape and lateral-movement controls','Separates execution role from application task role','Chooses stronger isolation based on stated threat model'],
    mistakes:['Claiming containers always isolate mutually untrusted tenants','Assuming Fargate removes IAM and network risk'],hint:'Start with the shared kernel and the credentials available to a compromised process.',
    followUp:'Which evidence would show that a task can reach another customer’s data?',difficultyLevel:5,assessmentType:'Architecture and service choice',
    learningObjective:'Choose container isolation and IAM boundaries from a tenant threat model.',followUps:['U04-Q001','U04-Q003'],prerequisites:['container-images'],revisionNotes:['container-isolation']
  },
  {
    lesson:'container-local',topic:'Shutdown and redelivery contract',
    prompt:'A containerized queue worker commits a database update, then is killed before acknowledging its message. The message is delivered again. Explain the correct worker behavior and a local test that demonstrates it.',
    scenario:'The queue is at-least-once and the database commit succeeds before acknowledgement.',
    assumptions:['The same logical message has a stable idempotency key.','The job may be interrupted during deployment or host failure.'],
    answer:'The worker must treat delivery as at-least-once. Store a durable idempotency record or make the write conditional on a unique job key in the same transaction as the business update. On redelivery, detect the committed outcome and acknowledge without repeating the external effect. During SIGTERM, stop polling, finish only bounded in-flight work, commit safely, and acknowledge after durable success. A local integration test should run the real image, deliver a job, commit the database update, terminate the process before acknowledgement, redeliver the same key, and assert one business effect. Also test the crash before commit and confirm that the retry performs the effect once.',
    explanation:'Queue message dobara aa sakta hai, chahe DB commit pehle ho gaya. Idempotency key ko durable transaction ke saath use karo. TERM par poll band karo; commit ke baad ack. Test mein commit ke turant baad worker kill karke redelivery karao.',
    rubric:['Explains at-least-once duplicate delivery','Places idempotency boundary with durable business write','Defines safe stop and acknowledgement order','Proposes crash-point test for before and after commit'],
    mistakes:['Acknowledging before durable completion','Relying on in-memory deduplication','Assuming graceful shutdown always completes'],hint:'Enumerate the crash point before and after the database commit.',
    followUp:'How would you make the idempotency record atomic with an external payment call?',difficultyLevel:4,assessmentType:'Explain the internals',
    learningObjective:'Design a retry-safe worker across container termination and message redelivery.',followUps:['U04-Q004','U04-Q009'],prerequisites:['container-local'],revisionNotes:['container-local']
  },
  {
    lesson:'container-ecr',topic:'Image provenance and rollback',
    prompt:'A deployment uses the tag `api:stable`. A rollback appears successful, but the replacement tasks still run the new build. Diagnose the artifact problem and define a release policy.',
    scenario:'CI can push to ECR, and a lifecycle policy removes untagged images after seven days.',
    assumptions:['The tag may be overwritten.','The previous image digest is not recorded in the deployment ticket.'],
    answer:'A tag is a mutable reference unless repository policy makes it immutable. The rollback likely resolved `stable` to the same new digest. Inspect the running task’s image digest and compare it with CI build provenance; redeploy the known previous digest. For each release, record source revision, build, digest, task-definition revision, and deployment result. Enable immutable release tags or deploy by digest. Retain known-good digests through the rollback and audit window; review lifecycle rules so they cannot remove them. Scanning should run on new releases and rescan after disclosures, with an owner and deadline for findings. Verify that the execution role and private network path can pull the pinned digest.',
    explanation:'Tag pointer badal sakta hai. Rollback mein digest use karo, source commit aur task revision ke saath record rakho. Lifecycle policy ko rollback window ke against check karo; untagged cleanup purani image hata sakta hai.',
    rubric:['Uses digest to identify actual running bytes','Connects CI provenance to deployed revision','Prevents mutable-tag rollback ambiguity','Checks lifecycle retention and scan ownership'],
    mistakes:['Assuming a tag is immutable by default','Treating successful deployment API response as proof of intended digest'],hint:'Compare the digest running now with the digest from the last known-good build.',
    followUp:'What must verify an image signature for signing to block an untrusted deploy?',difficultyLevel:4,assessmentType:'Production debugging',
    learningObjective:'Make container releases reproducible, traceable, and reversible.',followUps:['U04-Q005','U04-Q009'],prerequisites:['container-ecr'],revisionNotes:['container-ecr']
  },
  {
    lesson:'container-storage',topic:'Container storage contract',
    prompt:'An ECS service stores uploaded customer files under `/app/data`. Deployments replace tasks and files disappear. Propose a storage design and migration plan.',
    scenario:'Tasks run on Fargate, scale across AZs, and uploads must survive task replacement.',
    assumptions:['Files are durable customer records.','Applications need occasional concurrent reads but not POSIX file locking.'],
    answer:'The writable task layer is lifecycle-bound and must not be treated as durable. Store file objects in S3, write metadata and ownership to the database, and acknowledge success only after the object is durably stored and the metadata outcome is known. Use an idempotency key or state machine to recover if upload succeeds but metadata commit fails; expire orphan objects with a controlled cleanup process. Migrate existing files by inventorying paths, copying and checksumming objects, dual-reading during cutover if needed, and verifying customer access before removing local storage. Keep task disk for bounded scratch only. If the application actually needs shared POSIX semantics, evaluate EFS and its network, permissions, and throughput costs instead.',
    explanation:'Fargate task disk task ke saath replace ho sakta hai. Durable upload S3 mein rakho; metadata DB mein. Upload aur DB write ke beech partial failure ke liye cleanup/idempotency define karo. EFS tab chuno jab shared POSIX access sach mein chahiye.',
    rubric:['Identifies task filesystem as ephemeral','Selects storage by required access semantics','Defines partial-failure recovery and migration verification','Keeps scratch separate from durable data'],
    mistakes:['Moving files to EFS without checking POSIX need or throughput','Acknowledging before durable storage','Assuming file upload and DB metadata are one transaction'],hint:'Separate durable object data, metadata, and task scratch.',
    followUp:'If tasks must concurrently append to a shared file, what new consistency and locking questions arise?',difficultyLevel:4,assessmentType:'Architecture and service choice',
    learningObjective:'Match container storage to durability, sharing, and access semantics.',followUps:['U04-Q006','U04-Q007'],prerequisites:['container-storage'],revisionNotes:['container-storage']
  },
  {
    lesson:'ecs-fundamentals',topic:'ECS desired state and health',
    prompt:'An ECS service has desired count 6 and six tasks in RUNNING state, yet the ALB reports zero healthy targets. Trace the failure and explain what ECS will do.',
    scenario:'The tasks use `awsvpc`; application process listens on port 8080.',
    assumptions:['Tasks have a container health check but no ALB target is healthy.','No deployment is currently in progress.'],
    answer:'RUNNING means the task started; it does not prove the request path is healthy. Check target registration type (IP for `awsvpc`), port mapping, health-check path and matcher, task security-group ingress from the ALB security group, route, and process bind address. Read target-health reason codes and compare them with container health. ECS service desired-state logic can replace tasks only when its configured health signals report failure; replacement on an unchanged bad task definition may repeat the incident. Fix the exact network, port, or readiness defect, then verify targets become healthy and a synthetic request succeeds. Add deployment alarms and a bounded rollback path.',
    explanation:'Service count aur healthy target alag signals hain. ALB reason code, port, target type, SG aur bind address trace karo. ECS same broken definition se replacement repeat kar sakta hai. Fix ke baad actual request test karo.',
    rubric:['Distinguishes RUNNING from target health','Traces ALB-to-task network and application path','Explains desired-state replacement limits','Defines end-to-end verification'],
    mistakes:['Assuming ECS automatically repairs every network failure','Changing all security groups before checking target reason'],hint:'Follow one request from ALB listener to the task process and back.',
    followUp:'How would the diagnosis differ if tasks were STOPPED before reaching RUNNING?',difficultyLevel:4,assessmentType:'Production debugging',
    learningObjective:'Explain ECS task lifecycle, health signals, and desired-state recovery.',followUps:['U04-Q007','U04-Q008'],prerequisites:['ecs-fundamentals'],revisionNotes:['ecs-fundamentals']
  },
  {
    lesson:'ecs-networking',topic:'Private task egress',
    prompt:'New Fargate tasks in private subnets stay in PROVISIONING because they cannot pull their image or send logs. The VPC has no NAT gateway. Design the least-cost private path and its permissions.',
    scenario:'The image is in ECR and logs go to CloudWatch Logs. Tasks also retrieve a secret from Secrets Manager.',
    assumptions:['Tasks do not need arbitrary public internet access.','Private DNS is enabled for interface endpoints.'],
    answer:'List each dependency rather than adding general internet access. Create the required interface endpoints for ECR API, ECR registry, CloudWatch Logs, and Secrets Manager, plus the S3 gateway endpoint/path used for image layers where applicable. Ensure endpoint security groups allow HTTPS from task subnets, private DNS resolves to endpoint addresses, and endpoint policies permit the intended actions. The ECS execution role needs image-pull, log, and secret-injection permissions; the application task role should only receive permissions used by application code. Validate DNS, route, TLS, IAM, and endpoint policy separately. If tasks need arbitrary external APIs, an egress proxy or NAT may still be required; endpoints are not a universal internet substitute.',
    explanation:'Har dependency ka network aur IAM path alag list karo. ECR, S3 layers, logs aur secret ke endpoints/routes chahiye. Execution role setup actions karta hai; task role app calls ke liye. Endpoint network path hai, permission nahi.',
    rubric:['Enumerates service dependencies and network endpoints','Includes endpoint security, DNS, and policy','Separates execution role and task role','Recognizes when arbitrary external egress still requires NAT/proxy'],
    mistakes:['Assuming an endpoint grants IAM access','Adding public IPs or broad internet egress without need'],hint:'Separate image data, registry API, logs, secret, DNS, network, and IAM.',
    followUp:'What flow-log and task-event evidence would distinguish a route problem from an IAM denial?',difficultyLevel:5,assessmentType:'Code and configuration',
    learningObjective:'Build a least-privilege private network path for ECS task startup.',followUps:['U04-Q006','U04-Q008'],prerequisites:['ecs-networking'],revisionNotes:['ecs-networking']
  },
  {
    lesson:'ecs-capacity',topic:'Task placement after AZ loss',
    prompt:'An ECS service runs 18 tasks on six EC2 container instances spread evenly across three AZs. Each instance safely fits four tasks. One AZ fails. Can the remaining fleet maintain desired count? Explain the next design step.',
    scenario:'Each AZ contains two instances; placement requires tasks across all healthy AZs. Ignore deployment surge for the first calculation.',
    assumptions:['The remaining four instances each retain capacity for four tasks.','The database can support all 18 tasks.'],
    answer:'Before failure, six hosts × four tasks gives 24 slots. Losing one AZ leaves four hosts × four = 16 slots. The service cannot keep 18 tasks running; at least two tasks remain pending unless additional capacity launches. Desired state does not create capacity. Choose whether to retain two-task degradation or provide N-1 headroom by running at least five more task slots across surviving AZs, subject to cost and placement. Validate Auto Scaling launch delay, ECS registration time, subnet IPs, and image pull. Recalculate including rollout surge and dependency limits. If adding tasks would overload the database, cap admission or queue work instead of scaling blindly.',
    explanation:'AZ loss ke baad 4 hosts × 4 = 16 slots. Desired 18 hai, toh do pending honge. N-1 target ke liye surviving AZs mein spare capacity chahiye; launch delay aur DB budget bhi include karo.',
    rubric:['Calculates 16 surviving slots correctly','Distinguishes desired count from available capacity','Names N-1 and scale-out delay tradeoff','Includes subnet and dependency constraints'],
    mistakes:['Using pre-failure total capacity after AZ loss','Assuming ECS desired count instantly launches capacity'],hint:'Recompute capacity using only surviving instances.',
    followUp:'How does the answer change if an in-progress deployment needs six additional tasks?',difficultyLevel:4,assessmentType:'Numerical engineering',
    learningObjective:'Calculate ECS placement headroom under an Availability Zone failure.',followUps:['U04-Q009','U04-Q011'],prerequisites:['ecs-capacity'],revisionNotes:['ecs-capacity']
  },
  {
    lesson:'ecs-deploy',topic:'Deployment rollback and compatibility',
    prompt:'A rolling ECS deployment reaches healthy targets, but requests fail because the new task writes a database format that old tasks cannot read. Why did health checks miss this, and how would you release safely?',
    scenario:'Old and new task revisions run concurrently for several minutes. Both use the same database.',
    assumptions:['The format change is reversible with a staged migration.','Target health probes only process readiness.'],
    answer:'Target health proves that the configured probe passes; it does not prove mixed-version data compatibility. Roll back traffic or deploy the previous compatible code while assessing whether new-format writes can be reversed. For the next release, use expand-and-contract: add backward-compatible schema, deploy code that reads both formats but writes the old one, then switch writes, backfill, and remove old-format support in a later release after old tasks and queued work drain. Keep the previous image digest and task-definition revision. Circuit breaker can react to task startup or health failures, but application-level correctness requires useful alarms, canaries, and compatibility tests.',
    explanation:'Health probe ready hai ya nahi batata, data format compatible hai ya nahi nahi. Old/new overlap ke liye expand-contract migration karo. Rollback image ke saath schema aur already-written data ka plan bhi chahiye.',
    rubric:['Distinguishes target health from semantic correctness','Provides staged compatible schema rollout','Accounts for rollback and already-written data','Adds canary/compatibility validation'],
    mistakes:['Assuming circuit breaker detects incorrect business data','Rolling code back without checking irreversible writes'],hint:'List what runs simultaneously and which version can read each stored format.',
    followUp:'What alarm would detect a healthy task returning semantically wrong responses?',difficultyLevel:5,assessmentType:'Architecture and service choice',
    learningObjective:'Defend a backward-compatible ECS rollout and data migration.',followUps:['U04-Q010','U04-Q012'],prerequisites:['ecs-deploy'],revisionNotes:['ecs-deploy']
  },
  {
    lesson:'kubernetes-core',topic:'Kubernetes pending pods',
    prompt:'A Kubernetes Deployment requests 12 replicas. Six are running; six remain Pending. Node CPU averages 30%. Walk through the scheduler evidence and explain why adding replicas did not add capacity.',
    scenario:'The workload uses resource requests, node selectors, a PVC, and a readiness probe.',
    assumptions:['No scheduler or API-server outage is reported.','Node scale-out has a multi-minute delay.'],
    answer:'Read Pod Events and scheduler messages first. Low average CPU does not prove schedulable capacity: requests may not fit, memory may bind, selectors or taints may exclude nodes, PVCs may be unbound or zone-constrained, and pod IP allocation may be exhausted. HPA or a Deployment changes desired Pod count; a node autoscaler is a separate control loop and may need time to launch nodes. Verify that its constraints permit the required node shape and that subnet IP and quota remain available. Do not lower requests or readiness blindly. Correct the measured constraint, wait for node registration and image pull, then verify Ready endpoints and application SLO.',
    explanation:'Pending Pod ka reason Events mein hota hai. Average CPU scheduling requests, memory, taint, PVC ya IP limit nahi batata. HPA replica count badhata; node autoscaler alag aur slow loop hai.',
    rubric:['Uses scheduler Events before changing config','Names multiple non-CPU placement constraints','Distinguishes pod scaling from node scaling','Validates endpoint readiness and service SLO'],
    mistakes:['Assuming low CPU guarantees placement','Lowering requests without workload evidence'],hint:'Check the exact Pod scheduling event, not only node-average utilization.',
    followUp:'What risk appears if you reduce memory requests to force these Pods onto current nodes?',difficultyLevel:4,assessmentType:'Production debugging',
    learningObjective:'Diagnose Kubernetes scheduling and multi-stage autoscaling constraints.',followUps:['U04-Q011','U04-Q008'],prerequisites:['kubernetes-core'],revisionNotes:['kubernetes-core']
  },
  {
    lesson:'eks-production',topic:'EKS pod IP exhaustion',
    prompt:'During a traffic spike, EKS Pods remain Pending while nodes show free CPU and memory. What evidence would confirm IP exhaustion, and how would you restore capacity safely?',
    scenario:'The cluster uses Amazon VPC CNI and private subnets with finite CIDR ranges.',
    assumptions:['Pod Events report sandbox/network setup failures for new Pods.','Existing Pods continue to serve.'],
    answer:'Check Pod Events, VPC CNI logs and metrics, available subnet addresses, ENI/IP limits, and the CNI configuration. VPC CNI assigns VPC addresses to Pods, so subnet/IP capacity can bind before CPU. Add appropriately sized subnet/address capacity or tune supported CNI prefix/delegation settings after validating compatibility. Ensure node groups can launch into subnets with addresses and enough quota; rollout surge also consumes IPs. Do not drain healthy nodes until replacement Pods are schedulable. Monitor pending count, IP allocation, node readiness, and application SLO during recovery. Plan CIDR capacity for peak and AZ failure, not only current steady state.',
    explanation:'CPU free hote hue bhi VPC CNI ke paas Pod IP na ho toh Pod start nahi. Events, CNI logs, subnet IP aur ENI limits check karo. Naya CIDR/capacity add karte waqt healthy nodes drain mat karo; surge aur AZ failover bhi plan karo.',
    rubric:['Identifies Pod IP as separate scheduling resource','Names confirming events, CNI, subnet, and ENI evidence','Proposes compatible capacity remediation','Protects healthy capacity during recovery'],
    mistakes:['Adding CPU-only nodes into exhausted subnets','Draining healthy nodes before replacement capacity exists'],hint:'Trace Pod sandbox setup to the CNI address allocation step.',
    followUp:'How would subnet design change if node and Pod IPs come from separate CIDR ranges?',difficultyLevel:5,assessmentType:'Production debugging',
    learningObjective:'Diagnose EKS network address exhaustion and plan safe recovery.',followUps:['U04-Q012','U04-Q008'],prerequisites:['eks-production'],revisionNotes:['eks-production']
  },
  {
    lesson:'ecs-eks-decision',topic:'ECS or EKS operating choice',
    prompt:'A team proposes EKS for a small API because “Kubernetes is portable.” The service requires AWS load balancing, EBS, IAM workload identity, and CloudWatch telemetry. Defend a platform choice and state what requirement would change it.',
    scenario:'The team has three engineers and no dedicated platform group. There is no committed second-cloud migration.',
    assumptions:['ECS on Fargate can meet the API runtime and scaling needs.','Kubernetes operators and CRDs are not required.'],
    answer:'I would start with ECS on Fargate unless a verified Kubernetes API or ecosystem requirement exists. It gives AWS-managed host capacity and an AWS-native service model with a smaller control surface for a three-person team. EKS provides Kubernetes APIs and a managed control plane, but the team still owns workload manifests, add-ons, upgrades, networking, identity, storage, observability, and incidents. The stated AWS integrations make the portability claim incomplete: load balancing, EBS, IAM, and telemetry still need provider-specific implementations. I would revisit EKS if the organization standardizes on Kubernetes, requires a specific operator/CRD ecosystem, or has a platform team that can own cluster operations. Validate both through deployment, scale, AZ loss, rollback, and on-call exercises.',
    explanation:'“Portable” ko concrete APIs mein todho. EKS control plane manage karta, par add-ons aur on-call nahi. Chhoti team aur no Kubernetes-specific need ho toh ECS operationally simpler ho sakta hai. Requirement badle toh decision revisit karo.',
    rubric:['Compares AWS-native and Kubernetes control surfaces','Accounts for team size and operational ownership','Challenges binary portability claim with integrations','Names explicit revisit triggers and validation'],
    mistakes:['Choosing EKS only for hypothetical future portability','Claiming ECS always simpler or cheaper without testing workload'],hint:'List the actual portability requirement and who will operate each platform.',
    followUp:'If the organization later standardizes on Kubernetes, which migration risks would you test first?',difficultyLevel:5,assessmentType:'Architecture and service choice',
    learningObjective:'Choose an orchestrator from workload, team, portability, and operating requirements.',followUps:['U04-Q001','U04-Q010'],prerequisites:['ecs-eks-decision'],revisionNotes:['ecs-eks-decision']
  }
];

const lessonById = new Map(expandedLessons.map(lesson => [lesson.id, lesson]));
export const unit4AuthoredQuestions: InterviewQuestion[] = drafts.map((draft,index) => {
  const number=index+1;
  const lesson=lessonById.get(draft.lesson);
  if (!lesson) throw new Error(`Unknown Unit 4 lesson: ${draft.lesson}`);
  return {
    ...draft,
    id:`U04-Q${String(number).padStart(3,'0')}`,
    unit:'04',difficulty:draft.difficultyLevel===1?'Foundation':draft.difficultyLevel===5?'Defense':'Applied',
    mode:draft.assessmentType==='Production debugging'?'Debugging':draft.assessmentType==='Explain the internals'?'Deep dive':'Decision',
    sources:lesson.sources,concepts:[draft.topic,'AWS containers',draft.assessmentType],
    followUp:draft.followUp,prerequisites:[lesson.prerequisite],revisionNotes:[draft.lesson]
  };
});
