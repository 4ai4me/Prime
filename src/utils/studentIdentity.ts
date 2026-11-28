/**
 * 학생 가상 정보 가입 — 순수 로직 (Firebase에 의존하지 않음, 단위 테스트 대상)
 * ------------------------------------------------------------------
 * 2026-11-28~ 학생은 실명·학번·생년월일 대신 아래 '가상 정보'로 가입합니다.
 *   학교 "하연 학교"(고정) · 년도(가입일, 한국 시간, 고정) · 랜덤 한글 이름(2~4자, 중복 불가)
 *   · 학년(중1~고3) · 교사가 만든 새 이름 반(예: 참새반) · 비밀번호(필수)
 * 실제 학생과 가상 이름의 대응은 교사가 오프라인(종이)으로만 관리합니다.
 *
 * ⚠️ 이 파일은 Func·Props·Prime·Rational 네 저장소에서 똑같아야 합니다.
 *    (한 데이터베이스·같은 학생 계정을 함께 쓰고, 보안 규칙 firestore.rules와 형식이 맞물림)
 */

// ------------------------------------------------------------------
// 고정값
// ------------------------------------------------------------------

export const FIXED_SCHOOL_NAME = '하연 학교';

/** 새 방식 가입 문서 표시 (보안 규칙도 schema == 2 로 새 방식을 구분) */
export const REGISTRATION_SCHEMA_V2 = 2;

export const GRADE_OPTIONS = ['중1', '중2', '중3', '고1', '고2', '고3'] as const;
export type GradeOption = (typeof GRADE_OPTIONS)[number];

export function isGradeOption(v: unknown): v is GradeOption {
  return typeof v === 'string' && (GRADE_OPTIONS as readonly string[]).includes(v);
}

/** 학년 정렬 순서 (모르는 값은 맨 뒤) */
export function gradeOrder(grade: string): number {
  const i = (GRADE_OPTIONS as readonly string[]).indexOf(grade);
  return i < 0 ? GRADE_OPTIONS.length : i;
}

/** 한국 시간(UTC+9) 기준 년도. 보안 규칙도 request.time + 9시간의 년도로 같은 값을 확인합니다. */
export function koreanYearOf(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return String(kst.getUTCFullYear());
}

export function isYearString(v: unknown): v is string {
  return typeof v === 'string' && /^20[0-9]{2}$/.test(v);
}

// ------------------------------------------------------------------
// 학생 문서 키 (= 가상 이름). 같은 이름은 같은 문서라 서버가 중복 가입을 막습니다.
// ------------------------------------------------------------------

export const V2_KEY_PREFIX = 'v2_';
const HANGUL_NAME = /^[가-힣]{2,4}$/;

export function isValidStudentName(name: unknown): name is string {
  return typeof name === 'string' && HANGUL_NAME.test(name);
}

export function studentKeyForName(name: string): string {
  return `${V2_KEY_PREFIX}${name.trim()}`;
}

export function isV2StudentKey(key: unknown): key is string {
  return typeof key === 'string' && key.startsWith(V2_KEY_PREFIX) && isValidStudentName(key.slice(V2_KEY_PREFIX.length));
}

/** 새 방식(가상 정보) 가입 문서인지. 예전 방식 문서로는 어떤 경우에도 입장하지 않습니다. */
export function isV2Registration(doc: unknown): boolean {
  if (!doc || typeof doc !== 'object') return false;
  const d = doc as { schema?: unknown; studentKey?: unknown; name?: unknown };
  return (
    d.schema === REGISTRATION_SCHEMA_V2 &&
    isV2StudentKey(d.studentKey) &&
    d.studentKey === studentKeyForName(String(d.name ?? ''))
  );
}

// ------------------------------------------------------------------
// 랜덤 이름
// ------------------------------------------------------------------

const SINGLE_SURNAMES = [
  '김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황',
  '안', '송', '류', '전', '홍', '고', '문', '양', '손', '배', '백', '허', '남', '심', '노', '하',
  '곽', '성', '차', '주', '우', '구', '민', '진', '나', '지', '엄', '채', '원', '천', '방', '공',
  '현', '함', '변', '염', '여', '추', '도', '소', '석', '선', '설', '마', '길', '연', '위', '표',
  '명', '기', '반', '왕', '금', '옥', '육', '인', '맹', '제', '모', '탁', '국', '어', '은', '편', '용',
] as const;

