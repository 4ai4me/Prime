/**
 * 반별 차시 잠금 (Func 저장소에서 가져옴, 2026-11-11 Prime 6차시용)
 *
 * - 전체 잠금(app_settings/prime_lesson_access)은 그대로 기본값입니다.
 * - 반별 설정(app_settings/prime_lesson_access_classes)에 그 반이 있으면, 그 반 학생은 반별 설정을 따릅니다.
 * - 반은 가입 정보의 학교·학년·반으로 구분합니다. 학생 개인 정보는 이 문서에 넣지 않습니다.
 */
import {
  ALL_LESSON_NUMBERS,
  normalizeLessonAccess,
  type LessonAccessConfig,
} from './mathLogic';

export const PRIME_CLASS_LESSON_ACCESS_DOC = 'prime_lesson_access_classes';
export const STORAGE_KEY_CLASS_LESSON_ACCESS = 'prime_class_lesson_access_v1';
/** 보안 규칙의 classes.size() 상한과 같은 값 */
export const MAX_CLASS_LESSON_ACCESS = 60;

const KEY_SEP = '|';

/** 반별 설정 묶음: 반 키 → 1~6차시 열림 여부 */
export type ClassLessonAccessMap = Record<string, LessonAccessConfig>;

export interface ClassIdentity {
  school?: string | null;
  grade?: string | number | null;
  classNum?: string | number | null;
}

function cleanPart(v: unknown): string {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim().replace(/\|/g, '');
  // '03'과 '3'은 같은 반
  return /^\d+$/.test(s) ? String(Number(s)) : s;
}

/** 학교·학년·반 → 반 키 (예: '수일고|1|3'). 셋 중 하나라도 비면 null */
export function makeClassKey(info: ClassIdentity | null | undefined): string | null {
  if (!info) return null;
  const school = cleanPart(info.school);
  const grade = cleanPart(info.grade);
  const classNum = cleanPart(info.classNum);
  if (!school || !grade || !classNum) return null;
  return [school, grade, classNum].join(KEY_SEP);
}

/** 반 키 → 화면 이름 (예: '수일고 1학년 3반') */
export function classKeyLabel(key: string): string {
  const [school, grade, classNum] = key.split(KEY_SEP);
  if (!school || !grade || !classNum) return key;
  return `${school} ${grade}학년 ${classNum}반`;
}

/** 반 키 정렬: 학교 → 학년(숫자) → 반(숫자) */
export function compareClassKeys(a: string, b: string): number {
  const [sa, ga, ca] = a.split(KEY_SEP);
  const [sb, gb, cb] = b.split(KEY_SEP);
  if (sa !== sb) return (sa || '').localeCompare(sb || '', 'ko');
  const gd = (parseInt(ga, 10) || 0) - (parseInt(gb, 10) || 0);
  if (gd !== 0) return gd;
  return (parseInt(ca, 10) || 0) - (parseInt(cb, 10) || 0);
}

function stripMeta(config: LessonAccessConfig): LessonAccessConfig {
  const out = { ...config };
  delete out.updatedAt;
  delete out.updatedBy;
  return out;
}

/**
 * 한 반의 저장값을 읽습니다. l1~l6 모든 칸이 true/false여야 인정합니다.
 * (칸이 빠진 값을 '열림'으로 채우면 잠가 둔 차시가 열릴 수 있으므로, 이상한 값은 버리고 전체 설정을 따르게 함)
 */
function readClassEntry(raw: unknown): LessonAccessConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const complete = ALL_LESSON_NUMBERS.every((n) => typeof obj[`l${n}`] === 'boolean' || typeof obj[String(n)] === 'boolean');
  if (!complete) return null;
  return stripMeta(normalizeLessonAccess(obj));
}

/** 서버 문서(또는 브라우저에 기억한 값) → 반별 설정 묶음. 형식이 틀린 반은 빼고, 그 반은 전체 설정을 따릅니다. */
export function normalizeClassLessonAccess(raw: unknown): {
  map: ClassLessonAccessMap;
  skipped: string[];
} {
  const map: ClassLessonAccessMap = {};
  const skipped: string[] = [];
  if (!raw || typeof raw !== 'object') return { map, skipped };
  const classes = (raw as Record<string, unknown>).classes;
  if (!classes || typeof classes !== 'object') return { map, skipped };
  for (const [key, value] of Object.entries(classes as Record<string, unknown>)) {
    const entry = key.split(KEY_SEP).length === 3 ? readClassEntry(value) : null;
    if (entry) map[key] = entry;
    else skipped.push(key);
  }
  return { map, skipped };
}

