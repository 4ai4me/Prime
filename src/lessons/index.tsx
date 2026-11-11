import React from 'react';
import { CURRICULUM_LESSONS, getCurriculumLesson, type LessonNumber } from './curriculum';
import { LessonPlaceholderView } from './LessonPlaceholderView';
import type { LessonCommonState } from '../utils/studentRecord';

/**
 * 차시 화면 연결표
 * ------------------------------------------------------------------
 * 자료 준비 중인 차시는 LessonPlaceholderView를 보여 줍니다.
 * 차시 자료를 채우면 아래처럼 그 차시의 화면과 완료 판정 함수를 연결합니다.
 *
 *   3: { View: Lesson3View, evaluateCompletion: evaluateLesson3Completion },
 *
 * View는 LessonViewProps를 받고, evaluateCompletion은 단계(curriculum의 stages)마다 완료 여부를 돌려줍니다.
 */

export interface LessonViewProps<S extends LessonCommonState = LessonCommonState> {
  lesson: LessonNumber;
  state: S;
  /** 지금 보고 있는 단계 (0부터) */
  step: number;
  onStepChange: (next: number) => void;
  /** 답안 고치기 (잠긴 차시면 App이 무시함) */
  onUpdate: (updater: (prev: S) => S) => void;
  /** 다음 차시로 (마지막 차시면 없음) */
  onGoToNextLesson?: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export interface LessonModule {
  View: React.FC<LessonViewProps>;
  /** 단계별 완료 여부 (길이 = curriculum stages 수) */
  evaluateCompletion: (state: LessonCommonState) => boolean[];
}

/** 완성된 차시만 여기에 넣습니다. 없는 차시는 '자료 준비 중' 화면 */
const READY_LESSONS: Partial<Record<LessonNumber, LessonModule>> = {};

const PlaceholderModuleView: React.FC<LessonViewProps> = ({ lesson }) => <LessonPlaceholderView lesson={lesson} />;

export function getLessonModule(num: LessonNumber): LessonModule {
  const ready = READY_LESSONS[num];
  if (ready) return ready;
  const stages = getCurriculumLesson(num).stages;
  return {
    View: PlaceholderModuleView,
    evaluateCompletion: () => stages.map(() => false),
  };
}

/** 차시 화면이 준비됐는지 (curriculum의 status와 연결표가 모두 맞아야 함) */
export function isLessonReady(num: LessonNumber): boolean {
  return Boolean(READY_LESSONS[num]) && getCurriculumLesson(num).status === 'ready';
}

/** 학생 진행 상태 (교사 표·학생 머리 막대 공용) */
export type LessonProgress = 'done' | 'progress' | 'none';
export const LESSON_PROGRESS_LABEL: Record<LessonProgress, string> = {
  done: '완료',
  progress: '진행 중',
  none: '시작 전',
};

export function lessonProgressOf(num: LessonNumber, state: LessonCommonState, hasContent: boolean): LessonProgress {
  const done = getLessonModule(num).evaluateCompletion(state);
  if (done.length > 0 && done.every(Boolean)) return 'done';
  if (hasContent || done.some(Boolean)) return 'progress';
  return 'none';
}

export const ALL_LESSON_MODULE_NUMBERS: LessonNumber[] = CURRICULUM_LESSONS.map((l) => l.num);