const COMPOUND_SURNAMES = ['남궁', '황보', '제갈', '선우', '독고', '사공', '서문'] as const;

/** 이름에 쓰는 음절 — 흔하고 뜻이 무난한 음절만 골라 이상한 단어가 나오지 않게 합니다. */
const GIVEN_SYLLABLES = [
  '가', '경', '규', '기', '나', '다', '단', '도', '동', '라', '란', '래', '려', '로', '루', '리',
  '린', '명', '민', '별', '보', '빈', '산', '서', '선', '설', '성', '세', '소', '솔', '수', '슬',
  '승', '시', '아', '연', '영', '예', '온', '완', '우', '운', '원', '유', '윤', '율', '은', '의',
  '인', '재', '정', '주', '준', '지', '진', '찬', '채', '초', '태', '하', '한', '해', '현', '혜',
  '호', '화', '환', '휘', '희', '결', '겸', '담', '람', '봄', '새', '훈', '건', '범', '빛', '석',
] as const;

/**
 * 만들지 않을 이름: 널리 알려진 실존 인물 (모든 실존 인물을 걸러낼 수는 없으므로
 * 교실 대면 승인이 마지막 확인 단계입니다)
 */
const BLOCKED_NAMES = new Set([
  '김정은', '박정희', '이재명', '문재인', '김연아', '김민재', '한동훈', '이준석', '김건희',
  '이순신', '세종', '김구', '유관순', '안중근', '윤동주', '이승만', '김대중', '노무현',
  '박근혜', '이명박', '윤석열', '전두환', '노태우', '김영삼', '손흥민', '이강인', '유재석',
]);

/**
 * 이름 어디에든(성과 이름 사이, 이름 두 글자 사이) 들어 있으면 다시 만드는 말 (2026-11-28)
 * 놀림거리가 되거나 혐오스럽거나 성적인 말. 위 음절 목록으로 실제로 만들어질 수 있는 말을
 * 빠짐없이 넣고(단위 테스트가 확인), 비슷한 말도 함께 넣었습니다.
 */
export const BLOCKED_NAME_PARTS = [
  // 성적인 말·신체
  '성기', '보지', '자지', '고환', '음경', '사정', '정액', '정자', '성교', '성인', '성애', '성욕', '명기', '오나',
  '섹스', '애무', '자위', '유두', '유방', '동정', '배란', '수유', '모유', '임산', '임신', '동성', '야동', '음란',
  '변태', '추행', '창녀', '기생', '화류',
  // 배설·지저분한 말
  '변기', '변소', '소변', '대변', '배설', '방귀', '방구', '설사', '지린', '지림', '가래', '구린', '구리', '하수',
  // 비하·차별·혐오
  '노예', '하인', '천민', '천한', '빈민', '노비', '고아', '노인', '노화', '노가다', '거지', '백인', '황인', '흑인',
  '한남', '한녀', '김치녀', '홍어', '운지', '일베', '나치', '공산', '인민', '빨갱', '장애', '병신',
  // 욕·놀림
  '지랄', '시발', '씨발', '새끼', '개새', '호로', '호래', '미친', '또라', '도라', '바보', '멍청', '찐따', '왕따',
  '호구', '구라', '재수', '한심', '추하', '추한', '추태', '추남', '추녀', '별로', '가라', '꺼져',
  '돼지', '하마', '고래', '모기', '기린', '염소', '여우', '여시', '오리', '원숭', '빈대', '벌레',
  '아기', '아가', '유아',
  // 범죄·술·죽음
  '범인', '전범', '강도', '도둑', '원수', '마약', '도박', '소주', '양주', '탁주', '주정', '주사',
  '마귀', '악마', '귀신', '자살', '살인', '시체', '사망', '해골',
] as const;

export function isBlockedName(name: string): boolean {
  if (BLOCKED_NAMES.has(name)) return true;
  // 선생님 이름(하연)이 들어간 이름은 만들지 않음
  if (name.includes('하연')) return true;
  return BLOCKED_NAME_PARTS.some((w) => name.includes(w));
}

export type RandomFn = () => number;

function pick<T>(list: readonly T[], rnd: RandomFn): T {
  const i = Math.min(list.length - 1, Math.floor(rnd() * list.length));
  return list[i];
}

