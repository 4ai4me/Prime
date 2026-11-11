/**
 * 학생 비밀번호 — 순수 로직 (Firebase에 의존하지 않음, 단위 테스트 대상)
 * ------------------------------------------------------------------
 * ⚠️ Func와 Props는 같은 데이터베이스·같은 학생을 공유하므로, 이 파일의 해시 방식은
 *    두 저장소에서 반드시 똑같아야 합니다. 바꾸면 기존 비밀번호가 모두 맞지 않게 됩니다.
 *
 * - 비밀번호 원문은 어디에도 저장하지 않고, SHA-256 해시(64자리 16진수)만 저장합니다.
 * - 해시에 학생 키를 섞어(salt) 같은 비밀번호라도 학생마다 해시가 다르게 만듭니다.
 * - 다른 기기에서 다시 연결할 때는 "해시:임의값" 형태의 증명을 보내고, 보안 규칙이
 *   해시 부분을 저장된 해시와 비교합니다. 임의값이 매번 바뀌므로 문서에 남은 예전 증명을
 *   재사용하는 방식으로는 통과할 수 없습니다(규칙이 이 필드가 '이번에 바뀌었는지'도 검사).
 */

export const PASSWORD_HASH_PREFIX = 'props-func-student-pw-v1';

const HEX64 = /^[0-9a-f]{64}$/;

export function isPasswordHash(value: unknown): value is string {
  return typeof value === 'string' && HEX64.test(value);
}

/** 학생에게 비밀번호가 설정되어 있는지 */
export function hasStudentPassword(doc: { passwordHash?: unknown } | null | undefined): boolean {
  return isPasswordHash(doc?.passwordHash);
}

/** 비밀번호 사용 설정이 켜져 있는데 아직 비밀번호가 없어 먼저 설정해야 하는지 */
export function needsPasswordSetup(
  passwordRequired: boolean,
  doc: { passwordHash?: unknown } | null | undefined
): boolean {
  return passwordRequired && !hasStudentPassword(doc);
}

export async function hashStudentPassword(studentKey: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${PASSWORD_HASH_PREFIX}|${studentKey}|${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomNonce(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** 재연결 요청에 담을 비밀번호 증명: "해시:임의값" */
export function makeClaimProof(passwordHash: string): string {
  return `${passwordHash}:${randomNonce()}`;
}
