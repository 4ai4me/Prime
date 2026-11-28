/**
 * 예전 방식(실명·학번·생년월일) 가입 정보 정리 — 교사 전용, 1회 실행
 * ------------------------------------------------------------------
 * 2026-11-28 가상 정보 가입으로 바꾸면서 예전 개인정보를 데이터베이스에서 지웁니다.
 * 백업은 만들지 않습니다(되돌릴 수 없음 — 사용자 결정).
 *
 * 학생마다 (한 번에 함께 처리되어 중간에 끊겨도 반쯤 옮겨진 학생이 생기지 않음)
 *   1) 무작위 순서로 '이전기록-001' 같은 번호를 붙여 새 문서 student_registrations/legacy_001 을 만들고
 *      학년과 가명 처리한 활동지만 남깁니다 (학교·반·번호·생년월일·이름 없음)
 *   2) 네 사이트의 차시 문서(func/props/prime/rational_lessons)를 새 문서 아래로 옮기며
 *      글 속에 적힌 실명을 '○○○'로 바꿉니다
 *   3) 예전 문서와 예전 차시 문서를 지웁니다 (문서 키에도 학교·반·번호가 들어 있었음)
 * 그다음
 *   4) 기기 중복 방지 잠금(device_locks)을 모두 지웁니다
 *   5) 접속 기록 중 예전 방식 학생 것(실명 포함)을 지웁니다
 *   6) 반별 차시 잠금에서 예전 반(학교 이름|학년|반) 설정을 지웁니다
 *
 * 다시 실행하면 아직 남은 예전 문서만 처리합니다.
 * ⚠️ 이 파일은 Func·Props·Prime·Rational 네 저장소에서 똑같아야 합니다.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  query,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  LEGACY_ARCHIVE_SCHEMA,
  LEGACY_ARCHIVE_STATUS,
  isGradeOption,
  isV2Registration,
  isV2StudentKey,
  isYearString,
  legacyArchiveKey,
  legacySerialLabel,
  scrubLegacyJson,
  shuffled,
} from './studentIdentity';

/** 한 데이터베이스를 쓰는 네 사이트의 차시 문서 묶음 */
export const ALL_LESSON_COLLECTIONS = ['func_lessons', 'props_lessons', 'prime_lessons', 'rational_lessons'] as const;

/** 반별 차시 잠금 문서 (반 키 안에 예전 학교 이름이 들어 있음) */
const CLASS_LESSON_ACCESS_DOCS = [
  'func_lesson_access_classes',
  'prime_lesson_access_classes',
  'rational_lesson_access_classes',
] as const;

export interface LegacyArchiveDoc {
  studentKey: string;
  schema: typeof LEGACY_ARCHIVE_SCHEMA;
  legacySerial: string;
  grade: string;
  status: typeof LEGACY_ARCHIVE_STATUS;
  worksheetJson: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function isLegacyArchiveDoc(d: unknown): d is LegacyArchiveDoc {
  return !!d && typeof d === 'object' && (d as { schema?: unknown }).schema === LEGACY_ARCHIVE_SCHEMA;
}

/** 새 방식 반 키(년도|학년|반이름)인지 */
export function isV2ClassKey(key: string): boolean {
  const [year, grade, className] = key.split('|');
  return isYearString(year) && isGradeOption(grade) && !!className;
}

export interface LegacyScanResult {
  /** 아직 정리하지 않은 예전 방식 가입 문서 수 */
  legacyRegistrations: number;
  /** 이미 만든 이전기록 문서 수 */
  archives: number;
  deviceLocks: number;
  legacyAccessLogs: number;
}

function isLegacyRegistration(id: string, data: DocumentData): boolean {
  return !isV2Registration(data) && !isLegacyArchiveDoc(data) && !isV2StudentKey(id);
}

export async function scanLegacyData(): Promise<LegacyScanResult> {
  const [regs, locks, logs] = await Promise.all([
    getDocs(collection(db, 'student_registrations')),
    getDocs(collection(db, 'device_locks')),
    getDocs(collection(db, 'student_access_logs')),
  ]);
  let legacyRegistrations = 0;
  let archives = 0;
  regs.forEach((d) => {
    if (isLegacyArchiveDoc(d.data())) archives++;
    else if (isLegacyRegistration(d.id, d.data())) legacyRegistrations++;
  });
  let legacyAccessLogs = 0;
  logs.forEach((d) => {
    if (!isV2StudentKey(String(d.data().studentKey || ''))) legacyAccessLogs++;
  });
  return { legacyRegistrations, archives, deviceLocks: locks.size, legacyAccessLogs };
}

export interface LegacyCleanupProgress {
  done: number;
  total: number;
  step: string;
}

export interface LegacyCleanupResult {
  archived: number;
  movedLessonDocs: number;
  deletedDeviceLocks: number;
  deletedAccessLogs: number;
  cleanedClassAccessKeys: number;
}

const BATCH_LIMIT = 450;

async function deleteInBatches(paths: { col: string; id: string }[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < paths.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const p of paths.slice(i, i + BATCH_LIMIT)) batch.delete(doc(db, p.col, p.id));
    await batch.commit();
    n += Math.min(BATCH_LIMIT, paths.length - i);
  }
  return n;
}