/** 암호학적 난수가 있으면 사용 (없으면 Math.random) */
export function defaultRandom(): number {
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  } catch {
    return Math.random();
  }
}

/**
 * 한글 이름 하나를 만듭니다 (2~4자).
 *   2자 15% (성 + 1음절) · 3자 75% (성 + 2음절) · 4자 10% (두 글자 성 + 2음절)
 * 같은 음절이 연달아 나오는 이름(예: 김수수)은 다시 만듭니다.
 */
export function generateRandomName(rnd: RandomFn = defaultRandom): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const r = rnd();
    let name: string;
    if (r < 0.15) {
      name = pick(SINGLE_SURNAMES, rnd) + pick(GIVEN_SYLLABLES, rnd);
    } else if (r < 0.9) {
      const a = pick(GIVEN_SYLLABLES, rnd);
      const b = pick(GIVEN_SYLLABLES, rnd);
      if (a === b) continue;
      name = pick(SINGLE_SURNAMES, rnd) + a + b;
    } else {
      const a = pick(GIVEN_SYLLABLES, rnd);
      const b = pick(GIVEN_SYLLABLES, rnd);
      if (a === b) continue;
      name = pick(COMPOUND_SURNAMES, rnd) + a + b;
    }
    if (!isValidStudentName(name) || isBlockedName(name)) continue;
    // 성과 이름 첫 음절이 같은 이름(예: 하하윤)은 피함
    if (name.length >= 2 && name[name.length - 2] === name[name.length - 3]) continue;
    return name;
  }
  return '김새봄';
}

// ------------------------------------------------------------------
// 새 이름 반
// ------------------------------------------------------------------

/** 반 이름에 쓰는 새 이름 (뒤에 '반'을 붙여 사용). 같은 년도 안에서는 겹치지 않게 뽑습니다. */
export const BIRD_NAMES = [
  '참새', '병아리', '독수리', '까치', '까마귀', '비둘기', '부엉이', '올빼미', '제비', '갈매기',
  '백로', '왜가리', '두루미', '황새', '펭귄', '앵무새', '공작', '꿩', '메추리', '오리',
  '원앙', '기러기', '고니', '백조', '딱따구리', '뻐꾸기', '꾀꼬리', '종달새', '직박구리', '박새',
  '동박새', '곤줄박이', '할미새', '물총새', '파랑새', '동고비', '휘파람새', '굴뚝새', '오목눈이', '때까치',
  '찌르레기', '물까치', '어치', '소쩍새', '솔개', '황조롱이', '송골매', '참매', '물수리', '저어새',
  '따오기', '홍학', '펠리컨', '타조', '벌새', '큰부리새', '잉꼬', '카나리아', '문조', '십자매',
  '칠면조', '거위', '가마우지', '뜸부기', '도요새', '물떼새', '알바트로스', '콘도르', '호반새', '청둥오리',
  '비오리', '논병아리', '쇠백로', '멧새', '방울새', '콩새', '밀화부리', '상모솔새', '지빠귀', '흑두루미',
  '재두루미', '큰고니', '검독수리', '수리부엉이', '새매', '쏙독새', '후투티', '팔색조', '흰뺨검둥오리', '키위새',
] as const;

const CLASS_NAME_PATTERN = /^[가-힣]{1,8}반$/;

export function isValidClassName(v: unknown): v is string {
  return typeof v === 'string' && CLASS_NAME_PATTERN.test(v);
}

/** 한 년도의 반 목록: 학년 → 반 이름 목록 */
export type ClassRosterMap = Partial<Record<GradeOption, string[]>>;

export interface ClassRoster {
  year: string;
  classes: ClassRosterMap;
}

export const MAX_CLASSES_PER_GRADE = 15;

export function classRosterDocId(year: string): string {
  return `class_roster_${year}`;
}

/** 서버에서 읽은 반 목록을 검사해 안전한 형태로 바꿉니다 (형식이 틀린 칸은 버림). */
export function normalizeClassRoster(year: string, raw: unknown): ClassRoster {
  const classes: ClassRosterMap = {};
  const src = raw && typeof raw === 'object' ? (raw as { classes?: unknown }).classes : null;
  if (src && typeof src === 'object') {
    for (const g of GRADE_OPTIONS) {
      const list = (src as Record<string, unknown>)[g];
      if (!Array.isArray(list)) continue;
      const clean: string[] = [];
      for (const n of list) {
        if (isValidClassName(n) && !clean.includes(n)) clean.push(n);
      }
      if (clean.length > 0) classes[g] = clean.slice(0, MAX_CLASSES_PER_GRADE);
    }
  }
  return { year, classes };
}

