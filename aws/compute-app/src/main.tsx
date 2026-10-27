import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import { lessons, units, type Lesson } from './content';
import { lessonText } from './lessonText';
import { emptyState, loadState, saveState, validState, type StudyState } from './db';
import { questions } from './questions';
import { InterviewSession } from './InterviewSession';
import { AnimationPlayer, animations } from './AnimationPlayer';
import { LambdaSimulator } from './LambdaSimulator';
import { StudyExercise } from './StudyExercise';
import { CostSimulator } from './CostSimulator';
import { defaults, evaluate, type Inputs } from './simulator';
import sourcesData from './sources.json';
import extraSourceData from './content/aws-compute/sources.json';
import './styles.css';

type View = 'index' | 'learn' | 'decision' | 'lambdaLab' | 'architecture' | 'practice' | 'mock' | 'sources' | 'progress';
type Mode = 'Learn' | 'Deep Dive' | 'Interview' | 'Reference';
type Source = (typeof sourcesData.sources)[number] & { researchStatus?: 'reviewed' | 'indexed' | 'discovered' };
const researchedIds = new Set(['compute','containers','lambda-fargate','purchasing','wellarchitected-review','ec2-instance-types','ec2-launch-template','ec2-asg','ec2-alb','ecs-services','ecs-deployments','eks-architecture','eks-compute','eks-kubernetes','apprunner-guide','apprunner-availability','batch-user-guide']);
const sources = [...sourcesData.sources.map(source=>({...source,researchStatus:researchedIds.has(source.id)?'reviewed' as const:'indexed' as const})), ...extraSourceData.map(([id,title,url]) => ({id,title,url,parentGuide:null,status:'discovered',researchStatus:'discovered' as const,lastUpdated:null,retrievedAt:'2026-10-27',concepts:[],lessons:[],headings:[],discoveredLinks:[]}))] as Source[];
const Architecture = lazy(() => import('./ArchitectureCanvas').then(module => ({ default: module.Architecture })));
const sourceById = Object.fromEntries(sources.map(source => [source.id, source]));
const fields: [keyof Lesson, string][] = [
  ['problem','Problem'],['definition','Definition'],['intuition','Intuition'],['internals','Internals'],['lifecycle','Lifecycle'],['implementation','Implementation'],['alternatives','Alternatives'],['tradeoffs','Tradeoffs'],['failure','Failure modes'],['debugging','Debugging'],['production','Production considerations']
];
function chapterSection(text: string, title: string) {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line.trim() === `## ${title}`);
  if (start < 0) return '';
  const end = lines.findIndex((line,index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}
function sourceLink(id: string) {
  const source = sourceById[id];
  return source ? <a href={source.url} target="_blank" rel="noopener noreferrer" key={id}>{source.title} ↗</a> : null;
}
function App() {
  const [view, setView] = useState<View>('index');
  const [lessonId, setLessonId] = useState(lessons[0].id);
  const [mode, setMode] = useState<Mode>('Learn');
  const [state, setState] = useState<StudyState>(emptyState);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceId, setSourceId] = useState('compute');
  const [inputs, setInputs] = useState<Inputs>(defaults);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [hint, setHint] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const lesson = lessons.find(item => item.id === lessonId) ?? lessons[0];
  const availableLessons = lessons.filter(item => Boolean(lessonText[item.id]?.trim()));
  const unitCoverage = units.map(([number,title]) => {
    const planned = lessons.filter(item => (item.unit??'01') === number);
    const authored = planned.filter(item => Boolean(lessonText[item.id]?.trim()));
    return { number,title,planned:planned.length,authored:authored.length,questionCount:questions.filter(question=>question.unit===number).length,first:authored[0] };
  });
  const question = questions[questionIndex];
  const match = useMemo(() => availableLessons.filter(item => (item.title + Object.values(item).join(' ')).toLowerCase().includes(search.toLowerCase())), [search, ready]);
  useEffect(() => { loadState().then(value => { setState(value); setReady(true); }); }, []);
  useEffect(() => { if (ready) saveState(state).catch(() => {}); }, [state, ready]);
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/aws/compute/sw.js').catch(() => {}); }, []);
  useEffect(() => { if (view !== 'practice' || submitted) return; const timer = window.setInterval(() => setSeconds(value => value + 1), 1000); return () => window.clearInterval(timer); }, [view, submitted, questionIndex]);
  const go = (next: View) => { setView(next); window.scrollTo(0, 0); };
  const openLesson = (id: string) => { if (!lessons.some(item=>item.id===id)) return; setLessonId(id); setMode('Learn'); go('learn'); };
  const moveQuestion = (next: number) => { setQuestionIndex((next + questions.length) % questions.length); setAnswer(''); setSubmitted(false); setHint(false); setSeconds(0); };
  const openQuestion = (id: string) => { const index = questions.findIndex(q => q.id === id); if (index >= 0) { moveQuestion(index); go('practice'); } };
  const toggle = (key: 'completed' | 'bookmarks', id: string) => setState(current => ({ ...current, [key]: current[key].includes(id) ? current[key].filter(value => value !== id) : [...current[key], id] }));
  const score = (value: number) => setState(current => ({ ...current, attempts: { ...current.attempts, [question.id]: { answer, selfScore: value, at: new Date().toISOString() } } }));
  const exportData = () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'compute-study-backup.json'; link.click(); URL.revokeObjectURL(link.href); };
  const exportMarkdown = () => { const content = ['# AWS Compute study notes', '', ...lessons.flatMap(item => [`## ${item.title}`, '', item.purpose, '', ...item.quick.map(point => `- ${point}`), '', '### My note', '', state.notes[item.id] || '(No personal note yet.)', ''])].join('\n'); const blob = new Blob([content], { type: 'text/markdown' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'compute-study-notes.md'; link.click(); URL.revokeObjectURL(link.href); };
  const importData = async (file?: File) => { if (!file) return; try { const value: unknown = JSON.parse(await file.text()); if (!validState(value)) throw new Error('Invalid backup'); setState(value); window.alert('Backup restored.'); } catch { window.alert('This file is not a valid Compute study backup.'); } };
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-');
  const markdown = (value: string) => <ReactMarkdown components={{h2:({children})=><h2 id={slug(String(children))}>{children}</h2>}}>{value}</ReactMarkdown>;
  return <div className="app-shell">
    <a className="skip" href="#main">Skip to content</a>
    <header className="topbar"><a href="../" className="back">← AWS Notes</a><span className="brand">ENGINEERING INTERVIEW LAB <span>/ AWS COMPUTE</span></span><span className="top-count">{state.completed.length}/{availableLessons.length} written lessons</span></header>
    <div className="layout">
      <aside className="sidebar" aria-label="Compute navigation">
        <p className="eyebrow">AWS / Module 01</p><h1>AWS Compute</h1><p className="sidebar-copy">Study the service boundary. Then defend a design.</p>
        <nav className="main-nav" aria-label="Module sections">
          {([['index','Index'],['learn','Learn'],['decision','Decision lab'],['lambdaLab','Lambda lab'],['architecture','Architecture'],['practice','Question bank'],['mock','Mock interview'],['sources','Sources'],['progress','Progress']] as [View,string][]).map(([key,label]) => <button type="button" key={key} className={view===key?'active':''} onClick={()=>go(key)}>{label}</button>)}
        </nav>
        <div className="sidebar-lessons"><label htmlFor="lesson-search">Find a lesson</label><input id="lesson-search" type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search lessons" /><ol>{match.map(item => <li key={item.id}><button type="button" className={view==='learn'&&lessonId===item.id?'selected':''} onClick={()=>openLesson(item.id)}><span>{item.title}</span>{state.completed.includes(item.id) && <small aria-label="Complete">✓</small>}</button></li>)}</ol>{match.length===0 && <p>No matching lesson.</p>}</div>
      </aside>
      <main id="main" className="content">
        {view==='index' && <>
        <p className="eyebrow">Course index</p><h2 className="page-title">AWS Compute</h2><p className="lead">Ten-unit study path: compute internals, operating models, infrastructure, economics, and architecture defense. Availability below counts written chapters only. All expanded units remain drafts until depth, technical review, sources, exercises, and interview coverage pass the course checks.</p>
          <div className="index-actions"><button type="button" className="primary" onClick={()=>openLesson('workload')}>Start Unit 1 →</button><button type="button" onClick={()=>go('practice')}>Practice {questions.length} questions</button><button type="button" onClick={()=>go('mock')}>Start mock interview</button></div>
          <section className="panel"><h3>Units</h3><ol className="unit-list">{unitCoverage.map(({number,title,planned,authored,questionCount,first})=><li key={number}><span className="unit-number">{number}</span><span><strong>{title}</strong><small>{authored}/{planned} chapters written · {questionCount} interview questions · Draft; review pending</small></span><button type="button" onClick={()=>first&&openLesson(first.id)} disabled={!first}>{first?'Open →':'No chapter text yet'}</button></li>)}</ol></section>
          <section className="panel"><h3>Available reading</h3><ol className="reading-list">{availableLessons.filter(item=>item.unit==='01').map((item,index)=><li key={item.id}><button type="button" onClick={()=>openLesson(item.id)}><span>{String(index+1).padStart(2,'0')}</span><strong>{item.title}</strong><small>{item.purpose}</small></button></li>)}</ol></section>
          <section className="panel"><h3>Unit 3 · Lambda visual lesson</h3><p>Trace Init, Invoke, warm reuse, concurrency, and database pressure. The video pauses four times for predictions; then change assumptions in a separate lab and defend a harder design question.</p><button type="button" className="primary" onClick={()=>openLesson('lambda-lifecycle')}>Open Lambda lifecycle →</button></section>
          <section className="panel"><h3>How to study</h3><p>Read one lesson. Run its exercise. Use the Decision lab or Architecture canvas to test a choice. In Question bank, type an answer before you see the model answer. Score yourself against the visible rubric.</p><p>The lessons use Roman Hinglish. Interview questions and model answers use English.</p></section>
        </>}
        {view==='learn' && <>
          <p className="eyebrow">Unit {lesson.unit??'01'} / Lesson {availableLessons.filter(item=>(item.unit??'01')===(lesson.unit??'01')).findIndex(item=>item.id===lesson.id)+1} of {availableLessons.filter(item=>(item.unit??'01')===(lesson.unit??'01')).length} written chapters</p><h2 className="page-title">{lesson.title}</h2><p className="lead">{lesson.purpose}</p><p className="prerequisite">Prerequisite: {lesson.prerequisite}</p>
          <div className="mode-tabs" role="tablist" aria-label="Reading mode">{(['Learn','Deep Dive','Interview','Reference'] as Mode[]).map(item=><button role="tab" aria-selected={mode===item} key={item} className={mode===item?'active':''} onClick={()=>setMode(item)}>{item}</button>)}</div>
          {mode==='Learn' && (
            lessonText[lesson.id]?.trim() ? <>
              {animations.filter(item=>item.lessonId===lesson.id).map(animation=><AnimationPlayer key={animation.id} animation={animation} onQuestion={openQuestion} onLab={lesson.id==='lambda-lifecycle'?()=>go('lambdaLab'):undefined} />)}
              <article className="lesson-prose textbook">{markdown(lessonText[lesson.id] ?? '')}</article>
              <StudyExercise id={lesson.id} prompt={lesson.exercise} checks={lesson.exerciseCheck} starterCode={lesson.code} savedAnswer={state.notes[`exercise-answer:${lesson.id}`]??''} savedCode={state.notes[`exercise-code:${lesson.id}`]??lesson.code} ready={ready} onSave={(key,value)=>setState(current=>({...current,notes:{...current.notes,[key]:value}}))} />
              {lesson.id==='cost-foundations'&&<CostSimulator />}
              {lesson.id==='runtime'&&<p className="exercise-files">Local exercise files: <a href="/aws/compute/exercises/container-starter/server.mjs" download>server.mjs</a> · <a href="/aws/compute/exercises/container-starter/Dockerfile" download>Dockerfile</a> · <a href="/aws/compute/exercises/container-starter/README.txt" download>instructions</a></p>}
            </> : <section className="panel"><p className="eyebrow">Planned chapter · not authored</p><h3>{lesson.title}</h3><p>This chapter is in the course outline. Its learning text is not written yet, so the page is not marked complete. Return to the index to open a written chapter.</p><button type="button" onClick={()=>go('index')}>Back to course index</button></section>
          )}
          {mode==='Deep Dive' && <div className="lesson-prose">{fields.filter(([key])=>['internals','alternatives','tradeoffs','failure','debugging','production'].includes(key)).map(([key,title])=><section className="text-section" key={key}><h3>{title}</h3>{markdown(String(lesson[key]))}</section>)}</div>}
          {mode==='Interview' && <section className="panel"><h3>Questions for this lesson</h3><ol className="question-links">{questions.filter(item=>item.lesson===lesson.id).map(item=><li key={item.id}><button type="button" onClick={()=>openQuestion(item.id)}><span>{item.id} · {item.difficulty}</span><strong>{item.prompt}</strong></button></li>)}</ol></section>}
          {mode==='Reference' && <section className="panel reference-notes"><h3>Definitions</h3>{markdown(lesson.definition)}<h3>Quick reference</h3>{markdown(chapterSection(lessonText[lesson.id] ?? '', 'Quick reference'))}<h3>Failure pattern</h3>{markdown(lesson.failure)}<h3>Diagnostic sequence</h3>{markdown(lesson.debugging)}<h3>Worksheet / configuration example</h3><pre><code>{lesson.code}</code></pre><p>Exact service limits and supported settings: see cited AWS docs below.</p></section>}
          <section className="panel study-tools"><h3>My study record</h3><div className="button-row"><button type="button" disabled={!lessonText[lesson.id]?.trim()} onClick={()=>toggle('completed',lesson.id)}>{state.completed.includes(lesson.id)?'✓ Marked complete':'Mark complete'}</button><button type="button" onClick={()=>toggle('bookmarks',lesson.id)}>{state.bookmarks.includes(lesson.id)?'★ Bookmarked':'☆ Bookmark'}</button></div><label htmlFor="lesson-note">My note</label><textarea id="lesson-note" value={state.notes[lesson.id]??''} onChange={event=>setState(current=>({...current,notes:{...current.notes,[lesson.id]:event.target.value}}))} placeholder="Write your own example or question here." /><small>Saved in this browser with IndexedDB.</small></section>
          <section className="sources-inline"><h3>Sources</h3><ul>{lesson.sources.map(id=><li key={id}>{sourceLink(id)}</li>)}</ul></section>
          <div className="next-lesson">{availableLessons.indexOf(lesson)<availableLessons.length-1&&<button type="button" className="primary" onClick={()=>openLesson(availableLessons[availableLessons.indexOf(lesson)+1].id)}>Next: {availableLessons[availableLessons.indexOf(lesson)+1].title} →</button>}</div>
        </>}
        {view==='decision' && <>
          <p className="eyebrow">Interactive playground / 01</p><h2 className="page-title">Compute Decision Lab</h2><p className="lead">Change workload facts. Compare candidates and read why each score changes. This is a learning heuristic, not an AWS recommendation or price quote.</p>
          <div className="form-grid">
            <label>Requests per second<input type="number" min="0" max="100000" value={inputs.rps} onChange={e=>setInputs({...inputs,rps:Number(e.target.value)})} /></label>
            <label>Request duration (seconds)<input type="number" min="0.01" max="3600" step="0.01" value={inputs.requestSeconds} onChange={e=>setInputs({...inputs,requestSeconds:Number(e.target.value)})} /></label>
            <label>Work duration (minutes)<input type="number" min="0.01" max="1440" step="0.01" value={inputs.workMinutes} onChange={e=>setInputs({...inputs,workMinutes:Number(e.target.value)})} /></label>
            <label>Memory per worker (GB)<input type="number" min="0.1" max="512" step="0.1" value={inputs.memoryGb} onChange={e=>setInputs({...inputs,memoryGb:Number(e.target.value)})} /></label>
            <label>CPU need<select value={inputs.cpu} onChange={e=>setInputs({...inputs,cpu:e.target.value as Inputs['cpu']})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High or specialized</option></select></label>
            <label>Traffic<select value={inputs.variability} onChange={e=>setInputs({...inputs,variability:e.target.value as Inputs['variability']})}><option value="bursty">Bursty</option><option value="steady">Steady</option></select></label>
            <label>Latency<select value={inputs.latency} onChange={e=>setInputs({...inputs,latency:e.target.value as Inputs['latency']})}><option value="strict">Strict</option><option value="flexible">Flexible</option></select></label>
            <label>Team size<input type="number" min="1" max="100" value={inputs.teamSize} onChange={e=>setInputs({...inputs,teamSize:Number(e.target.value)})} /></label>
            <label>Estimated utilization (%)<input type="number" min="0" max="100" value={inputs.utilization} onChange={e=>setInputs({...inputs,utilization:Number(e.target.value)})} /></label>
            <label className="check"><input type="checkbox" checked={inputs.background} onChange={e=>setInputs({...inputs,background:e.target.checked})} /> Background work</label>
            <label className="check"><input type="checkbox" checked={inputs.interruptible} onChange={e=>setInputs({...inputs,interruptible:e.target.checked})} /> Interruption tolerated</label>
            <label className="check"><input type="checkbox" checked={inputs.persistentConnections} onChange={e=>setInputs({...inputs,persistentConnections:e.target.checked})} /> Persistent connections</label>
            <label className="check"><input type="checkbox" checked={inputs.costSensitive} onChange={e=>setInputs({...inputs,costSensitive:e.target.checked})} /> Cost sensitive</label>
          </div>
          <p className="assumption">Estimated in-flight work: <strong>{(inputs.rps*inputs.requestSeconds).toFixed(1)}</strong>. Assumes standard on-demand Lambda Event Functions, one Region, no exact service pricing, and no automatic downstream scaling. Scores are relative classroom rules.</p>
          <div className="candidate-list">{evaluate(inputs).map((item,index)=><article className="panel candidate" key={item.name}><div className="candidate-head"><span>{index+1}</span><h3>{item.name}</h3><small>Rule score {item.score}</small></div><strong>Why it may fit</strong><ul>{item.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul><strong>Check before choosing</strong><ul>{item.cautions.map(caution=><li key={caution}>{caution}</li>)}</ul><div className="mini-sources">{item.docs.map(sourceLink)}</div></article>)}</div>
        </>}
        {view==='lambdaLab' && <><p className="eyebrow">Interactive simulator / Lambda</p><h2 className="page-title">Change the assumptions</h2><LambdaSimulator /><div className="button-row"><button type="button" onClick={()=>openLesson('lambda-lifecycle')}>Return to animation</button><button type="button" className="primary" onClick={()=>openQuestion('L01')}>Defend in interview →</button></div></>}
        {view==='architecture' && <><Suspense fallback={<p>Loading architecture canvas…</p>}><Architecture /></Suspense><section className="panel"><h3>Defense prompts</h3><ol><li>Which AZ can serve the full load after one AZ fails?</li><li>How does the database fail over? What are RTO and RPO?</li><li>Which security group rules and IAM roles are needed?</li><li>What happens during a bad deployment?</li></ol></section></>}
        {view==='practice' && <>
          <p className="eyebrow">Interview / question {questionIndex+1} of {questions.length}</p><h2 className="page-title">Technical interview</h2><p className="lead">Answer first. Then compare your response with the rubric and model answer. Your self-score is saved locally.</p>
          <div className="question-nav"><button type="button" onClick={()=>moveQuestion(questionIndex-1)}>← Previous</button><span>{question.id} · {question.mode} · {question.difficulty}</span><button type="button" onClick={()=>moveQuestion(questionIndex+1)}>Next →</button></div>
          <section className="panel interview-card"><h3>{question.prompt}</h3><p className="timer">Time on question: {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</p>{!submitted&&<><button type="button" className="text-button" onClick={()=>setHint(!hint)}>{hint?'Hide hint':'Show hint'}</button>{hint&&<p className="hint">{question.hint}</p>}<label htmlFor="interview-answer">Your answer</label><textarea id="interview-answer" value={answer} onChange={event=>setAnswer(event.target.value)} placeholder="Explain your reasoning in English." /><button type="button" className="primary" onClick={()=>setSubmitted(true)} disabled={answer.trim().length<20}>Submit answer</button><small>At least 20 characters required. No automatic semantic grade is claimed.</small></>}
          {submitted&&<div className="reveal"><h4>Your answer</h4><p>{answer}</p><h4>Model answer</h4><p>{question.answer}</p><h4>Explanation</h4><p>{question.explanation}</p><h4>Rubric</h4><ul>{question.rubric.map(item=><li key={item}>{item}</li>)}</ul><h4>Common mistakes</h4><ul>{question.mistakes.map(item=><li key={item}>{item}</li>)}</ul><h4>Follow-up</h4><p>{question.followUp}</p><div className="button-row">{question.followUps.map(id=><button key={id} type="button" onClick={()=>openQuestion(id)}>Answer {id} →</button>)}</div><div className="button-row"><span>Self-score:</span>{[0,1,2,3].map(value=><button key={value} type="button" onClick={()=>score(value)} aria-pressed={state.attempts[question.id]?.selfScore===value}>{value}/{question.rubric.length}</button>)}</div><button type="button" className="text-button" onClick={()=>openLesson(question.lesson)}>Review linked lesson →</button><p className="mini-sources">{question.sources.map(sourceLink)}</p></div>}</section>
          <section className="panel"><h3>Question bank</h3><div className="question-bank">{questions.map((item,index)=><button key={item.id} type="button" className={questionIndex===index?'selected':''} onClick={()=>moveQuestion(index)}><strong>{item.id}</strong><span>{item.lesson} · {item.difficulty}</span>{state.attempts[item.id]&&<small>Scored {state.attempts[item.id].selfScore ?? '—'}</small>}</button>)}</div></section>
        </>}
        {view==='mock' && <><p className="eyebrow">Interview / guided sequence</p><h2 className="page-title">Mock interview</h2><InterviewSession missedQuestionIds={Object.entries(state.attempts).filter(([,attempt])=>attempt.selfScore!==null&&attempt.selfScore<2).map(([id])=>id)} onAttempt={(id,response,grade)=>setState(current=>({...current,attempts:{...current.attempts,[id]:{answer:response,selfScore:grade,at:new Date().toISOString()}}}))} onFinish={result=>setState(current=>({...current,sessions:[...(current.sessions??[]),result]}))} /></>}
        {view==='sources' && <><p className="eyebrow">Research registry</p><h2 className="page-title">Source map</h2><p className="lead">Six AWS Decision Guides and supporting AWS documentation pages. Direct links open the current source. The guide map records full heading hierarchies and deduplicated AWS links discovered in each guide.</p><div className="source-layout"><nav aria-label="Sources" className="source-list">{sources.map(item=><button key={item.id} type="button" className={sourceId===item.id?'selected':''} onClick={()=>setSourceId(item.id)}>{item.title}</button>)}</nav><SourceDetail source={sourceById[sourceId]} /></div><section className="panel"><h3>Decision-guide videos</h3><p>Eight guide videos indexed. Five English auto-caption tracks were fetched and checked for study points; three caption downloads hit HTTP 429. Video notes support the chapters, while current AWS docs remain technical authority.</p><ul>{sourcesData.videos.map(video=><li key={video.url}><a href={video.url} target="_blank" rel="noopener noreferrer">{video.title}</a> · {video.captions}{video.takeaway&&<><br />Study point: {video.takeaway}</>}</li>)}</ul></section></>}
        {view==='progress' && <><p className="eyebrow">Local study record</p><h2 className="page-title">Progress and coverage</h2><p className="lead">Your notes, bookmarks, completions, exercises, and interview self-scores stay in this browser. Export a backup before clearing browser data.</p><section className="stats"><div><strong>{state.completed.filter(id=>availableLessons.some(item=>item.id===id)).length}/{availableLessons.length}</strong><span>Written lessons</span></div><div><strong>{Object.keys(state.attempts).length}/{questions.length}</strong><span>Questions scored</span></div><div><strong>{state.bookmarks.length}</strong><span>Bookmarked lessons</span></div></section><section className="panel"><h3>My bookmarks</h3>{state.bookmarks.length?<ul>{state.bookmarks.map(id=><li key={id}><button type="button" className="text-button" onClick={()=>openLesson(id)}>{lessons.find(item=>item.id===id)?.title??id}</button></li>)}</ul>:<p>No bookmarks yet.</p>}<div className="button-row"><button type="button" onClick={exportData}>Export JSON backup</button><button type="button" onClick={exportMarkdown}>Export Markdown notes</button><button type="button" onClick={()=>importRef.current?.click()}>Restore JSON backup</button><input className="visually-hidden" ref={importRef} type="file" accept="application/json" onChange={event=>importData(event.target.files?.[0])} /></div></section><section className="panel"><h3>Interview history</h3>{Object.keys(state.attempts).length?<ul>{Object.entries(state.attempts).sort((a,b)=>b[1].at.localeCompare(a[1].at)).map(([id,attempt])=><li key={id}><button type="button" className="text-button" onClick={()=>openQuestion(id)}>{id}</button> · {attempt.selfScore}/3 · {new Date(attempt.at).toLocaleDateString()}</li>)}</ul>:<p>No scored answers yet.</p>}</section><section className="panel"><h3>Mock interview history</h3>{(state.sessions??[]).length?<ul>{(state.sessions??[]).slice().reverse().map(session=><li key={session.at}>{new Date(session.at).toLocaleString()} · {session.topic} · {session.answered} questions · {session.averageScore}/3 average · {session.missed.length} missed criteria</li>)}</ul>:<p>No completed sessions yet.</p>}</section><section className="panel"><h3>Coverage report</h3><table><thead><tr><th>Area</th><th>Status</th></tr></thead><tbody><tr><td>Written lesson chapters</td><td>{availableLessons.length} of {lessons.length} planned chapter pages have text; depth and review are still pending</td></tr><tr><td>Interactive study exercises</td><td>Editable answers and config with saved notes; checklist is self-review, not automatic grading</td></tr><tr><td>Interview bank</td><td>{questions.length} questions available; overall brief target is 425, so {Math.max(0,425-questions.length)} remain</td></tr><tr><td>Manim animation coverage</td><td>Only assets listed in the animation manifest are available; requested scene set remains incomplete</td></tr><tr><td>Research status</td><td>Source links are indexed; lesson-level source review and technical verification remain in progress</td></tr><tr><td>Course completion</td><td>Draft. Do not mark unit complete until each acceptance check passes.</td></tr></tbody></table></section></>}
      </main>
    </div>
  </div>;
}
function SourceDetail({ source }: { source: Source }) {
  return <article className="panel source-detail"><p className="eyebrow">{source.parentGuide ? 'Supporting documentation' : 'Primary decision guide'}</p><h3>{source.title}</h3><p><a href={source.url} target="_blank" rel="noopener noreferrer">Open AWS documentation ↗</a></p><dl><dt>Registry status</dt><dd>{source.researchStatus??'indexed'}</dd><dt>Retrieval</dt><dd>{source.status}</dd><dt>Retrieved</dt><dd>{source.retrievedAt}</dd><dt>AWS update date</dt><dd>{source.lastUpdated??'Not stated on page'}</dd><dt>Used in lessons</dt><dd>{source.lessons.length ? source.lessons.map(id=>lessons.find(item=>item.id===id)?.title??id).join(', ') : 'Not yet mapped to reviewed lesson content'}</dd></dl>{source.headings.length>0&&<details><summary>Full guide heading map ({source.headings.length})</summary><ol className="headings">{source.headings.map((heading,index)=><li key={index} style={{marginLeft:`${Math.min(heading.level-1,4)*0.8}rem`}}>{heading.title}</li>)}</ol></details>}{source.discoveredLinks.length>0&&<details><summary>Discovered AWS links ({source.discoveredLinks.length})</summary><ul className="discovered">{source.discoveredLinks.map(url=><li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}</ul><p>Discovered links are indexed, but they are not all reviewed yet.</p></details>}</article>;
}

createRoot(document.getElementById('root')!).render(<App />);
