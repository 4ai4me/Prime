export interface StudentIdentityInput {
  school: string;
  grade: string;
  classNum: string;
  studentNum: string;
  birthDate: string;
  name: string;
  password?: string;
}

export const ADMIN_TEACHER_EMAIL = 'liha1634@gmail.com';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'planitia4ai@gmail.com';

/**
 * 비밀번호 형식 검사의 기본값 (validateStudentRegistrationInput 에 enforcePassword를 주지 않았을 때).
 * ⚠️ 실제 비밀번호 사용 여부는 이 상수가 아니라, 교사가 [학생 가입 관리]에서 켜고 끄는
 *    app_settings/student_auth.passwordRequired 설정으로 정합니다 (src/utils/studentPassword.ts).
 */
export const STUDENT_PASSWORD_FEATURE_ENABLED = false;

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
 * 학생 비밀번호 검증 함수
 * 조건: 대문자, 소문자, 숫자, 특수문자 각 1자 이상 포함, 최소 8자리 ~ 최대 32자리
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
 * Converts a Korean/alphanumeric school name and student numbers into an ASCII-safe Firestore Document ID
 * matching `^[a-zA-Z0-9_\-]+$` (length 3..120).
 */
export function buildSafeStudentKey(input: {
  school: string;
  grade: string;
  classNum: string;
  studentNum: string;
}): string {
  const schoolTrimmed = input.school.trim().replace(/\s+/g, '');
  let schoolHex = '';
  for (let i = 0; i < Math.min(schoolTrimmed.length, 16); i++) {
    schoolHex += schoolTrimmed.charCodeAt(i).toString(16);
  }
  const g = String(parseInt(input.grade.trim(), 10) || 0);
  const c = String(parseInt(input.classNum.trim(), 10) || 0).padStart(2, '0');
  const n = String(parseInt(input.studentNum.trim(), 10) || 0).padStart(2, '0');
  return `stu_${schoolHex || 'sch'}_g${g}_c${c}_n${n}`.slice(0, 110);
}

/**
 * Normalizes birthDate to YYYY-MM-DD or 6-digit YYMMDD
 */
export function normalizeBirthDate(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  if (digits.length === 6) {
    return digits;
  }
  return raw.trim();
}

/**
 * Compares two birthDate strings flexibly so both 6-digit (e.g. "100212") and 8-digit ("2010-02-12" / "20100212") match.
 */
export function isSameBirthDate(a: string, b: string): boolean {
  const da = (a || '').replace(/[^0-9]/g, '');
  const db = (b || '').replace(/[^0-9]/g, '');
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 6 && db.length >= 6) {
    return da.slice(-6) === db.slice(-6);
  }
  return false;
}

export function validateStudentRegistrationInput(
  input: StudentIdentityInput,
  options?: { enforcePassword?: boolean }
): {
  ok: boolean;
  error?: string;
} {
  const school = input.school.trim();
  const grade = input.grade.trim();
  const classNum = input.classNum.trim();
  const studentNum = input.studentNum.trim();
  const birthDate = normalizeBirthDate(input.birthDate);
  const name = input.name.trim();

  if (school.length < 2 || school.length > 40) {
    return { ok: false, error: '학교 이름을 2~40자 사이로 입력해 주세요. (예: 수일고등학교)' };
  }
  const gNum = Number(grade);
  if (!Number.isInteger(gNum) || gNum < 1 || gNum > 6) {
    return { ok: false, error: '학년을 1~6 사이의 숫자로 입력해 주세요.' };
  }
  const cNum = Number(classNum);
  if (!Number.isInteger(cNum) || cNum < 1 || cNum > 50) {
    return { ok: false, error: '반 번호를 1~50 사이의 숫자로 입력해 주세요.' };
  }
  const sNum = Number(studentNum);
  if (!Number.isInteger(sNum) || sNum < 1 || sNum > 99) {
    return { ok: false, error: '출석 번호를 1~99 사이의 숫자로 입력해 주세요.' };
  }
  const birthDigits = birthDate.replace(/[^0-9]/g, '');
  if (birthDigits.length !== 6 && birthDigits.length !== 8) {
    return {
      ok: false,
      error: '생년월일을 6자리(예: 100212) 또는 8자리(예: 2010-02-12)로 입력해 주세요.',
    };
  }
  if (name.length < 2 || name.length > 25) {
    return { ok: false, error: '이름을 2~25자 사이로 정확히 입력해 주세요.' };
  }

  const shouldCheckPassword = options?.enforcePassword ?? STUDENT_PASSWORD_FEATURE_ENABLED;
  if (shouldCheckPassword) {
    const pwdRes = validateStudentPassword(input.password || '');
    if (!pwdRes.ok) {
      return { ok: false, error: pwdRes.error };
    }
  }

  return { ok: true };
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