export function allClassNamesOf(roster: ClassRoster): string[] {
  const out: string[] = [];
  for (const g of GRADE_OPTIONS) out.push(...(roster.classes[g] || []));
  return out;
}

/**
 * 한 학년의 반을 count개로 (다시) 만듭니다.
 * - keep(가입한 학생이 있는 반)은 그대로 두고, 나머지 칸만 새 이름으로 랜덤하게 채웁니다.
 * - 새 이름은 같은 년도의 다른 학년 반과도 겹치지 않습니다 (년도가 다르면 같아도 됨).
 */
export function regenerateGradeClasses(
  roster: ClassRoster,
  grade: GradeOption,
  count: number,
  keep: readonly string[],
  rnd: RandomFn = defaultRandom
): { ok: true; roster: ClassRoster } | { ok: false; error: string } {
  if (!Number.isInteger(count) || count < 0 || count > MAX_CLASSES_PER_GRADE) {
    return { ok: false, error: `반 개수는 0~${MAX_CLASSES_PER_GRADE} 사이로 입력해 주세요.` };
  }
  const current = roster.classes[grade] || [];
  const kept = current.filter((n) => keep.includes(n));
  if (count < kept.length) {
    return {
      ok: false,
      error: `${grade}에는 이미 학생이 가입한 반이 ${kept.length}개 있어서 ${count}개로 줄일 수 없습니다. (가입한 학생이 있는 반은 지우지 않습니다)`,
    };
  }
  // 같은 년도에서 이미 쓰는 이름 (이 학년의 버릴 반 이름은 다시 쓸 수 있음)
  const usedElsewhere = new Set<string>();
  for (const g of GRADE_OPTIONS) {
    if (g === grade) continue;
    for (const n of roster.classes[g] || []) usedElsewhere.add(n);
  }
  for (const n of kept) usedElsewhere.add(n);
  const pool = BIRD_NAMES.map((b) => `${b}반`).filter((n) => !usedElsewhere.has(n));
  const need = count - kept.length;
  if (pool.length < need) {
    return { ok: false, error: '쓸 수 있는 새 이름이 모자랍니다. 반 개수를 줄여 주세요.' };
  }
  // 랜덤 순서로 섞어 앞에서부터 사용
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const nextList = [...kept, ...shuffled.slice(0, need)];
  const classes: ClassRosterMap = { ...roster.classes };
  if (nextList.length === 0) delete classes[grade];
  else classes[grade] = nextList;
  return { ok: true, roster: { year: roster.year, classes } };
}

// ------------------------------------------------------------------
// 화면 표시
// ------------------------------------------------------------------

export interface V2IdentityLike {
  year?: string;
  grade?: string;
  className?: string;
  name?: string;
}

/** 예: "2026 중1 참새반" (활동지 머리글·교사 화면의 반 묶음) */
export function v2GroupLabel(p: V2IdentityLike): string {
  return `${p.year || ''} ${p.grade || ''} ${p.className || ''}`.trim().replace(/\s+/g, ' ').slice(0, 25);
}

/** 학생 구분 표시 (이름 자체가 고유하므로 이름만) */
export function v2CodeLabel(p: V2IdentityLike): string {
  return (p.name || '').slice(0, 25);
}

/** 예: "2026 중1 참새반 김하늘" */
export function v2FullLabel(p: V2IdentityLike): string {
  return `${v2GroupLabel(p)} ${p.name || ''}`.trim();
}

/** 교사 화면 정렬: 년도(최근 먼저) → 학년 → 반 → 이름 */
export function compareV2Identity(a: V2IdentityLike, b: V2IdentityLike): number {
  const y = String(b.year || '').localeCompare(String(a.year || ''));
  if (y !== 0) return y;
  const g = gradeOrder(a.grade || '') - gradeOrder(b.grade || '');
  if (g !== 0) return g;
  const c = String(a.className || '').localeCompare(String(b.className || ''), 'ko');
  if (c !== 0) return c;
  return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
}

// ------------------------------------------------------------------
// 가입 입력 검사
// ------------------------------------------------------------------

