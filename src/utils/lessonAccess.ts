import {
  CURRICULUM_LESSONS,
  lessonBadge,
  getCurriculumUnit,
  type LessonNumber,
} from '../lessons/curriculum';

/**
 * 차시 잠금(ON/OFF) — Func 저장소의 같은 기능을 6차시용으로 옮긴 것
 * ------------------------------------------------------------------
 * 서버 문서: app_settings/prime_lesson_access (l1~l6, 교사만 쓰기)
 * 반별 잠금: app_settings/prime_lesson_access_classes (classLessonAccess.ts)
 * Func·Props의 잠금 문서(func_lesson_access, lesson_access)는 읽지도 쓰지도 않습니다.
 */

export type LessonTabNumber = LessonNumber;

export const ALL_LESSON_NUMBERS: LessonTabNumber[] = CURRICULUM_LESSONS.map((l) => l.num);

export function isLessonTabNumber(n: unknown): n is LessonTabNumber {
  return typeof n === 'number' && (ALL_LESSON_NUMBERS as number[]).includes(n);
}

export const LESSON_TAB_METADATA: {
  num: LessonTabNumber;
  badge: string;
  shortTitle: string;
  fullTitle: string;
  unit: number;
  unitTitle: string;
}[] = CURRICULUM_LESSONS.map((l) => ({
  num: l.num,
  badge: lessonBadge(l.num),
  shortTitle: l.shortTitle,
  fullTitle: `${l.shortTitle} (${l.num}차시)`,
  unit: l.unit,
  unitTitle: getCurriculumUnit(l.unit).title,
}));

export type LessonAccessConfig = Record<LessonTabNumber, boolean> & {
  updatedAt?: string;
  updatedBy?: string;
};

/** 이 브라우저에 기억해 두는 차시 잠금 */
export const STORAGE_KEY_LESSON_ACCESS = 'prime_lesson_access_v1';

/** 차시 잠금 서버 문서 (app_settings/…) — Prime 전용 */
export const PRIME_LESSON_ACCESS_DOC = 'prime_lesson_access';

const ADMIN_EMAILS = ['liha1634@gmail.com', 'planitia4ai@gmail.com'];

function allLessons(value: boolean): Record<LessonTabNumber, boolean> {
  const out = {} as Record<LessonTabNumber, boolean>;
  for (const n of ALL_LESSON_NUMBERS) out[n] = value;
  return out;
}

/** 서버 문서가 아직 없을 때의 기본값: 모두 열림 (Func와 같음 — 교사가 처음 들어오면 서버에 기록) */
export const DEFAULT_LESSON_ACCESS: LessonAccessConfig = allLessons(true);

export function normalizeLessonAccess(raw: unknown): LessonAccessConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_LESSON_ACCESS };
  }
  const obj = raw as Record<string, unknown>;
  const result = {} as LessonAccessConfig;
  for (const num of ALL_LESSON_NUMBERS) {
    if (typeof obj[String(num)] === 'boolean') result[num] = obj[String(num)] as boolean;
    else if (typeof obj[`l${num}`] === 'boolean') result[num] = obj[`l${num}`] as boolean;
    else result[num] = true;
  }
  if (typeof obj.updatedBy === 'string' && obj.updatedBy.trim()) {
    result.updatedBy = obj.updatedBy.trim();
  }
  if (typeof obj.updatedAt === 'string' && obj.updatedAt.trim()) {
    result.updatedAt = obj.updatedAt.trim();
  } else if (obj.updatedAt && typeof (obj.updatedAt as { toDate?: () => Date }).toDate === 'function') {
    try {
      result.updatedAt = (obj.updatedAt as { toDate: () => Date }).toDate().toISOString();
    } catch {
      // 시각을 읽지 못하면 비워 둠
    }
  }
  return result;
}

export function isLessonEnabled(config: LessonAccessConfig, lesson: LessonTabNumber): boolean {
  return Boolean(config[lesson]);
}

