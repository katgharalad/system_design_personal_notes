import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import manifest from './animation-manifest.json';
import sourceManifest from '../../../animations/manifest.json';
import { lessonText } from './lessonText';
import { lessons } from './content';
import { questions } from './questions';
import { calculateLambda } from './LambdaSimulator';

const asset = manifest.animations.find(item=>item.id==='lambda-execution-lifecycle-v1')!;
const root = fileURLToPath(new URL('../public/', import.meta.url));
const physical = (url: string) => root + url.replace('/aws/compute/','');

describe('Lambda visual learning workflow', () => {
  it('publishes reviewed video and caption assets under stable paths', () => {
    expect(manifest).toEqual(sourceManifest);
    expect(asset.id).toBe('lambda-execution-lifecycle-v1');
    expect(lessons.some(lesson=>lesson.id===asset.lessonId)).toBe(true);
    for (const url of [asset.mp4,asset.webm,asset.captions,asset.poster]) {
      expect(url).toMatch(/^\/aws\/compute\/animations\//);
      expect(statSync(physical(url)).size,url).toBeGreaterThan(100);
    }
    const mp4 = readFileSync(physical(asset.mp4));
    expect(mp4.toString('ascii',4,8)).toBe('ftyp');
    const vtt = readFileSync(physical(asset.captions),'utf8');
    expect(vtt).toMatch(/^WEBVTT/);
    expect(vtt).toContain('Init');
  });
  it('aligns each chapter and checkpoint with the lesson and question graph', () => {
    expect(asset.objectives.length).toBeGreaterThanOrEqual(4);
    expect(asset.assumptions.length).toBeGreaterThanOrEqual(4);
    expect(asset.hinglish).toMatch(/Init.*Invoke/);
    expect(asset.chapters.length).toBeGreaterThanOrEqual(6);
    expect(asset.checkpoints.length).toBe(4);
    expect(asset.cues.length).toBeGreaterThanOrEqual(8);
    expect(asset.cues.every(cue=>cue.endSeconds>cue.atSeconds && cue.endSeconds<=asset.duration)).toBe(true);
    const sectionSlugs = [...lessonText[asset.lessonId].matchAll(/^## (.+)$/gm)].map(match=>match[1].toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-'));
    for (const chapter of asset.chapters) {
      expect(chapter.atSeconds).toBeGreaterThanOrEqual(0);
      expect(chapter.atSeconds).toBeLessThan(asset.duration);
      expect(sectionSlugs).toContain(chapter.lessonAnchor);
    }
    for (const checkpoint of asset.checkpoints) {
      expect(checkpoint.atSeconds).toBeGreaterThan(0);
      expect(checkpoint.atSeconds).toBeLessThan(asset.duration);
      expect(checkpoint.options[checkpoint.answerIndex]).toBeTruthy();
      expect(questions.some(q=>q.id===checkpoint.questionId)).toBe(true);
    }
    expect(asset.chapters.map(x=>x.atSeconds)).toEqual([...asset.chapters.map(x=>x.atSeconds)].sort((a,b)=>a-b));
    expect(asset.checkpoints.map(x=>x.atSeconds)).toEqual([...asset.checkpoints.map(x=>x.atSeconds)].sort((a,b)=>a-b));
    expect(asset.sources.every(source=>(typeof source==='string'?source:source.url).startsWith('https://docs.aws.amazon.com/'))).toBe(true);
  });
  it('links the four question sequence and checks the separate calculation model', () => {
    const path = ['L01','L02','L03','L04'];
    for (let i=0;i<path.length-1;i++) expect(questions.find(q=>q.id===path[i])?.followUps[1]).toBe(path[i+1]);
    expect(calculateLambda({rps:120,seconds:.25,reserved:20,dbBudget:20,connections:1})).toEqual({demand:30,admitted:20,dbDemand:20,overCap:10,dbGap:0});
    expect(calculateLambda({rps:120,seconds:.25,reserved:30,dbBudget:20,connections:1}).dbGap).toBe(10);
  });
});
