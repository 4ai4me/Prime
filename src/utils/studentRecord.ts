import { CURRICULUM_LESSONS } from '../lessons/curriculum';
import type { LessonTabNumber } from './lessonAccess';

/**
 * 학생 활동지(기록) 형식
 * ------------------------------------------------------------------
 * - 차시 n의 답은 l{n} 칸에 저장합니다 (l1~l6). 서버에서는
 *   student_registrations/{studentKey}/prime_lessons/l{n} 문서 하나가 한 차시입니다.
 * - 칸 이름과 형식은 학생 기록·보안 규칙과의 약속이므로, 한 번 쓰기 시작한 뒤에는
 *   이름을 바꾸거나 다른 차시로 옮기지 않습니다(옮기려면 Tier 3로 따로 계획).
 * - 차시 자료를 채울 때 그 차시의 LessonNState에 칸을 추가하고, cleanLessonState에서 읽는 방법을 정합니다.
 */

export {
  HELP_SOURCE_OPTIONS,
  REFLECTION_MIN_CHARS,
  isReflectionDone,
  sanitizeHelpSource,
  type HelpSource,
  type LessonCommonState,
} from './lessonCommon';
import { sanitizeHelpSource, type LessonCommonState } from './lessonCommon';
import { cleanLesson1State, type Lesson1State } from '../lessons/lesson1Logic';

/**
 * 차시별 답안. 자료 준비 중인 차시는 공통 칸만 있습니다.
 * 자료를 채운 차시는 src/lessons/lessonNLogic.ts 에 형식을 두고 여기서 이어 씁니다. (1차시: lesson1Logic.ts)
 */
export type { Lesson1State };
export type Lesson2State = LessonCommonState;
export type Lesson3State = LessonCommonState;
export type Lesson4State = LessonCommonState;
export type Lesson5State = LessonCommonState;
export type Lesson6State = LessonCommonState;

export interface TeacherEvaluation {
  /** 차시별 점수 (0~3, 미평가 null) — EVAL_CRITERIA 순서 */
  scores: (number | null)[];
  feedback: string;
  nextStep: string;
}

export const RECORD_KIND = 'prime-lessons-v1' as const;

export interface StudentRecord {
  kind: typeof RECORD_KIND;
  group: string;
  code: string;
  createdAt: string;
  updatedAt: string;
  l1: Lesson1State;
  l2: Lesson2State;
  l3: Lesson3State;
  l4: Lesson4State;
  l5: Lesson5State;
  l6: Lesson6State;
  teacherMemo?: string;
  evaluation?: TeacherEvaluation;
}

export type LessonKey = 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6';
export const LESSON_KEYS: readonly LessonKey[] = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'];

export function lessonKeyOf(num: LessonTabNumber): LessonKey {
  return `l${num}` as LessonKey;
}

/** 브라우저 임시 보관 키 (Func·Props와 겹치지 않게 prime_ 으로 시작) */
export const STORAGE_KEY_STUDENT = 'prime_lessons_student_v1';
export const STORAGE_KEY_TEACHER = 'prime_lessons_teacher_v1';

export const CLASSROOM_BRAND_NAME = '이하연 수학 교실';

/** 교사 평가 항목: 차시마다 하나 (0~3점) */
export const EVAL_CRITERIA: string[] = CURRICULUM_LESSONS.map((l) => `${l.shortTitle} (${l.num}차시)`);
export const EVAL_DESCRIPTIONS: string[] = CURRICULUM_LESSONS.map((l) => l.question);

export const EVAL_SCORE_LABELS: Record<number, string> = {
  0: '0점 · 증거 부족',
  1: '1점 · 시작 단계',
  2: '2점 · 부분적 수행',
  3: '3점 · 충분한 수행',
};


// ------------------------------------------------------------------
// 만들기 · 정리하기
// ------------------------------------------------------------------

export function createInitialStudentState(): StudentRecord {
  const now = new Date().toISOString();
  return {
    kind: RECORD_KIND,
    group: '',
    code: '',
    createdAt: now,
    updatedAt: now,
    l1: {},
    l2: {},
    l3: {},
    l4: {},
    l5: {},
    l6: {},
    teacherMemo: '',
  };
}

