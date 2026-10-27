import { useEffect, useState } from 'react';
import { lessons } from './content';
import { firstInterviewQuestion, nextInterviewQuestion, sessionPool, type SessionResult } from './interview';
import type { InterviewQuestion } from './questions';

type Grade = { id: string; score: number; missed: string[] };
export function InterviewSession({onAttempt,onFinish,missedQuestionIds=[]}:{onAttempt:(id:string,answer:string,score:number)=>void;onFinish:(result:SessionResult)=>void;missedQuestionIds?:string[]}) {
  const [topic,setTopic] = useState('all');
  const [difficulty,setDifficulty] = useState(3);
  const [size,setSize] = useState(10);
  const [timeLimit,setTimeLimit] = useState(0);
  const [remainingSeconds,setRemainingSeconds] = useState<number|null>(null);
  const [current,setCurrent] = useState<InterviewQuestion>();
  const [answer,setAnswer] = useState('');
  const [revealed,setRevealed] = useState(false);
  const [checked,setChecked] = useState<boolean[]>([]);
  const [grades,setGrades] = useState<Grade[]>([]);
  const [finished,setFinished] = useState<SessionResult>();
  const pool = sessionPool(topic,missedQuestionIds);
  const effectiveSize = Math.min(size,pool.length);
  const begin = () => { const first = pool.slice().sort((a,b)=>Math.abs(a.difficultyLevel-difficulty)-Math.abs(b.difficultyLevel-difficulty)||a.id.localeCompare(b.id))[0]; setCurrent(first); setGrades([]); setAnswer(''); setRevealed(false); setChecked([]); setFinished(undefined); setRemainingSeconds(timeLimit || null); };
  useEffect(() => { if (!current || revealed || remainingSeconds === null || remainingSeconds <= 0) return; const timer=window.setInterval(()=>setRemainingSeconds(value=>value===null?null:Math.max(0,value-1)),1000); return ()=>window.clearInterval(timer); },[current,revealed,remainingSeconds]);
  const advance = () => {
    if (!current) return;
    const score = checked.filter(Boolean).length;
    const missed = current.rubric.filter((_,i)=>!checked[i]);
    onAttempt(current.id,answer,score);
    const updated = [...grades,{id:current.id,score,missed}];
    setGrades(updated);
    const seen = updated.map(g=>g.id);
    if (updated.length >= effectiveSize || seen.length >= pool.length || remainingSeconds === 0) {
      const result:SessionResult = {at:new Date().toISOString(),topic,size:effectiveSize,answered:updated.length,averageScore:Number((updated.reduce((n,g)=>n+g.score,0)/updated.length).toFixed(2)),missed:[...new Set(updated.flatMap(g=>g.missed))],questionIds:seen};
      onFinish(result); setFinished(result); setCurrent(undefined); return;
    }
    setCurrent(nextInterviewQuestion(current,score,seen,pool)); setAnswer(''); setRevealed(false); setChecked([]);
  };
  return <section className="panel mock-session">
    <h3>Mock interview</h3><p>Answer in English. Compare against model answer. Check rubric items yourself; app uses your checks to choose next curated question. No semantic or AI grading.</p>
    {!current && !finished && <div className="form-grid"><label>Interview pool<select value={topic} onChange={e=>{const selected=e.target.value;setTopic(selected);setSize(Math.min(10,sessionPool(selected,missedQuestionIds).length))}}><option value="all">Mixed technical interview</option><option value="missed">Missed-question revision ({missedQuestionIds.length})</option>{['01','02','03','04','05','06','07','08','09','10'].map(unit=><option key={unit} value={`unit:${unit}`}>Unit {unit} interview</option>)}<optgroup label="Topic interview">{lessons.map(l=><option key={l.id} value={l.id}>{l.title}</option>)}</optgroup><optgroup label="Question type">{['Architecture and service choice','Production debugging','Numerical engineering','Code and configuration','Choose between technologies'].map(mode=><option key={mode} value={`mode:${mode}`}>{mode}</option>)}</optgroup></select></label><label>Starting difficulty<select value={difficulty} onChange={e=>setDifficulty(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}/5</option>)}</select></label><label>Session length<select value={effectiveSize} onChange={e=>setSize(Number(e.target.value))}>{(pool.length<5?[pool.length]:[5,10,20,40].filter(n=>n<=pool.length)).map(n=><option key={n} value={n}>{n} questions</option>)}</select></label><label>Time limit<select value={timeLimit} onChange={e=>setTimeLimit(Number(e.target.value))}><option value={0}>Untimed</option><option value={1200}>20 minutes</option><option value={2400}>40 minutes</option></select></label><button className="primary" type="button" disabled={!pool.length} onClick={begin}>Start interview</button>{!pool.length&&<p>No questions in this pool yet. Missed-question revision appears after scoring an answer below 2/3.</p>}</div>}
    {current && <><p className="eyebrow">Question {grades.length+1} / {effectiveSize} · {current.id} · difficulty {current.difficultyLevel}/5{remainingSeconds!==null&&` · ${Math.floor(remainingSeconds/60)}:${String(remainingSeconds%60).padStart(2,'0')} left`}</p>{remainingSeconds===0&&<p role="status" className="result">Time ended. Finish this answer, then submit your self-score to end session.</p>}<h4>{current.prompt}</h4><p><strong>Assessment:</strong> {current.assessmentType}</p>{!revealed?<><label htmlFor="mock-answer">Your answer</label><textarea id="mock-answer" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="State assumptions, mechanism, tradeoffs, and validation." /><button className="primary" type="button" disabled={answer.trim().length<20} onClick={()=>{setRevealed(true);setChecked(current.rubric.map(()=>false))}}>Compare with answer</button></>:<><h4>Model answer</h4><p>{current.answer}</p><h4>Hinglish explanation</h4><p>{current.explanation}</p><h4>Mark what your answer covered</h4><div className="rubric-checks">{current.rubric.map((criterion,i)=><label key={criterion}><input type="checkbox" checked={checked[i]??false} onChange={e=>setChecked(old=>old.map((v,j)=>j===i?e.target.checked:v))} />{criterion}</label>)}</div><h4>Common mistakes</h4><ul>{current.mistakes.map(x=><li key={x}>{x}</li>)}</ul><p><strong>Follow-up paths:</strong> {current.followUps.join(' / ')}. Score below 2 follows diagnostic path; 2–3 follows harder/changed constraint path, unless question already used.</p><button className="primary" type="button" onClick={advance}>{grades.length+1>=effectiveSize||remainingSeconds===0?'Finish interview':'Next question →'}</button></>}</>}
    {finished && <><h4>Assessment</h4><p>{finished.answered} questions. Average rubric items met: {finished.averageScore}/3. Sequence: {finished.questionIds.join(' → ')}.</p><h4>Missed concepts / criteria</h4>{finished.missed.length?<ul>{finished.missed.map(x=><li key={x}>{x}</li>)}</ul>:<p>All rubric items self-marked complete. Recheck answers against sources before claiming mastery.</p>}<p>Saved in this browser. Revisit lessons linked from questions you missed.</p><button type="button" onClick={()=>setFinished(undefined)}>New session</button></>}
  </section>;
}
