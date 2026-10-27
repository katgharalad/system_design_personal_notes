import { useCallback, useState } from 'react';
import { ReactFlow, addEdge, Background, Controls, type Connection, type Edge, type Node, useEdgesState, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { assessArchitecture, type LabNode } from './architecture';

const labels: Record<LabNode['kind'], string> = { client: 'Client', alb: 'ALB', 'app-a': 'App task · AZ A', 'app-b': 'App task · AZ B', database: 'Database' };
const colors: Record<LabNode['kind'], string> = { client: '#e7edf3', alb: '#dcecf3', 'app-a': '#e3eedf', 'app-b': '#e3eedf', database: '#f5e9da' };
const initial: Node[] = [{ id: 'client', position: { x: 20, y: 130 }, data: { label: 'Client' }, type: 'input', style: { background: colors.client, border: '1px solid #7990a1', borderRadius: 2 } }];
export function Architecture() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initial);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [feedback, setFeedback] = useState<string[] | null>(null);
  const onConnect = useCallback((connection: Connection) => setEdges((current) => addEdge({ ...connection, animated: false }, current)), [setEdges]);
  const add = (kind: LabNode['kind']) => {
    if (nodes.some(n => n.id === kind)) return;
    setNodes(current => [...current, { id: kind, position: { x: 180 + current.length * 58, y: 55 + current.length * 52 }, data: { label: labels[kind] }, style: { background: colors[kind], border: '1px solid #7990a1', borderRadius: 2, minWidth: 120 } }]);
    setFeedback(null);
  };
  const check = () => setFeedback(assessArchitecture(nodes.map(node => ({ id: node.id, kind: node.id as LabNode['kind'] })), edges.map(edge => ({ source: edge.source, target: edge.target }))));
  return <section className="panel">
    <p className="eyebrow">Architecture exercise · Unit 1</p>
    <h2>Keep an API available across two AZs</h2>
    <p>Place an ALB, one app task in each AZ, and a database. Connect the request path. Drag nodes to arrange them. This check tests topology only; it does not prove database failover, capacity, or security.</p>
    <div className="button-row" aria-label="Add architecture nodes">{(['alb','app-a','app-b','database'] as const).map(kind => <button key={kind} type="button" onClick={() => add(kind)} disabled={nodes.some(node => node.id === kind)}>Add {labels[kind]}</button>)}</div>
    <div className="flow" aria-label="Architecture canvas"><ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView fitViewOptions={{ maxZoom: 1 }}><Background color="#d8dee4" /><Controls /></ReactFlow></div>
    <div className="button-row"><button type="button" className="primary" onClick={check}>Check architecture</button><button type="button" onClick={() => { setNodes(initial); setEdges([]); setFeedback(null); }}>Reset</button></div>
    {feedback && <div className="result" role="status">{feedback.length === 0 ? <p>Request path and two AZ app tasks are present. Next, explain capacity, database failover, IAM, and health checks.</p> : <><strong>Check these parts:</strong><ul>{feedback.map(item => <li key={item}>{item}</li>)}</ul></>}</div>}
  </section>;
}
