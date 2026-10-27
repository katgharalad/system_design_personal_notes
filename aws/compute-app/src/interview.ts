import { questions, type InterviewQuestion } from './questions';

export type SessionResult = { at: string; topic: string; size: number; answered: number; averageScore: number; missed: string[]; questionIds: string[] };
export function nextInterviewQuestion(current: InterviewQuestion, score: number, seen: string[], pool: InterviewQuestion[]): InterviewQuestion | undefined {
  const wanted = score >= 2 ? current.followUps[1] : current.followUps[0];
  const linked = pool.find(q => q.id === wanted && !seen.includes(q.id));
  if (linked) return linked;
  const targetLevel = Math.max(1, Math.min(5, current.difficultyLevel + (score >= 2 ? 1 : -1)));
  return pool.filter(q => !seen.includes(q.id)).sort((a,b) =>
    (a.lesson === current.lesson ? 0 : 2) - (b.lesson === current.lesson ? 0 : 2) ||
    Math.abs(a.difficultyLevel-targetLevel) - Math.abs(b.difficultyLevel-targetLevel) ||
    a.id.localeCompare(b.id)
  )[0];
}
export function sessionPool(topic: string): InterviewQuestion[] { return topic === 'all' ? questions : questions.filter(q => q.lesson === topic); }
export function firstInterviewQuestion(topic: string, difficulty: number): InterviewQuestion | undefined {
  return sessionPool(topic).slice().sort((a,b)=>Math.abs(a.difficultyLevel-difficulty)-Math.abs(b.difficultyLevel-difficulty)||a.id.localeCompare(b.id))[0];
}