/** 학생에게 적용할 차시 잠금: 그 반 설정이 있으면 반 설정, 없으면 전체 설정 */
export function resolveStudentLessonAccess(
  globalConfig: LessonAccessConfig,
  classMap: ClassLessonAccessMap,
  classKey: string | null
): { config: LessonAccessConfig; source: 'class' | 'global' } {
  if (classKey && Object.prototype.hasOwnProperty.call(classMap, classKey)) {
    return { config: classMap[classKey], source: 'class' };
  }
  return { config: globalConfig, source: 'global' };
}

/** 한 반 설정을 바꾸거나(config) 지운(null) 새 묶음. 원래 묶음은 바꾸지 않습니다. */
export function withClassLessonAccess(
  map: ClassLessonAccessMap,
  classKey: string,
  config: LessonAccessConfig | null
): ClassLessonAccessMap {
  const next: ClassLessonAccessMap = { ...map };
  if (config === null) {
    delete next[classKey];
  } else {
    next[classKey] = stripMeta(normalizeLessonAccess(config));
  }
  return next;
}

/** 서버에 쓸 classes 칸 ({ 반키: { l1..l6 } }) */
export function buildClassLessonAccessFirestoreClasses(
  map: ClassLessonAccessMap
): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const key of Object.keys(map).sort(compareClassKeys)) {
    const cfg = map[key];
    const fields: Record<string, boolean> = {};
    for (const n of ALL_LESSON_NUMBERS) fields[`l${n}`] = Boolean(cfg[n]);
    out[key] = fields;
  }
  return out;
}

/** 승인된 학생들의 반 키 목록 (중복 없이, 정렬) */
export function collectClassKeys(regs: Array<ClassIdentity & { status?: string }>): string[] {
  const set = new Set<string>();
  for (const r of regs) {
    if (r.status && r.status !== 'approved') continue;
    const key = makeClassKey(r);
    if (key) set.add(key);
  }
  return Array.from(set).sort(compareClassKeys);
}

/**
 * 반별 잠금 저장·읽기 실패 이유를 교사가 알 수 있는 말로 (2026-11-10)
 * Firebase 오류 코드를 함께 보여 주어 원인(규칙 미게시·연결·사용량)을 구분할 수 있게 함
 */
export function describeClassLessonAccessError(err: unknown): string {
  const e = (err ?? {}) as { code?: unknown; message?: unknown };
  const rawCode = typeof e.code === 'string' ? e.code : '';
  const code = rawCode.replace(/^firestore\//, '');
  const message = typeof e.message === 'string' ? e.message.slice(0, 160) : String(err ?? '').slice(0, 160);
  switch (code) {
    case 'permission-denied':
      return '서버가 저장을 거부했습니다 (permission-denied). 새 보안 규칙이 아직 게시되지 않았거나 다른 데이터베이스에 게시된 것 같습니다. Firebase 콘솔 → Firestore 맨 위에서 데이터베이스 ai-studio-526dd59d-…를 고른 뒤 규칙 탭에 새 firestore.rules를 게시해 주세요.';
    case 'unavailable':
    case 'deadline-exceeded':
      return `서버에 연결하지 못했습니다 (${code}). 인터넷 연결을 확인한 뒤 다시 눌러 주세요.`;
    case 'resource-exhausted':
      return 'Firebase 사용량 한도에 걸렸습니다 (resource-exhausted). 잠시 뒤 다시 시도하거나 Firebase 사용량을 확인해 주세요.';
    case 'unauthenticated':
      return '교사 로그인이 풀렸습니다 (unauthenticated). 로그아웃 후 교사 계정으로 다시 로그인해 주세요.';
    case 'invalid-argument':
      return `저장 형식 오류입니다 (invalid-argument: ${message}). 이 문구를 그대로 알려 주세요.`;
    default:
      return `저장하지 못했습니다 (${code || '오류 코드 없음'}: ${message}). 이 문구를 그대로 알려 주세요.`;
  }
}
