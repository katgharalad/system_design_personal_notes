import { useState } from 'react';

export type LambdaInputs = { rps: number; seconds: number; reserved: number; dbBudget: number; connections: number };
export const lambdaDefaults: LambdaInputs = { rps: 120, seconds: .25, reserved: 20, dbBudget: 20, connections: 1 };
export function calculateLambda(input: LambdaInputs) {
  const demand = Math.max(0,input.rps) * Math.max(0,input.seconds);
  const admitted = Math.min(Math.ceil(demand),Math.max(0,input.reserved));
  const dbDemand = admitted * Math.max(0,input.connections);
  return { demand, admitted, dbDemand, overCap: Math.max(0,Math.ceil(demand)-admitted), dbGap: Math.max(0,dbDemand-Math.max(0,input.dbBudget)) };
}
export function LambdaSimulator() {
  const [input,setInput] = useState(lambdaDefaults);
  const result = calculateLambda(input);
  const change = (key: keyof LambdaInputs, value: number) => setInput(old=>({...old,[key]:value}));
  return <section className="panel lambda-simulator"><h3>Lambda concurrency lab</h3><p>Change assumptions after the animation. These are planning estimates, not a live AWS simulator. Use a load test to validate burst behavior, tail latency, connection reuse, and throttles.</p>
    <div className="lambda-sliders">
      {([['rps','Requests / second',0,500,1],['seconds','Mean handler seconds',.05,2,.05],['reserved','Reserved concurrency cap',0,200,1],['dbBudget','Useful DB connections',0,200,1],['connections','Connections per active invoke',0,4,1]] as const).map(([key,label,min,max,step])=><label key={key}>{label}: <strong>{input[key]}</strong><input type="range" min={min} max={max} step={step} value={input[key]} onChange={event=>change(key,Number(event.target.value))} /></label>)}
    </div>
    <div className="stats"><div><strong>{result.demand.toFixed(1)}</strong><span>Estimated active demand</span></div><div><strong>{result.admitted}</strong><span>Up to cap in model</span></div><div><strong>{result.dbDemand}</strong><span>Potential DB connections</span></div></div>
    <p><strong>Capacity reading:</strong> {result.overCap>0?`Demand estimate exceeds the cap by ${result.overCap} concurrent invokes. Synchronous calls may throttle.`:'Demand estimate is within the chosen cap.'} {result.dbGap>0?`Potential DB connection demand exceeds budget by ${result.dbGap}.`:'Potential DB connection demand is within the stated budget.'}</p>
    <p className="assumption">Model: steady arrival × mean handler duration; standard Event Function, one active invoke per environment. Actual capacity also depends on quota, scaling rate, RPS limits, event source, and duration distribution. Idle environments may retain connections, and other clients may use the database. A connection count is not query throughput.</p>
  </section>;
}