export interface V2RegistrationInput {
  name: string;
  grade: string;
  className: string;
  password: string;
  passwordConfirm: string;
}

export function validateV2RegistrationInput(
  input: V2RegistrationInput,
  roster: ClassRoster | null,
  validatePassword: (pw: string) => { ok: boolean; error?: string }
): { ok: true } | { ok: false; error: string } {
  if (!isValidStudentName(input.name)) {
    return { ok: false, error: '[랜덤 이름 만들기]를 눌러 이름을 먼저 정해 주세요.' };
  }
  if (!isGradeOption(input.grade)) {
    return { ok: false, error: '학년을 선택해 주세요.' };
  }
  const list = roster?.classes[input.grade] || [];
  if (!isValidClassName(input.className) || !list.includes(input.className)) {
    return { ok: false, error: '반을 선택해 주세요. (선생님이 만든 반 중에서 고릅니다)' };
  }
  const pw = validatePassword(input.password);
  if (!pw.ok) return { ok: false, error: pw.error || '비밀번호 형식을 확인해 주세요.' };
  if (input.password !== input.passwordConfirm) {
    return { ok: false, error: '비밀번호 확인이 일치하지 않습니다. 다시 입력해 주세요.' };
  }
  return { ok: true };
}

// ------------------------------------------------------------------
// 비밀번호 분실: 일회용 코드 (교사가 발급 → 학생이 새 비밀번호 설정에 1번 사용)
// ------------------------------------------------------------------

/** 헷갈리는 글자(I, O, 0, 1)를 뺀 32자 */
export const RESET_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RESET_CODE_LENGTH = 8;
export const RESET_CODE_TTL_MINUTES = 30;
export const RESET_CODE_HASH_PREFIX = 'props-func-student-reset-v1';

export function generateResetCode(rnd: RandomFn = defaultRandom): string {
  let out = '';
  for (let i = 0; i < RESET_CODE_LENGTH; i++) out += pick(RESET_CODE_ALPHABET.split(''), rnd);
  return out;
}

