import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { lessons, units } from './content';
import { lessonText } from './lessonText';
import { questions } from './questions';
import { modules } from './content/aws-compute/catalog';
import animationData from './animation-manifest.json';
import sourceData from './sources.json';
import extraSourceData from './content/aws-compute/sources.json';

const sources = new Set([...sourceData.sources.map(source=>source.id),...extraSourceData.map(([id])=>id)]);
const words = (value:string) => value.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu)?.length??0;

describe('expanded AWS Compute course coverage',()=>{
  it('shows each planned unit and keeps chapter identities unique',()=>{
    expect(units.map(([id])=>id)).toEqual(['01','02','03','04','05','06','07','08','09','10']);
    expect(new Set(lessons.map(lesson=>lesson.id)).size).toBe(lessons.length);
    expect(modules.reduce((sum,module)=>sum+module.chapters.length,0)).toBe(91);
    expect(lessons).toHaveLength(97);
  });
  it('reports real content availability without treating outlines as written lessons',()=>{
    const authored=lessons.filter(lesson=>Boolean(lessonText[lesson.id]?.trim()));
    expect(authored.length).toBe(53);
    const byUnit=Object.fromEntries(units.map(([unit])=>[unit,authored.filter(lesson=>(lesson.unit??'01')===unit).length]));
    expect(byUnit).toEqual({'01':5,'02':10,'03':9,'04':12,'05':12,'06':1,'07':1,'08':1,'09':1,'10':1});
    for(const lesson of authored){
      expect(words(lessonText[lesson.id]),lesson.id).toBeGreaterThan(200);
      expect(lesson.exercise.length,`${lesson.id}: practical exercise`).toBeGreaterThan(30);
      expect(lesson.exerciseCheck.length,`${lesson.id}: self-check rubric`).toBeGreaterThanOrEqual(2);
    }
    for(const lesson of lessons.filter(item=>item.unit==='03')){
      const chapter=lessonText[lesson.id];
      expect(words(chapter),lesson.id).toBeGreaterThan(1100);
      expect(chapter,lesson.id).toMatch(/^## Learning objectives/m);
      expect(chapter,lesson.id).toMatch(/^#{2,3} Roman Hinglish explanation/m);
      expect(chapter,lesson.id).toContain('https://docs.aws.amazon.com/');
      expect(chapter.match(/```/g)?.length??0,lesson.id).toBeGreaterThanOrEqual(2);
      expect((chapter.match(/```/g)?.length??0)%2,lesson.id).toBe(0);
    }
    for(const lesson of lessons.filter(item=>item.unit==='02')){
      const chapter=lessonText[lesson.id];
      expect(words(chapter),lesson.id).toBeGreaterThan(1100);
      expect(chapter,lesson.id).toMatch(/^## Learning objectives/m);
      expect(chapter,lesson.id).toMatch(/^## Deepened mechanism:/m);
      expect(chapter,lesson.id).toMatch(/### Worked example 3/);
      expect(chapter,lesson.id).toMatch(/^### Roman Hinglish explanation/m);
      expect(chapter,lesson.id).toContain('https://docs.aws.amazon.com/');
    }
  });
  it('has 425 questions, including an individually authored 60-question Lambda sequence',()=>{
    expect(questions.filter(question=>question.unit==='01')).toHaveLength(50);
    expect(questions.filter(question=>question.unit==='02')).toHaveLength(55);
    expect(questions.filter(question=>question.unit==='03')).toHaveLength(60);
    const expanded=questions.filter(question=>['02','04','05','06','07','08','09','10'].includes(question.unit));
    expect(expanded).toHaveLength(315);
    expect(questions).toHaveLength(425);
    expect(questions.filter(question=>question.id.match(/^L\d{2}$/))).toHaveLength(60);
    expect(new Set(questions.map(question=>question.id)).size).toBe(questions.length);
    for(const question of questions){
      expect(lessons.some(lesson=>lesson.id===question.lesson),question.id).toBe(true);
      for(const source of question.sources) expect(sources.has(source),`${question.id}: ${source}`).toBe(true);
      for(const followup of question.followUps) expect(questions.some(item=>item.id===followup),`${question.id} -> ${followup}`).toBe(true);
    }
  });
  it('gives all eight new Lambda lessons distinct, source-backed questions',()=>{
    const lambda=questions.filter(question=>question.unit==='03');
    expect(new Set(lambda.map(question=>question.prompt.trim().toLowerCase())).size).toBe(60);
    for(const lesson of lessons.filter(item=>item.unit==='03'&&item.id!=='lambda-lifecycle')){
      const set=lambda.filter(question=>question.lesson===lesson.id);
      expect(set,lesson.id).toHaveLength(7);
      expect(set.every(question=>question.answer.length>250),lesson.id).toBe(true);
      expect(set.every(question=>question.scenario.length>30),lesson.id).toBe(true);
      expect(set.every(question=>question.assumptions.length>0),lesson.id).toBe(true);
    }
  });
  it('maps individually authored EC2 scenarios across all ten chapters',()=>{
    const ec2=questions.filter(question=>question.unit==='02');
    expect(new Set(ec2.map(question=>question.prompt.trim().toLowerCase())).size).toBe(55);
    for(const lesson of lessons.filter(item=>item.unit==='02')){
      const set=ec2.filter(question=>question.lesson===lesson.id);
      expect(set.length,lesson.id).toBeGreaterThanOrEqual(5);
      expect(set.every(question=>question.answer.length>250),lesson.id).toBe(true);
      expect(set.every(question=>question.scenario.length>30),lesson.id).toBe(true);
    }
  });
  it('maps authored Unit 4 container scenarios to distinct lessons',()=>{
    const unit4=questions.filter(question=>question.unit==='04');
    const curated=unit4.filter(question=>/^U04-Q0(0[1-9]|1[0-2])$/.test(question.id));
    expect(unit4).toHaveLength(55);
    expect(curated).toHaveLength(12);
    expect(new Set(curated.map(question=>question.prompt.trim().toLowerCase())).size).toBe(12);
    expect(new Set(curated.map(question=>question.lesson)).size).toBe(12);
    for(const question of curated){
      expect(question.answer.length,question.id).toBeGreaterThan(500);
      expect(question.scenario.length,question.id).toBeGreaterThan(30);
      expect(question.assumptions.length,question.id).toBeGreaterThan(0);
      expect(question.rubric.length,question.id).toBeGreaterThanOrEqual(3);
      expect(question.followUps.every(id=>/^U04-Q\d{3}$/.test(id)),question.id).toBe(true);
    }
    for(const lesson of lessons.filter(item=>item.unit==='04')){
      const chapter=lessonText[lesson.id];
      expect(chapter,lesson.id).toMatch(/^## Hinglish explanation/m);
      expect(chapter,lesson.id).toContain('https://docs.aws.amazon.com/');
    }
    expect(lessonText['ecs-eks-decision']).toContain('## Unit 4 closed-book assessment');
    expect(lessonText['ecs-eks-decision'].match(/^### [1-7]\. /gm)).toHaveLength(7);
  });
  it('has renderable media for each animation declared in the app manifest',()=>{
    expect(animationData.animations.length).toBeGreaterThan(0);
    for(const animation of animationData.animations){
      expect(lessons.some(lesson=>lesson.id===animation.lessonId),animation.id).toBe(true);
      expect(animation.objectives.length,animation.id).toBeGreaterThan(0);
      expect(animation.assumptions.length,animation.id).toBeGreaterThan(0);
      expect(animation.sources.length,animation.id).toBeGreaterThan(0);
      expect(animation.chapters.length,animation.id).toBeGreaterThan(0);
      expect(animation.checkpoints.length,animation.id).toBeGreaterThan(0);
      const anchors=[...lessonText[animation.lessonId].matchAll(/^## (.+)$/gm)].map(match=>match[1].toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-'));
      for(const chapter of animation.chapters) expect(anchors,`${animation.id}: ${chapter.lessonAnchor}`).toContain(chapter.lessonAnchor);
      for(const questionId of [...animation.interviewSequence,...animation.checkpoints.map(point=>point.questionId)])
        expect(questions.some(question=>question.id===questionId),`${animation.id}: ${questionId}`).toBe(true);
      for(const path of [animation.mp4,animation.webm,animation.poster,animation.captions]){
        expect(existsSync(join(process.cwd(),'public',path.split('/').slice(3).join('/'))),`${animation.id}: ${path}`).toBe(true);
      }
    }
  });
});