export async function runLegacyCleanup(
  onProgress: (p: LegacyCleanupProgress) => void
): Promise<LegacyCleanupResult> {
  const regsSnap = await getDocs(collection(db, 'student_registrations'));
  const legacy: { id: string; data: DocumentData }[] = [];
  let maxSerial = 0;
  regsSnap.forEach((d) => {
    const data = d.data();
    if (isLegacyArchiveDoc(data)) {
      const m = /^legacy_(\d+)$/.exec(d.id);
      if (m) maxSerial = Math.max(maxSerial, Number(m[1]));
    } else if (isLegacyRegistration(d.id, data)) {
      legacy.push({ id: d.id, data });
    }
  });

  // 번호가 예전 반·번호 순서를 드러내지 않도록 무작위 순서
  const order = shuffled(legacy);
  let archived = 0;
  let movedLessonDocs = 0;
  for (let i = 0; i < order.length; i++) {
    const { id: oldKey, data } = order[i];
    onProgress({ done: i, total: order.length, step: '예전 가입 정보를 이전기록으로 옮기는 중' });
    const serial = maxSerial + i + 1;
    const newKey = legacyArchiveKey(serial);
    const realNames = [data.name, data.claimName].filter((x): x is string => typeof x === 'string');

    const lessonSnaps = await Promise.all(
      ALL_LESSON_COLLECTIONS.map((c) => getDocs(collection(db, 'student_registrations', oldKey, c)))
    );

    const batch = writeBatch(db);
    batch.set(doc(db, 'student_registrations', newKey), {
      studentKey: newKey,
      schema: LEGACY_ARCHIVE_SCHEMA,
      legacySerial: legacySerialLabel(serial),
      grade: String(data.grade ?? '').slice(0, 5),
      status: LEGACY_ARCHIVE_STATUS,
      worksheetJson: scrubLegacyJson(typeof data.worksheetJson === 'string' ? data.worksheetJson : '{}', realNames),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    lessonSnaps.forEach((snap, ci) => {
      const col = ALL_LESSON_COLLECTIONS[ci];
      snap.forEach((ld) => {
        const l = ld.data();
        const base = {
          studentKey: newKey,
          schemaVersion: l.schemaVersion,
          data: scrubLegacyJson(typeof l.data === 'string' ? l.data : '{}', realNames),
          updatedAt: serverTimestamp(),
        };
        const copy =
          ld.id === 'teacher' ? base : { ...base, lesson: l.lesson, clientUpdatedAt: String(l.clientUpdatedAt || '') };
        batch.set(doc(db, 'student_registrations', newKey, col, ld.id), copy);
        batch.delete(ld.ref);
        movedLessonDocs++;
      });
    });
    batch.delete(doc(db, 'student_registrations', oldKey));
    await batch.commit();
    archived++;
  }

  onProgress({ done: order.length, total: order.length, step: '기기 잠금·접속 기록을 지우는 중' });
  const locks = await getDocs(collection(db, 'device_locks'));
  const deletedDeviceLocks = await deleteInBatches(locks.docs.map((d) => ({ col: 'device_locks', id: d.id })));

  const logs = await getDocs(collection(db, 'student_access_logs'));
  const deletedAccessLogs = await deleteInBatches(
    logs.docs
      .filter((d) => !isV2StudentKey(String(d.data().studentKey || '')))
      .map((d) => ({ col: 'student_access_logs', id: d.id }))
  );

  onProgress({ done: order.length, total: order.length, step: '반별 차시 잠금의 예전 반 설정을 지우는 중' });
  let cleanedClassAccessKeys = 0;
  for (const id of CLASS_LESSON_ACCESS_DOCS) {
    const snap = await getDoc(doc(db, 'app_settings', id));
    if (!snap.exists()) continue;
    const cur = snap.data();
    const classes = (cur.classes && typeof cur.classes === 'object' ? cur.classes : {}) as Record<string, unknown>;
    const kept: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(classes)) {
      if (isV2ClassKey(k)) kept[k] = v;
      else cleanedClassAccessKeys++;
    }
    if (Object.keys(kept).length === Object.keys(classes).length) continue;
    await setDoc(doc(db, 'app_settings', id), {
      classes: kept,
      updatedBy: String(cur.updatedBy || 'legacy-cleanup').slice(0, 120),
      updatedAt: serverTimestamp(),
    });
  }

  return { archived, movedLessonDocs, deletedDeviceLocks, deletedAccessLogs, cleanedClassAccessKeys };
}

/** 교사 화면: 이전기록 문서 목록 (교사만 읽기) */
export async function loadLegacyArchives(): Promise<LegacyArchiveDoc[]> {
  const snap = await getDocs(
    query(collection(db, 'student_registrations'), where('status', '==', LEGACY_ARCHIVE_STATUS))
  );
  const out: LegacyArchiveDoc[] = [];
  snap.forEach((d) => {
    const data = d.data();
    if (isLegacyArchiveDoc(data)) out.push(data);
  });
  out.sort((a, b) => a.legacySerial.localeCompare(b.legacySerial));
  return out;
}
