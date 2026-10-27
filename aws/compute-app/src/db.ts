import type { SessionResult } from './interview';
import { openDB } from 'idb';
export type StudyState = {
  version: 1;
  completed: string[];
  bookmarks: string[];
  notes: Record<string, string>;
  attempts: Record<string, { answer: string; selfScore: number | null; at: string }>;
  sessions?: SessionResult[];
};
export const emptyState = (): StudyState => ({ version: 1, completed: [], bookmarks: [], notes: {}, attempts: {}, sessions: [] });
const database = () => openDB('engineering-interview-lab', 1, { upgrade(db) { db.createObjectStore('study'); } });
export async function loadState(): Promise<StudyState> {
  try { return (await (await database()).get('study', 'compute-v1')) ?? emptyState(); }
  catch { return emptyState(); }
}
export async function saveState(state: StudyState): Promise<void> {
  await (await database()).put('study', state, 'compute-v1');
}
export function validState(value: unknown): value is StudyState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || !Array.isArray(v.completed) || !v.completed.every(x => typeof x === 'string') || !Array.isArray(v.bookmarks) || !v.bookmarks.every(x => typeof x === 'string')) return false;
  if (!v.notes || typeof v.notes !== 'object' || Array.isArray(v.notes) || !Object.values(v.notes).every(x => typeof x === 'string')) return false;
  if (!v.attempts || typeof v.attempts !== 'object' || Array.isArray(v.attempts)) return false;
  if (v.sessions !== undefined && (!Array.isArray(v.sessions) || !v.sessions.every(item => item && typeof item === 'object' && typeof item.at === 'string' && typeof item.answered === 'number' && Array.isArray(item.questionIds) && Array.isArray(item.missed)))) return false;
  return Object.values(v.attempts).every(item => {
    if (!item || typeof item !== 'object') return false;
    const attempt = item as Record<string, unknown>;
    return typeof attempt.answer === 'string' && (attempt.selfScore === null || (typeof attempt.selfScore === 'number' && Number.isInteger(attempt.selfScore) && attempt.selfScore >= 0 && attempt.selfScore <= 3)) && typeof attempt.at === 'string';
  });
}
