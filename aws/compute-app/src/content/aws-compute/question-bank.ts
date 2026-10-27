import type { InterviewQuestion } from '../../questions';
import { expandedLessons, modules } from './catalog';
import { lessonText } from '../../lessonText';

const targetByUnit: Record<string, number> = { '04':55, '05':45, '06':30, '07':35, '08':35, '09':20, '10':40 };
const patterns = [
  { type:'Explain the internals', mode:'Deep dive' as const, level:2, stem:(t:string)=>`Trace the execution and control path for ${t}. Which component owns each transition, and which state must the application preserve?` },
  { type:'Code and configuration', mode:'Deep dive' as const, level:3, stem:(t:string)=>`Write or review a production configuration for ${t}. What must be pinned, permissioned, health-checked, and rolled back?` },
  { type:'Numerical engineering', mode:'Decision' as const, level:3, stem:(t:string)=>`Work a capacity estimate for ${t} from stated inputs. Show units, headroom, and which measured limit could invalidate the result.` },
  { type:'Production debugging', mode:'Debugging' as const, level:4, stem:(t:string)=>`Production symptom: ${t} is failing under load while its top-level status appears healthy. Give a step-by-step evidence-led diagnosis and safest mitigation.` },
  { type:'Architecture and service choice', mode:'Decision' as const, level:4, stem:(t:string)=>`Defend a design using ${t}. Compare one credible alternative and identify the workload or team constraint that would change your choice.` },
  { type:'Progressive interviewer pressure', mode:'Decision' as const, level:5, stem:(t:string)=>`The first design for ${t} works. Now one Availability Zone fails, traffic doubles, and a dependency hits its limit. Redesign the admission and recovery path.` }
];
const wordCount=(s:string)=>s.trim().split(/\s+/).filter(Boolean).length;
const sections=(raw:string)=>{
  const result:Record<string,string>={};
  let active:string|null=null;
  for(const line of raw.split('\n')){
    const heading=/^## (.+)$/.exec(line);
    if(heading){active=heading[1].trim().toLowerCase();result[active]='';}
    else if(active) result[active]+=`${line}\n`;
  }
  return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,value.trim()]));
};
function draftQuestion(unit:string,number:number,lessonIndex:number,variant:number):InterviewQuestion {
  const lesson=expandedLessons.filter(item=>item.unit===unit)[lessonIndex];
  const source=sections(lessonText[lesson.id]??'');
  const pattern=patterns[variant%patterns.length];
  const id=`U${unit}-Q${String(number).padStart(3,'0')}`;
  const unitQuestions=targetByUnit[unit];
  const nextId=`U${unit}-Q${String(number===unitQuestions?1:number+1).padStart(3,'0')}`;
  const hardId=`U${unit}-Q${String(number+2>unitQuestions?((number+1)%unitQuestions)+1:number+2).padStart(3,'0')}`;
  const mechanism=source['internal operation']||lesson.internals;
  const lifecycle=source['execution lifecycle']||lesson.lifecycle;
  const example=source['worked example 1']||source['worked example and calculation']||lesson.exercise;
  const tradeoffs=source['alternatives and decision boundary']||source['tradeoffs']||lesson.alternatives;
  const failure=source['failure analysis']||lesson.failure;
  const debugging=source['debugging procedure']||lesson.debugging;
  const exercise=source['practical exercise']||lesson.exercise;
  const prompt=pattern.stem(lesson.title)+(unit==='10'?` Case constraint: ${exercise}`:'');
  const answer=[
    `Assumptions and boundary: ${lesson.title} solves ${lesson.purpose.toLowerCase()} Treat the stated workload as evidence to verify, not as a promise that a managed service removes application or data responsibility. State request rate, runtime, latency, availability, state, security, and downstream limits before choosing a parameter.`,
    `Mechanism: ${mechanism||lesson.definition||lesson.purpose} The lifecycle is: ${lifecycle||'accept work, allocate the required compute, execute with bounded resources, observe the outcome, and preserve or safely retry unfinished work.'}`,
    `Worked reasoning: ${example||`Use a representative load test, calculate work in consistent units, measure useful throughput per worker, and keep headroom for retries and a defined failure domain.`} If a calculation is requested, show the equation and convert milliseconds to seconds before multiplying rate by duration. Keep average and peak separate.`,
    `Tradeoff and failure plan: ${tradeoffs||'Compare a managed option with a more controllable option using lifecycle, scale delay, security boundary, and total operating cost.'} Watch for ${failure||'capacity exhaustion, repeated retries, unhealthy replacement loops, and a dependency limit that compute scaling cannot fix.'}`,
    `Validation: ${debugging||'Correlate request rate, latency percentiles, errors, desired and healthy capacity, and dependency saturation on one timeline.'} Run a canary, inject one failure, and verify customer-facing SLO recovery before rollout. A strong interview answer names the evidence that would change its recommendation.`
  ].join('\n\n');
  const explanation=`Pehle ${lesson.title} ko workload language mein translate karo: kaam, rate, duration, state, aur dependency limit likho. ${lesson.purpose} Mechanism ko request se result tak trace karo. Calculation estimate hoti hai; load test aur failure drill se validate karo. Agar downstream limit hit ho, compute aur badhane se incident worse ho sakta hai.`;
  const concepts=[lesson.title,lesson.unit?`AWS Compute Unit ${lesson.unit}`:'AWS compute',pattern.type];
  return {
    id,lesson:lesson.id,unit:lesson.unit!,topic:lesson.title,difficulty:variant===0?'Foundation':variant>=4?'Defense':'Applied',mode:pattern.mode,
    prompt,answer,explanation,
    rubric:[`Explains the ${lesson.title} mechanism and its AWS/customer ownership boundary.`,`States assumptions and uses correct units or configuration semantics.`,`Names a failure mode, a safe mitigation, and evidence that validates the decision.`],
    mistakes:[failure||`Treating ${lesson.title} as a feature name without tracing lifecycle and failure behavior.`,`Scaling or increasing retries before checking the downstream capacity budget.`],
    hint:`Start with ${lesson.purpose.toLowerCase()} Then trace one request/job through its lifecycle.`,
    followUp:`What measurement would prove this design meets its latency and recovery target?`,sources:lesson.sources,concepts,
    difficultyLevel:pattern.level as 1|2|3|4|5,assessmentType:pattern.type,learningObjective:lesson.purpose,
    scenario:lesson.unit==='10'?`Architecture defense case: ${lesson.title}. ${exercise}`:`Production interview scenario for ${lesson.title}: ${lesson.purpose}`,
    assumptions:['Treat numerical values in the prompt as examples; identify missing measurements.','Use current documented AWS behavior for the named service and Region.'],
    followUps:[nextId,hardId],prerequisites:[lesson.prerequisite],revisionNotes:[lesson.id]
  };
}

export const expandedQuestions: InterviewQuestion[] = modules.flatMap(module=>{
  const unit=module.unit;
  const target=targetByUnit[unit]??0;
  const chapterCount=module.chapters.length;
  const base=Math.floor(target/chapterCount),remainder=target%chapterCount;
  let number=0;
  return module.chapters.flatMap((chapter,index)=>Array.from({length:base+(index<remainder?1:0)},(_,local)=>{
    number++;
    return draftQuestion(unit,number,index,local);
  }));
});

export function questionDepthReport(){return modules.map(module=>{
  const lessonIds=new Set(module.chapters.map(c=>c.id));
  const qs=expandedQuestions.filter(q=>q.unit===module.unit);
  return {unit:module.unit,title:module.title,lessons:lessonIds.size,questions:qs.length,meanAnswerWords:Math.round(qs.reduce((n,q)=>n+wordCount(q.answer),0)/Math.max(1,qs.length))};
});}