export function getFirstEnabledLesson(config: LessonAccessConfig): LessonTabNumber | null {
  for (const num of ALL_LESSON_NUMBERS) {
    if (config[num]) return num;
  }
  return null;
}

export function hasAnyLockedLesson(config: LessonAccessConfig): boolean {
  return ALL_LESSON_NUMBERS.some((num) => !config[num]);
}

/** 일괄 설정: 'upToN' = 1~N차시 열기 */
export type LessonAccessPreset = 'allOpen' | 'allLocked' | `upTo${LessonTabNumber}`;

export const LESSON_ACCESS_PRESETS: { preset: LessonAccessPreset; label: string }[] = [
  ...ALL_LESSON_NUMBERS.slice(0, -1).map((n) => ({
    preset: `upTo${n}` as LessonAccessPreset,
    label: n === 1 ? '1차시만 열기' : `1~${n}차시 열기`,
  })),
  { preset: 'allOpen', label: '전체 열기' },
];

export function createLessonAccessPreset(preset: LessonAccessPreset, updatedBy?: string): LessonAccessConfig {
  let openUpTo = 0;
  if (preset === 'allOpen') openUpTo = ALL_LESSON_NUMBERS.length;
  else if (preset.startsWith('upTo')) openUpTo = Number(preset.slice(4)) || 0;
  const base = {} as LessonAccessConfig;
  for (const n of ALL_LESSON_NUMBERS) base[n] = n <= openUpTo;
  base.updatedAt = new Date().toISOString();
  if (updatedBy) base.updatedBy = updatedBy;
  return base;
}

/** 서버 문서에 쓸 칸 (l1~l6 + updatedBy) */
export function buildLessonAccessFirestoreFields(
  config: LessonAccessConfig,
  updatedByEmail?: string
): Record<string, boolean | string> {
  const normalized = normalizeLessonAccess(config);
  const rawEmail = (updatedByEmail || normalized.updatedBy || ADMIN_EMAILS[0]).trim();
  const safeUpdatedBy = ADMIN_EMAILS.includes(rawEmail) ? rawEmail : ADMIN_EMAILS[0];
  const fields: Record<string, boolean | string> = {};
  for (const n of ALL_LESSON_NUMBERS) fields[`l${n}`] = Boolean(normalized[n]);
  fields.updatedBy = safeUpdatedBy;
  return fields;
}

export interface StudentLessonRenderGateResult {
  canRender: boolean;
  reason: 'syncing' | 'all_locked' | 'lesson_locked' | 'allowed';
  effectiveLesson: LessonTabNumber;
  redirectLesson: LessonTabNumber | null;
}

/** 학생 화면에 차시를 그려도 되는지 (서버 확인 전·모두 잠김·이 차시 잠김·허용) */
export function evaluateStudentLessonRenderGate(
  config: LessonAccessConfig,
  requestedLesson: LessonTabNumber,
  isServerChecked: boolean
): StudentLessonRenderGateResult {
  const firstOpen = getFirstEnabledLesson(config);
  const safeEffective: LessonTabNumber = isLessonEnabled(config, requestedLesson)
    ? requestedLesson
    : firstOpen ?? ALL_LESSON_NUMBERS[0];

  if (!isServerChecked) {
    return { canRender: false, reason: 'syncing', effectiveLesson: safeEffective, redirectLesson: firstOpen };
  }
  if (firstOpen === null) {
    return { canRender: false, reason: 'all_locked', effectiveLesson: ALL_LESSON_NUMBERS[0], redirectLesson: null };
  }
  if (!isLessonEnabled(config, requestedLesson)) {
    return { canRender: false, reason: 'lesson_locked', effectiveLesson: firstOpen, redirectLesson: firstOpen };
  }
  return { canRender: true, reason: 'allowed', effectiveLesson: requestedLesson, redirectLesson: requestedLesson };
}