function cleanString(v: unknown, max: number): string | undefined {
  return typeof v === 'string' ? v.slice(0, max) : undefined;
}

const LESSON_JSON_LIMIT = 150000;

/**
 * 차시 답안 정리.
 * - 공통 칸(성찰·도움 받은 정도)은 형식을 검사합니다.
 * - 아직 정하지 않은 칸은 JSON으로 저장 가능한 값이면 그대로 둡니다(자료를 채운 뒤 각 차시에 맞게 좁힘).
 * - 값이 없는 칸에 빈 값을 새로 붙이지 않습니다(붙이면 차시 JSON이 달라져 불필요한 재저장이 생김).
 */
export function cleanLessonState(raw: unknown): LessonCommonState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  let copy: Record<string, unknown>;
  try {
    const json = JSON.stringify(raw);
    if (json.length > LESSON_JSON_LIMIT) return {};
    copy = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
  const out: Record<string, unknown> = { ...copy };
  for (const k of ['reflection1', 'reflection2'] as const) {
    if (k in out) {
      const s = cleanString(out[k], 2000);
      if (s === undefined) delete out[k];
      else out[k] = s;
    }
  }
  if ('helpSource' in out) out.helpSource = sanitizeHelpSource(out.helpSource);
  return out as LessonCommonState;
}

function cleanEvaluation(raw: unknown): TeacherEvaluation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ev = raw as Record<string, unknown>;
  const scores = Array.isArray(ev.scores)
    ? ev.scores.map((s) => (typeof s === 'number' && Number.isInteger(s) && s >= 0 && s <= 3 ? s : null))
    : [];
  return {
    scores,
    feedback: cleanString(ev.feedback, 4000) ?? '',
    nextStep: cleanString(ev.nextStep, 4000) ?? '',
  };
}

/** 저장된 활동지(JSON에서 읽은 값)를 안전한 형식으로 정리합니다. 형식이 틀리면 빈 활동지. */
export function cleanStudentState(raw: unknown): StudentRecord {
  const base = createInitialStudentState();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  const result: StudentRecord = {
    ...base,
    group: cleanString(obj.group, 25) ?? '',
    code: cleanString(obj.code, 25) ?? '',
    createdAt: cleanString(obj.createdAt, 40) || base.createdAt,
    updatedAt: cleanString(obj.updatedAt, 40) || base.updatedAt,
    teacherMemo: cleanString(obj.teacherMemo, 4000) ?? '',
  };
  for (const k of LESSON_KEYS) {
    result[k] = cleanLessonState(obj[k]);
  }
  // 자료가 채워진 차시는 그 차시의 정리 방법을 씀 (모르는 칸은 버림)
  result.l1 = cleanLesson1State(obj.l1);
  const ev = cleanEvaluation(obj.evaluation);
  if (ev) result.evaluation = ev;
  return result;
}

