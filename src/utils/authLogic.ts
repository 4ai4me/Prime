export const ADMIN_TEACHER_EMAIL = 'liha1634@gmail.com';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'planitia4ai@gmail.com';

export interface PasswordValidationResult {
  ok: boolean;
  error?: string;
  checks: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    digit: boolean;
    special: boolean;
  };
}

/**
 * 학생 비밀번호 검증 함수 (2026-11-28~ 가입 시 항상 필수)
 * 조건: 대문자, 소문자, 숫자, 특수문자 각 1자 이상 포함, 최소 8자리 ~ 최대 32자리
 * (비밀번호 원문은 서버로 보내지 않고 해시만 보내므로, 이 검사는 학생 화면에서만 합니다)
 */
export function validateStudentPassword(rawPassword: string = ''): PasswordValidationResult {
  const pwd = rawPassword;
  const checks = {
    length: pwd.length >= 8 && pwd.length <= 32,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    digit: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9\s]/.test(pwd),
  };

  const allPassed =
    checks.length && checks.upper && checks.lower && checks.digit && checks.special;

  if (!allPassed) {
    return {
      ok: false,
      error:
        '비밀번호는 대문자, 소문자, 숫자, 특수문자를 모두 포함하여 최소 8자리~최대 32자리로 입력해 주세요.',
      checks,
    };
  }

  return { ok: true, checks };
}

export function isAuthorizedAdminEmail(
  email: string | null | undefined,
  emailVerified?: boolean
): boolean {
  if (!email || !emailVerified) return false;
  const normalized = email.trim().toLowerCase();
  return normalized === ADMIN_TEACHER_EMAIL || normalized === BOOTSTRAPPED_ADMIN_EMAIL;
}

/**
 * Formats a deterministic pseudo-MAC / Hardware Device ID from hardware traits + persistent token
 * Matches `^[a-zA-Z0-9_\-]+$` for Firestore rules compatibility while displaying a readable MAC format in UI.
 */
export function computeDeterministicDeviceHash(traits: string): string {
  let h1 = 0xdeadbeef ^ traits.length;
  let h2 = 0x41c6ce57 ^ traits.length;
  for (let i = 0, ch; i < traits.length; i++) {
    ch = traits.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  return `DEV_${hex.toUpperCase().slice(0, 12)}`;
}

export function formatDeviceHashAsMac(deviceHash: string): string {
  const clean = deviceHash
    .replace(/^DEV_/, '')
    .replace(/[^0-9A-Fa-f]/g, '')
    .padEnd(12, '0')
    .slice(0, 12)
    .toUpperCase();
  return clean.match(/.{1,2}/g)?.join(':') || deviceHash;
}
