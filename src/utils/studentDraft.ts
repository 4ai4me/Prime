import type { StudentRecord } from './mathLogic';

/**
 * 학생별 기기 임시 보관(localStorage) — 순수 로직 (단위 테스트 대상)
 * ------------------------------------------------------------------
 * 예전에는 기기에 활동지를 키 하나(STORAGE_KEY_STUDENT)로만 보관하고, 로그인할 때
 * 그 내용을 새 학생의 서버 활동지와 합쳤습니다. 그래서 공용 기기에서 A 학생 다음에
 * B 학생이 로그인하면 A의 답안이 B의 빈 칸에 섞여 B의 문서로 저장될 수 있었습니다.
 *
 * 이제는
 *  - 학생 모드에서는 학생 키별로 따로 보관하고(studentDraftKey),
 *  - 로그인할 때는 '같은 학생'의 보관본만 합치며(isRecordOfStudent),
 *  - 로그아웃할 때 서버 저장이 확인되면 그 학생의 보관본을 지웁니다.
 */

export interface StudentIdentityLike {
  school: string;
  grade: string;
  classNum: string;
  studentNum: string;
  name: string;
}

export function groupLabelOf(p: StudentIdentityLike): string {
  return `${p.school} ${p.grade}학년 ${p.classNum}반`.slice(0, 25);
}

export function codeLabelOf(p: StudentIdentityLike): string {
  return `${p.grade}${String(p.classNum).padStart(2, '0')}${String(p.studentNum).padStart(2, '0')}_${p.name}`.slice(
    0,
    25
  );
}

/** 학생별 임시 보관 키 */
export function studentDraftKey(baseKey: string, studentKey: string): string {
  return `${baseKey}::${studentKey}`;
}

/** 기기에 남아 있던 활동지가 이 학생의 것인지 (학번·이름 표시가 일치) */
export function isRecordOfStudent(
  record: Pick<StudentRecord, 'code' | 'group'> | null | undefined,
  profile: StudentIdentityLike
): boolean {
  if (!record) return false;
  return record.code === codeLabelOf(profile) && record.group === groupLabelOf(profile);
}