/** 보여 줄 때: ABCD-EFGH */
export function formatResetCode(code: string): string {
  const c = normalizeResetCode(code);
  return c.length === RESET_CODE_LENGTH ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** 학생 입력 정리: 대문자로, 하이픈·공백 제거 */
export function normalizeResetCode(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isWellFormedResetCode(raw: string): boolean {
  const c = normalizeResetCode(raw);
  return c.length === RESET_CODE_LENGTH && [...c].every((ch) => RESET_CODE_ALPHABET.includes(ch));
}

export async function hashResetCode(studentKey: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${RESET_CODE_HASH_PREFIX}|${studentKey}|${normalizeResetCode(code)}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------
// 예전 기록 (2026-11-28 이전 가입) — 교사만 읽기 전용, 2027-03-31까지
// ------------------------------------------------------------------

export const LEGACY_ARCHIVE_SCHEMA = 'legacy';
export const LEGACY_ARCHIVE_STATUS = 'archived';
/** 이 시각(한국 시간 2027-04-01 00:00) 이후에는 교사 화면에서도 이전 기록을 보여 주지 않습니다. */
export const LEGACY_VIEW_CLOSES_AT = Date.parse('2027-04-01T00:00:00+09:00');

export function isLegacyViewOpen(now: Date = new Date()): boolean {
  return now.getTime() < LEGACY_VIEW_CLOSES_AT;
}

export function legacySerialLabel(n: number): string {
  return `이전기록-${String(n).padStart(3, '0')}`;
}

export function legacyArchiveKey(n: number): string {
  return `legacy_${String(n).padStart(3, '0')}`;
}

/** 가명 처리할 때 지우는 항목 이름 (값이 글자일 때만 비움) */
const PERSONAL_FIELD_KEYS = new Set([
  'school', 'classNum', 'studentNum', 'birthDate', 'name', 'studentName', 'group', 'code',
  'claimName', 'claimBirthDate',
]);

/**
 * 예전 기록 JSON에서 개인정보를 지웁니다.
 * - 학교·반·번호·생년월일·이름·묶음(group)·학번표시(code) 항목은 빈 값으로
 * - 다른 글자 안에 들어 있는 실명은 '○○○'로 바꿈 (예: 교사 메모에 이름을 적은 경우)
 * JSON이 아니면 실명만 바꾼 글자를 돌려줍니다.
 */
export function scrubLegacyJson(json: string, realNames: readonly string[]): string {
  const names = realNames.map((n) => (n || '').trim()).filter((n) => n.length >= 2);
  const replaceNames = (s: string): string => {
    let out = s;
    for (const n of names) out = out.split(n).join('○○○');
    return out;
  };
  const walk = (v: unknown, key?: string): unknown => {
    if (typeof v === 'string') {
      if (key && PERSONAL_FIELD_KEYS.has(key)) return '';
      return replaceNames(v);
    }
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        // 다른 JSON을 글자로 품은 항목(예: worksheetJson 안의 Func 활동지)도 안까지 정리
        if (typeof x === 'string' && (x.startsWith('{') || x.startsWith('['))) {
          try {
            o[k] = JSON.stringify(walk(JSON.parse(x)));
            continue;
          } catch {
            // JSON이 아니면 아래에서 글자로 처리
          }
        }
        o[k] = walk(x, k);
      }
      return o;
    }
    return v;
  };
  try {
    return JSON.stringify(walk(JSON.parse(json)));
  } catch {
    return replaceNames(json);
  }
}

/** 배열을 무작위 순서로 (이전기록 번호가 예전 반·번호 순서를 드러내지 않도록) */
export function shuffled<T>(list: readonly T[], rnd: RandomFn = defaultRandom): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ------------------------------------------------------------------
// 이 기기(브라우저)에 남은 예전 개인정보 지우기
// ------------------------------------------------------------------

export const LEGACY_PROFILE_STORAGE_KEY = 'math_detective_approved_profile_v1';
export const ACTIVE_STUDENT_KEY_STORAGE = 'math_detective_active_student_key_v1';
const LOCAL_PURGE_FLAG = 'haeyon_pii_purge_v2_done';

/** 네 사이트가 같은 주소(4ai4me.github.io)를 써서 기기 저장 공간을 함께 쓰므로 네 사이트 것을 모두 적음 */
const SITE_WORKSHEET_KEYS = [
  'func_discovery_lessons_student_v1',
  'func_discovery_lessons_teacher_v1',
  'proof_discovery_two_lessons_student_v1',
  'proof_discovery_two_lessons_teacher_v1',
  'prime_lessons_student_v1',
  'prime_lessons_teacher_v1',
  'rational_lessons_student_v1',
  'rational_lessons_teacher_v1',
  // 반별 차시 잠금 보관본 (예전 반 키에 학교 이름이 들어 있음)
  'func_class_lesson_access_v1',
  'prime_class_lesson_access_v1',
  'rational_class_lesson_access_v1',
];

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

/**
 * 예전 방식 로그인 정보와 실명이 담긴 보관본을 이 기기에서 지웁니다.
 * - 예전 로그인 정보(학생 프로필·학생 키)는 열 때마다 확인해 지움 → 자동 입장 차단
 * - 예전 학생별 보관본(키에 '::stu_'), 학생 구분 없는 보관본, 교사 화면 보관본은 처음 한 번 지움
 * @returns 지운 항목 수
 */
export function purgeLegacyLocalData(storage: StorageLike): number {
  const toRemove = new Set<string>();
  try {
    const rawProfile = storage.getItem(LEGACY_PROFILE_STORAGE_KEY);
    if (rawProfile) {
      let ok = false;
      try {
        ok = isV2Registration(JSON.parse(rawProfile));
      } catch {
        ok = false;
      }
      if (!ok) toRemove.add(LEGACY_PROFILE_STORAGE_KEY);
    }
    const active = storage.getItem(ACTIVE_STUDENT_KEY_STORAGE);
    if (active && !isV2StudentKey(active)) toRemove.add(ACTIVE_STUDENT_KEY_STORAGE);

    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k) continue;
      const sep = k.indexOf('::');
      if (sep >= 0 && !isV2StudentKey(k.slice(sep + 2))) toRemove.add(k);
    }
    if (storage.getItem(LOCAL_PURGE_FLAG) !== '1') {
      for (const k of SITE_WORKSHEET_KEYS) {
        if (storage.getItem(k) !== null) toRemove.add(k);
      }
    }
    for (const k of toRemove) storage.removeItem(k);
    storage.setItem(LOCAL_PURGE_FLAG, '1');
  } catch (err) {
    console.warn('Legacy local data purge failed:', err);
  }
  return toRemove.size;
}