/** 차시 답안에 학생이 입력한 내용이 하나라도 있는지 */
export function lessonHasContent(state: unknown): boolean {
  if (!state || typeof state !== 'object') return false;
  return Object.values(state as Record<string, unknown>).some((v) => {
    if (v === undefined || v === null || v === false || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return lessonHasContent(v);
    return true;
  });
}

/**
 * 서버 기록(remote)과 이 기기에 남은 기록(local)을 합칩니다.
 * 차시마다: 한쪽만 내용이 있으면 그쪽, 둘 다 있으면 더 최근에 고친 쪽. 교사 평가는 서버 쪽.
 */
export function mergeStudentStates(remote: StudentRecord, local: StudentRecord): StudentRecord {
  if (!remote || remote.kind !== RECORD_KIND) return local;
  if (!local || local.kind !== RECORD_KIND) return remote;
  const result: StudentRecord = { ...remote };
  result.evaluation = remote.evaluation || local.evaluation;
  result.teacherMemo = remote.teacherMemo || local.teacherMemo || '';
  result.group = remote.group || local.group || '';
  result.code = remote.code || local.code || '';

  const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
  const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
  const localIsNewer = localTime >= remoteTime;

  for (const k of LESSON_KEYS) {
    const remHas = lessonHasContent(remote[k]);
    const locHas = lessonHasContent(local[k]);
    if (locHas && !remHas) result[k] = local[k];
    else if (remHas && !locHas) result[k] = remote[k];
    else result[k] = localIsNewer ? local[k] : remote[k];
  }
  result.updatedAt = localIsNewer && local.updatedAt ? local.updatedAt : remote.updatedAt || new Date().toISOString();
  return result;
}

// ------------------------------------------------------------------
// 교사 평가
// ------------------------------------------------------------------

export function ensureTeacherEval(x: StudentRecord): TeacherEvaluation {
  const n = EVAL_CRITERIA.length;
  if (!x.evaluation || typeof x.evaluation !== 'object') {
    x.evaluation = { scores: Array(n).fill(null), feedback: '', nextStep: '' };
  }
  if (!Array.isArray(x.evaluation.scores)) x.evaluation.scores = Array(n).fill(null);
  while (x.evaluation.scores.length < n) x.evaluation.scores.push(null);
  if (typeof x.evaluation.feedback !== 'string') x.evaluation.feedback = '';
  if (typeof x.evaluation.nextStep !== 'string') x.evaluation.nextStep = '';
  return x.evaluation;
}

export interface TeacherEvaluationProgress {
  scoredCount: number;
  totalCount: number;
  hasFeedback: boolean;
  percent: number;
  status: 'none' | 'partial' | 'complete';
  statusLabel: string;
}

/** 평가 진행: 차시 점수 N개 + 피드백 1개가 모두 있으면 완료 */
export function getTeacherEvaluationProgress(student?: StudentRecord | null): TeacherEvaluationProgress {
  const totalRubric = EVAL_CRITERIA.length;
  const totalCount = totalRubric + 1;
  const ev = student?.evaluation;
  const scores = Array.isArray(ev?.scores) ? ev!.scores.slice(0, totalRubric) : [];
  const scoredCount = scores.filter((v) => typeof v === 'number' && v >= 0 && v <= 3).length;
  const hasFeedback = Boolean(ev?.feedback && ev.feedback.trim());
  const hasOther = Boolean((ev?.nextStep && ev.nextStep.trim()) || (student?.teacherMemo && student.teacherMemo.trim()));
  const done = scoredCount + (hasFeedback ? 1 : 0);
  if (done >= totalCount) {
    return { scoredCount, totalCount, hasFeedback, percent: 100, status: 'complete', statusLabel: '평가 완료' };
  }
  if (done > 0 || hasOther) {
    const percent = Math.min(99, Math.max(10, Math.round((done / totalCount) * 100)));
    return { scoredCount, totalCount, hasFeedback, percent, status: 'partial', statusLabel: '평가 진행 중' };
  }
  return { scoredCount, totalCount, hasFeedback, percent: 0, status: 'none', statusLabel: '미평가' };
}

export function getTeacherEvalAverage(scores?: (number | null)[]): number | null {
  if (!Array.isArray(scores)) return null;
  const valid = scores.filter((v): v is number => typeof v === 'number' && v >= 0 && v <= 3);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ------------------------------------------------------------------
// 기타
// ------------------------------------------------------------------

/** CSV 칸 (엑셀 수식 실행 막기) */
export function csvSafe(v: unknown): string {
  let x = String(v ?? '').replace(/\r\n?/g, '\n');
  if (/^\s*[=+\-@]/.test(x)) x = "'" + x;
  return '"' + x.replace(/"/g, '""') + '"';
}

export function filenameSafe(x: string): string {
  return String(x || '미입력').replace(/[^0-9a-zA-Z가-힣_\-]/g, '_').slice(0, 30) || '미입력';
}

/** 교사 화면에서 학생을 구분하는 키 (학급 + 학번_이름) */
export function studentKey(x: { group?: string; code?: string }): string {
  return `${(x.group || '').trim()}::${(x.code || '').trim()}`;
}

/** 가입 문서의 worksheetJson(예전 방식, 보존용)에 처음 넣는 값 — Prime은 차시 문서만 씀 */
export function initialWorksheetJson(record: StudentRecord): string {
  return JSON.stringify({ kind: RECORD_KIND, group: record.group, code: record.code });
}
