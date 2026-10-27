export type Inputs = {
  rps: number;
  requestSeconds: number;
  workMinutes: number;
  cpu: 'low' | 'medium' | 'high';
  memoryGb: number;
  variability: 'steady' | 'bursty';
  latency: 'strict' | 'flexible';
  background: boolean;
  interruptible: boolean;
  teamSize: number;
  persistentConnections: boolean;
  utilization: number;
  costSensitive: boolean;
};
export const defaults: Inputs = {
  rps: 80, requestSeconds: 0.25, workMinutes: 0.25, cpu: 'medium', memoryGb: 1,
  variability: 'bursty', latency: 'strict', background: false, interruptible: false,
  teamSize: 3, persistentConnections: false, utilization: 25, costSensitive: true
};
export type Candidate = { name: string; score: number; reasons: string[]; cautions: string[]; docs: string[] };
export function evaluate(input: Inputs): Candidate[] {
  const lowOps = input.teamSize <= 4;
  const sustained = input.variability === 'steady' && input.utilization >= 65;
  const longWork = input.workMinutes > 15 || input.requestSeconds > 900;
  const candidates: Candidate[] = [
    { name: 'Lambda Event Function', score: 4, reasons: ['Event-driven handler; no server provisioning.'], cautions: ['Assumes standard on-demand Event Functions. Lambda Managed Instances and durable execution have different limits.', 'Check concurrency quotas, downstream connections, and current pricing.'], docs: ['lambda-fargate', 'lambda-timeout', 'lambda-durable'] },
    { name: 'ECS on Fargate', score: 4, reasons: ['Runs container tasks without managing host instances.'], cautions: ['You still own image, task sizing, IAM, networking, health, and deployment.', 'Check minimum task count and region-specific pricing.'], docs: ['containers', 'ecs-capacity'] },
    { name: 'ECS on EC2', score: 3, reasons: ['Containers with control over EC2 capacity and instance types.'], cautions: ['Team manages instance fleet, patching, and capacity.'], docs: ['containers', 'ecs-capacity'] },
    { name: 'Amazon EC2', score: 3, reasons: ['Full VM and guest OS control.'], cautions: ['Team owns OS patching, deploy, replacement, and scaling.'], docs: ['compute', 'nitro'] },
    { name: 'AWS Batch', score: 1, reasons: ['Orchestrates finite batch jobs.'], cautions: ['Not a direct replacement for a low-latency web API.'], docs: ['compute', 'containers'] }
  ];
  const [lambda, fargate, ecs, ec2, batch] = candidates;
  if (input.variability === 'bursty') { lambda.score += 2; lambda.reasons.push('Bursty demand can benefit from per-invocation scale.'); }
  if (lowOps) { lambda.score += 1; fargate.score += 1; lambda.reasons.push('Small team benefits from reduced host operations.'); fargate.reasons.push('Small team avoids host fleet management.'); }
  if (sustained) { ecs.score += 1; ec2.score += 1; lambda.cautions.push('High sustained utilization needs a measured cost comparison.'); }
  if (longWork) { lambda.score -= 7; lambda.cautions.push('Work exceeds the 15-minute limit for standard on-demand Event Functions; check Lambda Managed Instances or durable execution separately.'); fargate.score += 2; batch.score += 1; }
  if (input.persistentConnections) { lambda.score -= 2; fargate.score += 2; ecs.score += 1; lambda.cautions.push('Persistent connection lifecycle may not fit event handlers.'); }
  if (input.cpu === 'high' || input.memoryGb > 10) { ec2.score += 2; ecs.score += 1; ec2.reasons.push('Specialized or high-resource needs may favor instance selection.'); }
  if (input.memoryGb > 10) { lambda.score -= 5; lambda.cautions.push('Standard Lambda Event Function memory configuration tops out at 10,240 MB.'); }
  if (input.background) { batch.score += 4; batch.reasons.push('Finite background jobs benefit from queueing and job orchestration.'); fargate.score += 1; }
  if (input.background && input.interruptible) { batch.score += 3; batch.reasons.push('Interruptible finite work can use appropriate Spot capacity with checkpoints.'); }
  if (!input.background) { batch.score -= 3; }
  if (input.latency === 'strict') { lambda.cautions.push('Measure cold-start and downstream tail latency against the target.'); fargate.reasons.push('Warm service tasks can serve continuous low-latency traffic.'); }
  if (input.rps > 1000) { for (const c of candidates) c.cautions.push('Validate service quotas and downstream capacity at peak traffic.'); }
  if (input.costSensitive) { for (const c of candidates) c.cautions.push('Use your Region’s current prices and measured utilization; this score is not a cost quote.'); }
  return candidates.sort((a, b) => b.score - a.score);
}
