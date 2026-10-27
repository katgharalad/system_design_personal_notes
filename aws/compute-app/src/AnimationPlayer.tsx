import { useEffect, useRef, useState } from 'react';
import manifest from './animation-manifest.json';

export type Animation = (typeof manifest.animations)[number];
export const animations = manifest.animations;

export function AnimationPlayer({ animation, onQuestion, onLab }: {
  animation: Animation; onQuestion: (id: string) => void; onLab?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const checkpointRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [captions, setCaptions] = useState(true);
  const [answered, setAnswered] = useState<string[]>([]);
  const [active, setActive] = useState<string>();
  const [choice, setChoice] = useState<number>();
  const next = animation.checkpoints.find(point => !answered.includes(point.id));
  const checkpoint = animation.checkpoints.find(point => point.id === active);
  const unlocked = next?.atSeconds ?? animation.duration;
  const currentCue = animation.cues.find(cue => time >= cue.atSeconds && time < cue.endSeconds);

  useEffect(() => { if (video.current) video.current.playbackRate = speed; }, [speed]);
  useEffect(() => { if (active) checkpointRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [active]);

  const pauseAt = (id: string, at: number) => {
    if (!video.current) return;
    video.current.pause();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (Math.abs(video.current.currentTime-at)>.05) video.current.currentTime = at;
    setTime(at); setPlaying(false); setActive(id); setChoice(undefined);
  };
  const update = () => {
    if (active) return;
    const current = video.current?.currentTime ?? 0;
    if (next && current >= next.atSeconds - .05) { pauseAt(next.id, next.atSeconds); return; }
    setTime(current);
  };
  const seek = (seconds: number) => {
    if (!video.current || active) return;
    const target = Math.min(seconds, unlocked);
    video.current.currentTime = target;
    setTime(target);
    if (next && target >= next.atSeconds - .05) pauseAt(next.id, next.atSeconds);
  };
  const toggle = () => {
    if (!video.current || active) return;
    if (video.current.paused) video.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else { video.current.pause(); setPlaying(false); }
  };
  const continueAfter = () => {
    if (!checkpoint || choice === undefined || !video.current) return;
    setAnswered(old => [...old, checkpoint.id]); setActive(undefined); setChoice(undefined);
    video.current.currentTime = checkpoint.atSeconds + .08;
    video.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  const format = (value: number) => `${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;

  return <section className="panel animation-player" aria-label={animation.title}>
    <p className="eyebrow">Visual mechanism · {animation.id}</p>
    <h3>Watch, predict, then defend</h3>
    <p>{animation.hinglish}</p>
    <div className="animation-frame">
      <video ref={video} poster={animation.poster} preload="metadata" playsInline onTimeUpdate={update} onSeeking={update} onEnded={() => setPlaying(false)} aria-label={animation.title}>
        <source src={animation.webm} type="video/webm" />
        <source src={animation.mp4} type="video/mp4" />
        <track kind="captions" src={animation.captions} srcLang="en" label="English explanation" />
      </video>
    </div>
    {captions && <p className="animation-caption" aria-label="Animation caption">{currentCue?.text ?? 'Captions begin with the first request.'}</p>}
    {checkpoint && <div ref={checkpointRef} className="animation-checkpoint" role="group" aria-label="Prediction checkpoint">
        <strong>Predict before video continues</strong>
        <p>{checkpoint.prompt}</p>
        <div className="checkpoint-options">{checkpoint.options.map((option,index)=><button type="button" key={option} aria-pressed={choice===index} onClick={()=>setChoice(index)}>{option}</button>)}</div>
        {choice !== undefined && <p className={choice===checkpoint.answerIndex?'correct':'incorrect'}>{choice===checkpoint.answerIndex?checkpoint.feedback:'Try again. Review what changed in the environment before you continue.'}</p>}
        <button type="button" className="primary" disabled={choice!==checkpoint.answerIndex} onClick={continueAfter}>Continue →</button>
        <button type="button" className="text-button" onClick={()=>onQuestion(checkpoint.questionId)}>Open interview question {checkpoint.questionId}</button>
      </div>}
    <div className="animation-controls">
      <button type="button" onClick={toggle} disabled={Boolean(active)}>{playing?'Pause':'Play'}</button>
      <label className="animation-scrub">Timeline <input type="range" min="0" max={animation.duration} step="0.1" value={time} onChange={event=>seek(Number(event.target.value))} aria-label="Seek animation" /></label>
      <span>{format(time)} / {format(animation.duration)}</span>
      <label>Speed <select value={speed} onChange={event=>setSpeed(Number(event.target.value))}>{[.75,1,1.25,1.5,2].map(value=><option key={value} value={value}>{value}×</option>)}</select></label>
      <button type="button" aria-pressed={captions} onClick={()=>setCaptions(!captions)}>Captions {captions?'on':'off'}</button>
      <button type="button" onClick={()=>video.current?.requestFullscreen?.()}>Full screen</button>
    </div>
    <div className="animation-chapters"><h4>Chapters and lesson links</h4><ol>{animation.chapters.map(chapter=><li key={chapter.id}><button type="button" onClick={()=>seek(chapter.atSeconds)} disabled={chapter.atSeconds>unlocked}>{format(chapter.atSeconds)} · {chapter.title}</button><a href={`#${chapter.lessonAnchor}`}>Read section ↓</a></li>)}</ol></div>
    <p className="assumption">Illustration: standard on-demand Event Function. Timing is conceptual. Warm reuse and new environment availability are example outcomes.</p>
    <div className="button-row">{onLab&&<button type="button" onClick={onLab}>Change assumptions in Lambda lab →</button>}<button type="button" onClick={()=>onQuestion(animation.interviewSequence[0])}>Start interview sequence {animation.interviewSequence[0]} → {animation.interviewSequence.at(-1)}</button></div>
  </section>;
}
