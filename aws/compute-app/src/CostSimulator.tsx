import { useMemo, useState } from 'react';

const shapes={
  'c7g.large':{vcpu:2,memory:4,syntheticHourly:0.08,throughput:120},
  'm7i.large':{vcpu:2,memory:8,syntheticHourly:0.10,throughput:100},
  'r7i.large':{vcpu:2,memory:16,syntheticHourly:0.14,throughput:85}
} as const;
type Shape=keyof typeof shapes;
export function CostSimulator(){
  const [rps,setRps]=useState(250),[duration,setDuration]=useState(.2),[hours,setHours]=useState(720),[instances,setInstances]=useState(4),[utilization,setUtilization]=useState(65),[shape,setShape]=useState<Shape>('m7i.large'),[region,setRegion]=useState('us-east-1'),[purchase,setPurchase]=useState('On-Demand'),[rate,setRate]=useState(.10),[cpu,setCpu]=useState(2),[memory,setMemory]=useState(8),[interruptions,setInterruptions]=useState(0),[lambdaMemory,setLambdaMemory]=useState(1024),[lambdaRate,setLambdaRate]=useState(.00002);
  const result=useMemo(()=>{
    const concurrency=rps*duration;
    const instanceCapacity=instances*shapes[shape].throughput*(utilization/100);
    const miss=Math.max(0,rps-instanceCapacity);
    const ec2=instances*hours*rate;
    const fargate=instances*hours*(cpu*.035+memory*.004);
    const lambda= rps*duration*hours*3600*(lambdaMemory/1024)*lambdaRate;
    const interruptionCost=interruptions*Math.max(0,duration)*rps*0.001;
    return {concurrency,instanceCapacity,miss,ec2,fargate,lambda,interruptionCost,ec2PerRequest:ec2/Math.max(1,rps*hours*3600)};
  },[rps,duration,hours,instances,utilization,shape,rate,cpu,memory,lambdaMemory,lambdaRate,interruptions]);
  const number=(setter:(value:number)=>void,min:number,max:number,step:number,value:number,label:string)=><label>{label}<input type="number" min={min} max={max} step={step} value={value} onChange={event=>setter(Number(event.target.value))}/></label>;
  return <section className="panel cost-lab"><p className="eyebrow">Interactive calculator · synthetic rates</p><h3>Compute cost and capacity lab</h3><p>Formulas are illustrative. Default dollar rates are invented inputs, not current AWS prices or a quote. Replace them with rates from the AWS Pricing pages for your Region before using results.</p>
    <div className="form-grid">
      {number(setRps,0,100000,10,rps,'Requests per second')}{number(setDuration,.001,3600,.01,duration,'Average execution seconds')}{number(setHours,1,744,1,hours,'Runtime hours per month')}{number(setInstances,1,500,1,instances,'Instance or task count')}{number(setUtilization,1,100,1,utilization,'Useful capacity target (%)')}
      <label>EC2 example shape<select value={shape} onChange={e=>{const value=e.target.value as Shape;setShape(value);setRate(shapes[value].syntheticHourly)}}>{Object.keys(shapes).map(key=><option key={key}>{key}</option>)}</select></label>
      {number(setRate,0,1000,.001,rate,'Student supplied EC2 $/instance-hour')}{number(setCpu,.25,256,.25,cpu,'Fargate task vCPU')}{number(setMemory,.5,512,.5,memory,'Fargate task memory GB')}{number(setLambdaMemory,128,10240,128,lambdaMemory,'Lambda memory MB')}{number(setLambdaRate,0,1,.000001,lambdaRate,'Synthetic Lambda $/GB-second')}
      <label>Region (rate fields above remain user supplied)<select value={region} onChange={e=>setRegion(e.target.value)}>{['us-east-1','us-west-2','eu-west-1','ap-south-1'].map(r=><option key={r}>{r}</option>)}</select></label>
      <label>Purchase model<select value={purchase} onChange={e=>setPurchase(e.target.value)}>{['On-Demand','Savings Plan / RI','Spot'].map(x=><option key={x}>{x}</option>)}</select></label>
      {number(setInterruptions,0,10000,1,interruptions,'Synthetic interruption events per month')}
    </div>
    <div className="result"><p>Estimated in-flight work: <strong>{result.concurrency.toFixed(1)}</strong></p><p>Measured-example EC2 throughput at target utilization: <strong>{result.instanceCapacity.toFixed(0)} RPS</strong> · uncovered demand: <strong>{result.miss.toFixed(0)} RPS</strong></p><p>Illustrative monthly EC2 compute: <strong>${result.ec2.toFixed(2)}</strong> · Fargate: <strong>${result.fargate.toFixed(2)}</strong> · Lambda: <strong>${result.lambda.toFixed(2)}</strong></p><p>Interruption/rework allowance (synthetic): <strong>${result.interruptionCost.toFixed(2)}</strong> · region: {region} · purchase model: {purchase}</p><p>EC2 estimate/request: <strong>${result.ec2PerRequest.toFixed(7)}</strong></p></div>
    <details><summary>Model assumptions and exclusions</summary><ul><li>EC2/Fargate/compute rates are synthetic or student supplied. No AWS Price List API is called.</li><li>Lambda equation uses request rate × duration × seconds × memory GB × entered synthetic GB-second rate; it excludes request charges, free tiers, provisioned concurrency, retries, and other pricing dimensions.</li><li>Fargate formula uses synthetic per-vCPU-hour and per-GB-hour constants; it excludes platform, storage, network, and minimums.</li><li>EC2 throughput is an editable workload assumption from selected example shape, not an AWS benchmark.</li><li>Savings Plans, Reserved Instances, and Spot do not change the numeric result automatically. Enter a verified effective rate; include interruption/checkpoint costs separately.</li></ul></details>
  </section>;
}
