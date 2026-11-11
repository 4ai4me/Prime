import { LESSON_KEYS, StudentRecord, cleanStudentState, type LessonKey } from './studentRecord';

/**
 * 차시별 분리 저장의 순수 로직 (Firebase에 의존하지 않음 — 단위 테스트 대상)
 * 저장·불러오기는 lessonStore.ts 참고.
 */
export { LESSON_KEYS, type LessonKey };

/** 학생 답안 저장 칸 (student_registrations/{studentKey}/prime_lessons/…) — Func의 func_lessons, Props의 props_lessons와 따로 */
export const LESSON_COLLECTION = 'prime_lessons';

export interface LessonDocData {
  studentKey: string;
  lesson: number;
  data: string;
  clientUpdatedAt: string;
}

export interface TeacherDocData {
  studentKey: string;
  data: string;
}

/** 한 학생의 서버 측 차시 문서 묶음 */
export interface StudentLessonSnapshot {
  lessons: Partial<Record<LessonKey, LessonDocData>>;
  teacher?: TeacherDocData;
}

export type LessonJsonMap = Record<LessonKey, string>;

/** 활동지를 차시별 JSON 문자열로 나눕니다 (변경 여부 비교용). */
export function splitLessons(record: StudentRecord): LessonJsonMap {
  const out = {} as LessonJsonMap;
  for (const k of LESSON_KEYS) {
    out[k] = JSON.stringify(record[k] ?? null);
  }
  return out;
}

function laterIso(a: string | undefined, b: string | undefined): string {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  if (Number.isNaN(tb) || ta >= tb) return a || b || '';
  return b || a || '';
}

/**
 * 예전 worksheetJson에서 꺼낸 활동지(base)에 차시 문서와 교사 평가 문서를 덮어써서
 * 최신 활동지를 만듭니다.
 */
export function assembleRecord(base: StudentRecord, snap: StudentLessonSnapshot): StudentRecord {
  const obj: Record<string, unknown> = { ...base };
  let updatedAt = base.updatedAt;

  for (const k of LESSON_KEYS) {
    const d = snap.lessons[k];
    if (!d) continue;
    try {
      const parsed = JSON.parse(d.data);
      if (parsed && typeof parsed === 'object') {
        obj[k] = parsed;
        updatedAt = laterIso(updatedAt, d.clientUpdatedAt);
      }
    } catch (err) {
      // 손상된 차시 문서는 건너뛰고 기존(예전 worksheetJson) 내용을 사용 — 데이터를 덮어쓰지 않음
      console.warn(`[lessonStore] ${k} 차시 문서를 읽지 못해 기존 내용을 사용합니다.`, err);
    }
  }

  if (snap.teacher) {
    try {
      const t = JSON.parse(snap.teacher.data) as { evaluation?: unknown; teacherMemo?: unknown };
      if (t.evaluation && typeof t.evaluation === 'object') obj.evaluation = t.evaluation;
      if (typeof t.teacherMemo === 'string') obj.teacherMemo = t.teacherMemo;
    } catch (err) {
      console.warn('[lessonStore] 교사 평가 문서를 읽지 못해 기존 평가를 사용합니다.', err);
    }
  }
  obj.updatedAt = updatedAt;

  try {
    const cleaned = cleanStudentState(obj);
    cleaned.group = base.group;
    cleaned.code = base.code;
    return cleaned;
  } catch (err) {
    // 조립 결과가 형식 검사를 통과하지 못하면 원본(base)을 그대로 사용 — 화면이 깨지거나 데이터가 사라지지 않도록
    console.warn('[lessonStore] 차시 문서 조립에 실패해 기존 활동지를 사용합니다.', err);
    return base;
  }
}

/**
 * 서버에 저장된 것과 내용이 달라진 차시 목록을 돌려줍니다.
 * @param serverJson 서버에 저장되어 있다고 알고 있는 차시별 JSON
 */
export function findChangedLessons(record: StudentRecord, serverJson: LessonJsonMap): LessonKey[] {
  const now = splitLessons(record);
  return LESSON_KEYS.filter((k) => now[k] !== serverJson[k]);
}

/** 교사 평가·메모 JSON (변경 여부 비교용) */
export function teacherJson(record: StudentRecord): string {
  return JSON.stringify({
    evaluation: record.evaluation ?? null,
    teacherMemo: record.teacherMemo ?? '',
  });
}

