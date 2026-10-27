export type LabNode = { id: string; kind: 'client' | 'alb' | 'app-a' | 'app-b' | 'database' };
export type LabEdge = { source: string; target: string };
export function assessArchitecture(nodes: LabNode[], edges: LabEdge[]): string[] {
  const kinds = new Map(nodes.map(node => [node.id, node.kind]));
  const has = (kind: LabNode['kind']) => nodes.some(node => node.kind === kind);
  const linked = (from: LabNode['kind'], to: LabNode['kind']) => edges.some(edge => kinds.get(edge.source) === from && kinds.get(edge.target) === to);
  const missing: string[] = [];
  if (!has('alb')) missing.push('Add an Application Load Balancer.');
  if (!has('app-a') || !has('app-b')) missing.push('Place one app task in each Availability Zone.');
  if (!has('database')) missing.push('Add the database.');
  if (has('alb') && !linked('client', 'alb')) missing.push('Connect client to ALB.');
  if (has('alb') && has('app-a') && !linked('alb', 'app-a')) missing.push('Connect ALB to the AZ A task.');
  if (has('alb') && has('app-b') && !linked('alb', 'app-b')) missing.push('Connect ALB to the AZ B task.');
  if (has('database') && has('app-a') && !linked('app-a', 'database')) missing.push('Connect the AZ A task to the database.');
  if (has('database') && has('app-b') && !linked('app-b', 'database')) missing.push('Connect the AZ B task to the database.');
  return missing;
}
