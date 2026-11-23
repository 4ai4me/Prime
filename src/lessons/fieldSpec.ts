import { sanitizeHelpSource } from '../utils/lessonCommon';

/**
 * 차시 답안 칸 정리 도구 (3차시부터 공용)
 * 칸마다 형식을 적어 두면, 불러올 때 형식이 틀린 값·모르는 칸을 버리고 칸 순서는 그대로 지킵니다
 * (순서가 바뀌면 차시 JSON이 달라져 불필요한 재저장이 생기므로).
 */
export type FieldKind =
  | 'string'
  | 'bool'
  | 'numArray'
  | 'strArray'
  | 'helpSource'
  | { oneOf: readonly string[] };

export type FieldSpec = Record<string, FieldKind>;

/** 모든 차시 공통 칸 */
export const COMMON_SPEC: FieldSpec = { reflection1: 'string', reflection2: 'string', helpSource: 'helpSource' };

function cleanValue(kind: FieldKind, v: unknown): unknown {
  if (kind === 'string') return typeof v === 'string' ? v.slice(0, 2000) : undefined;
  if (kind === 'bool') return typeof v === 'boolean' ? v : undefined;
  if (kind === 'numArray') {
    if (!Array.isArray(v)) return undefined;
    return v.filter((x): x is number => Number.isSafeInteger(x) && (x as number) >= 0 && (x as number) <= 1000000).slice(0, 40);
  }
  if (kind === 'strArray') {
    if (!Array.isArray(v)) return undefined;
    return [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length <= 40))].slice(0, 40);
  }
  if (kind === 'helpSource') return sanitizeHelpSource(v);
  return typeof v === 'string' && kind.oneOf.includes(v) ? v : '';
}

export function cleanBySpec<T>(raw: unknown, spec: FieldSpec): T {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {} as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const kind = spec[k];
    if (!kind) continue; // 모르는 칸은 버림
    const cleaned = cleanValue(kind, v);
    if (cleaned !== undefined) out[k] = cleaned;
  }
  return out as T;
}

/**
 * 답 고치기: 바뀐 칸에 딸린 ✓(점검 통과)를 지움
 * @param verifyOf 고친 칸 → 지울 확인 칸
 */
export function patchWithVerify<T extends object>(prev: T, patch: Partial<T>, verifyOf: Partial<Record<keyof T, keyof T>>): T {
  const next = { ...prev, ...patch } as T;
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const v = verifyOf[key];
    if (v && JSON.stringify(prev[key]) !== JSON.stringify(patch[key]) && next[v]) {
      (next as Record<string, unknown>)[v as string] = false;
    }
  }
  return next;
}

/** 확인 칸 이름 목록 → 그 칸을 지우는 고친 칸 표 만들기 */
export function verifyMap<T>(groups: Array<[keyof T, Array<keyof T>]>): Partial<Record<keyof T, keyof T>> {
  const out: Partial<Record<keyof T, keyof T>> = {};
  for (const [verified, fields] of groups) for (const f of fields) out[f] = verified;
  return out;
}

export interface CheckResult {
  ok: boolean;
  messages: string[];
}
export const pass = (msg: string): CheckResult => ({ ok: true, messages: [msg] });
export const fail = (...messages: string[]): CheckResult => ({ ok: false, messages });
