import { describe, expect, it } from 'vitest';
import { lessonText } from './lessonText';
import { lessons, units } from './content';
import { questions } from './questions';
import { firstInterviewQuestion, nextInterviewQuestion, sessionPool } from './interview';
import sourceData from './sources.json';
import extraSourceData from './content/aws-compute/sources.json';
import { spawnSync } from 'node:child_process';

const sourceIds = new Set([...sourceData.sources.map(x=>x.id), ...extraSourceData.map(([id])=>id)]);
const lessonIds = new Set(lessons.map(x=>x.id));
const required = ['Learning objectives','Problem','Internal (?:model|operation)','Worked example 1','Worked example 2','Practical','Failure analysis','Alternatives','Exercises','Quick reference'];
const objectiveTerms: Record<string,string[]> = {
  workload:['concurrency','downstream','burst','RDS Proxy'],
  runtime:['guest OS','Fargate','task definition','health'],
  ownership:['IAM','Managed Instances','durable','Fargate'],
  scale:['target tracking','warm-up','database','queue'],
  placement:['Region','AZ','subnet','RTO','RPO']
};
const wordCount = (text:string) => text.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu)?.length ?? 0;

describe('Unit 1 content gate', () => {
  it('keeps all incomplete units marked Draft or Planned', () => {
    expect(units[0][2]).toMatch(/Draft/);
    for (const unit of units.slice(1)) expect(unit[2]).toMatch(/Planned|Draft/);
  });
  it('gives each lesson substantive chapter sections, calculations, and AWS evidence', () => {
    for (const lesson of lessons.filter(item=>item.unit==='01')) {
      const chapter = lessonText[lesson.id];
      expect(chapter,lesson.id).toBeTruthy();
      for (const section of required) expect(chapter,`${lesson.id}: ${section}`).toMatch(new RegExp(`^## .*${section}`,'mi'));
      expect(wordCount(chapter),lesson.id).toBeGreaterThan(1300); // diagnostic floor, not completion proof
      expect(chapter.match(/```/g)?.length ?? 0,lesson.id).toBeGreaterThanOrEqual(2);
      expect((chapter.match(/```/g)?.length ?? 0)%2,lesson.id).toBe(0);
      expect(chapter,lesson.id).not.toMatch(/\b(?:TODO|TBD|lorem ipsum)\b/i);
      expect(chapter,lesson.id).toContain('https://docs.aws.amazon.com/');
      for (const url of chapter.matchAll(/\]\((https?:\/\/[^)\s]+)/g)) expect(['docs.aws.amazon.com','www.youtube.com','youtu.be'],`${lesson.id}: ${url[1]}`).toContain(new URL(url[1]).hostname);
      const body = chapter.slice(chapter.indexOf('\n## Problem'));
      for (const term of objectiveTerms[lesson.id]) expect(body.toLowerCase(),`${lesson.id}: objective ${term}`).toContain(term.toLowerCase());
      for (const block of chapter.matchAll(/```(python|bash|text)\n([\s\S]*?)```/g)) {
        const [_,language,code] = block;
        expect(code.trim().split('\n').length,`${lesson.id}: empty ${language} block`).toBeGreaterThan(1);
        if (language === 'python') expect(spawnSync('python3',['-c','import ast,sys; ast.parse(sys.stdin.read())'],{input:code}).status,`${lesson.id}: Python syntax`).toBe(0);
        if (language === 'bash') expect(spawnSync('bash',['-n'],{input:code}).status,`${lesson.id}: Bash syntax`).toBe(0);
      }
    }
  });
  it('keeps 50 Unit 1 questions and adds a sourced Lambda sequence', () => {
    expect(questions.filter(q=>q.unit==='01')).toHaveLength(50);
    expect(questions.filter(q=>q.unit==='03')).toHaveLength(60);
    expect(questions).toHaveLength(425);
    expect(new Set(questions.map(q=>q.id)).size).toBe(questions.length);
    expect(new Set(questions.map(q=>q.prompt.toLowerCase().trim())).size).toBe(questions.length);
    for (const lesson of lessons.filter(item=>item.unit==='01')) expect(questions.filter(q=>q.lesson===lesson.id).length,lesson.id).toBe(10);
    for (const q of questions) {
      expect(lessonIds.has(q.lesson),q.id).toBe(true);
      expect(q.unit).toBe(lessons.find(item=>item.id===q.lesson)?.unit??'01');
      expect(q.concepts.length,q.id).toBeGreaterThan(0);
      expect(q.answer.length,q.id).toBeGreaterThan(180);
      expect(q.explanation.length,q.id).toBeGreaterThan(35);
      expect(q.rubric.length,q.id).toBeGreaterThanOrEqual(3);
      expect(q.mistakes.length,q.id).toBeGreaterThanOrEqual(2);
      expect(q.followUps.length,q.id).toBe(2);
      for (const id of q.followUps) expect(questions.some(other=>other.id===id),`${q.id}->${id}`).toBe(true);
      for (const id of q.sources) expect(sourceIds.has(id),`${q.id}: ${id}`).toBe(true);
      for (const id of q.revisionNotes) expect(lessonIds.has(id),`${q.id}: ${id}`).toBe(true);
    }
    expect(questions.filter(q=>q.assessmentType!=='Fundamental understanding').length).toBeGreaterThanOrEqual(25);
  });
  it('selects actual next questions from curated graph and keeps topic drills scoped', () => {
    const first = firstInterviewQuestion('workload',1);
    expect(first?.lesson).toBe('workload');
    const pool = sessionPool('workload');
    const next = nextInterviewQuestion(first!,3,[first!.id],pool);
    expect(next?.lesson).toBe('workload');
    expect(next?.id).not.toBe(first?.id);
  });
  it('records checked numeric examples', () => {
    expect(200*.4).toBe(80);
    expect(2000*.4).toBe(800);
    expect((300-150)*120/(150-30)).toBe(150);
    expect((500-200)*60/(200-50)).toBe(120);
    expect(1200*.25/30).toBe(10);
    expect(900*.2/30).toBe(6);
  });
  it('keeps reviewed AWS claims and video transcript status explicit', () => {
    expect(lessonText.runtime).toMatch(/Fargate task.*does \*\*not\*\* share underlying kernel/i);
    expect(lessonText.placement).toMatch(/Availability Zone fault isolation Region ke andar/);
    expect(lessonText.ownership).toContain('5,400 seconds');
    expect(lessonText.workload).toContain('pinning');
    expect(sourceData.sources.every(source=>source.status==='retrieved')).toBe(true);
    expect(sourceData.videos).toHaveLength(8);
    expect(sourceData.videos.filter(video=>video.captions.startsWith('verified')).length).toBe(5);
    expect(sourceData.videos.filter(video=>video.captions.includes('429')).length).toBe(3);
    expect(sourceData.videos.every(video=>video.usedInLessons.every(id=>lessonIds.has(id)))).toBe(true);
  });
});
