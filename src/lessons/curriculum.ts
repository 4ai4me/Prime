/**
 * 중학교 1학년 「Ⅰ. 소인수분해」 단원 구성 (교과서 단원 구성 표 기준)
 * ------------------------------------------------------------------
 * 중단원 3개 · 6차시. 이 파일 한 곳에서 단원·차시 이름을 관리합니다.
 * 화면의 차시 탭, 교사 화면, 평가 항목 이름이 모두 여기서 만들어집니다.
 *
 * 차시 자료를 채울 때:
 *  1) 해당 차시의 `status`를 'ready'로 바꾸고 `stages`(단계 이름)를 실제 단계로 고칩니다.
 *  2) src/lessons/LessonNView.tsx 를 만들고 src/lessons/index.tsx 에 연결합니다.
 *  3) 저장 칸(l1~l6)은 차시 번호와 같습니다. 한 번 정한 뒤에는 바꾸지 않습니다(학생 기록과 보안 규칙의 약속).
 */

export type LessonNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface CurriculumUnit {
  /** 중단원 번호 (1~3) */
  num: number;
  title: string;
  lessons: LessonNumber[];
}

export interface CurriculumLesson {
  num: LessonNumber;
  /** 중단원 번호 */
  unit: number;
  /** 탭에 들어갈 짧은 이름 */
  shortTitle: string;
  /** 교과서 소단원 질문 */
  question: string;
  /** 교과서의 덧붙임 활동 (신나는 놀이 & 수학, 교구 & 공학 도구 등) */
  extra?: { label: string; title: string };
  /**
   * 차시 안의 단계 이름. 자료가 오기 전에는 계획한 활동을 적어 두고,
   * 자료를 채울 때 실제 단계로 고칩니다.
   */
  stages: string[];
  /** placeholder: 자료 준비 중 / ready: 활동지 완성 */
  status: 'placeholder' | 'ready';
}

export const COURSE_INFO = {
  grade: '중학교 1학년',
  unitRoman: 'Ⅰ',
  unitTitle: '소인수분해',
  /** 사이트 머리 제목 */
  headline: '수의 비밀을 쪼개라!',
  subtitle: '소수에서 시작해 소인수분해로 최대공약수·최소공배수까지 탐구하는 프로젝트',
} as const;

export const CURRICULUM_UNITS: CurriculumUnit[] = [
  { num: 1, title: '소수와 합성수', lessons: [1, 2] },
  { num: 2, title: '소인수분해', lessons: [3, 4] },
  { num: 3, title: '최대공약수와 최소공배수', lessons: [5, 6] },
];

export const CURRICULUM_LESSONS: CurriculumLesson[] = [
  {
    num: 1,
    unit: 1,
    shortTitle: '소수란?',
    question: '소수란 무엇일까?',
    stages: ['단원 열기 · 준비 학습', '생각 열기 · 약수 모여라', '소수와 합성수의 뜻', '문제 1 · 소수? 합성수?', '도전 · 수준별 문제', '성찰'],
    status: 'ready',
  },
  {
    num: 2,
    unit: 1,
    shortTitle: '소수 찾기',
    question: '소수를 어떻게 찾을 수 있을까?',
    extra: { label: '신나는 놀이 & 수학', title: '어떻게 색칠하면 될까?' },
    stages: ['소수 찾기', '신나는 놀이 & 수학 · 색칠하기', '성찰'],
    status: 'placeholder',
  },
  {
    num: 3,
    unit: 2,
    shortTitle: '거듭제곱',
    question: '거듭제곱이란 무엇일까?',
    stages: ['거듭제곱의 뜻', '성찰'],
    status: 'placeholder',
  },
  {
    num: 4,
    unit: 2,
    shortTitle: '소인수분해',
    question: '소인수분해는 어떻게 할까?',
    extra: { label: '교구 & 공학 도구', title: '블록 코딩으로 소인수분해 하기' },
    stages: ['소인수분해하기', '교구 & 공학 도구 · 블록 코딩', '성찰'],
    status: 'placeholder',
  },
  {
    num: 5,
    unit: 3,
    shortTitle: '최대공약수',
    question: '소인수분해를 이용하여 최대공약수를 어떻게 구할까?',
    stages: ['최대공약수 구하기', '성찰'],
    status: 'placeholder',
  },
  {
    num: 6,
    unit: 3,
    shortTitle: '최소공배수',
    question: '소인수분해를 이용하여 최소공배수를 어떻게 구할까?',
    stages: ['최소공배수 구하기', '성찰'],
    status: 'placeholder',
  },
];

export function getCurriculumLesson(num: LessonNumber): CurriculumLesson {
  const found = CURRICULUM_LESSONS.find((l) => l.num === num);
  if (!found) throw new Error(`없는 차시: ${num}`);
  return found;
}

export function getCurriculumUnit(num: number): CurriculumUnit {
  const found = CURRICULUM_UNITS.find((u) => u.num === num);
  if (!found) throw new Error(`없는 중단원: ${num}`);
  return found;
}

/** "02차시" 같은 두 자리 표시 */
export function lessonBadge(num: number): string {
  return String(num).padStart(2, '0');
}
