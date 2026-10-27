import { useEffect, useState } from 'react';

export function StudyExercise({id,prompt,checks,starterCode,savedAnswer,savedCode,ready,onSave}:{id:string;prompt:string;checks:string[];starterCode:string;savedAnswer:string;savedCode:string;ready:boolean;onSave:(key:string,value:string)=>void}) {
  const [answer,setAnswer]=useState(savedAnswer);
  const [code,setCode]=useState(starterCode);
  const [checked,setChecked]=useState<boolean[]>([]);
  const [solutionShown,setSolutionShown]=useState(false);
  useEffect(()=>{setAnswer(savedAnswer);setCode(savedCode||starterCode);setChecked([]);setSolutionShown(false)},[id,ready]);
  const reviewChecks=checks.length?checks:['State the assumptions and units.','Show the mechanism or calculation, not only the chosen service.','Name one failure case and one way to validate the design.'];
  return <section className="panel unit-exercise" aria-labelledby={`exercise-${id}`}>
    <p className="eyebrow">Implement · experiment · debug</p><h3 id={`exercise-${id}`}>Work this lesson</h3>
    <p>{prompt||'Use the lesson examples to write a design, implementation, and validation plan.'}</p>
    <label htmlFor={`code-${id}`}>Editable configuration or code starter</label>
    <textarea id={`code-${id}`} className="exercise-code" spellCheck={false} value={code} onChange={event=>{setCode(event.target.value);onSave(`exercise-code:${id}`,event.target.value)}} />
    <label htmlFor={`answer-${id}`}>Your implementation, calculation, or debugging notes</label>
    <textarea id={`answer-${id}`} value={answer} onChange={event=>{setAnswer(event.target.value);onSave(`exercise-answer:${id}`,event.target.value)}} placeholder="Write steps, assumptions, expected output, and failure check." />
    <button type="button" disabled={answer.trim().length<30} onClick={()=>setSolutionShown(true)}>Reveal checks</button>
    {solutionShown&&<div className="rubric-checks"><p>Self-check. These checks are not semantic grading.</p>{reviewChecks.map((item,index)=><label key={item}><input type="checkbox" checked={checked[index]??false} onChange={event=>setChecked(old=>{const next=old.slice();next[index]=event.target.checked;return next})}/>{item}</label>)}</div>}
  </section>;
}
