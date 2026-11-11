import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Save } from 'lucide-react';

/**
 * 교사 평가·피드백 저장 상태와 [저장] 버튼.
 * 저장 자체는 TeacherView의 flushTeacherSaves가 맡고(입력 후 1.5초 자동 저장도 그대로),
 * 이 버튼은 "지금 바로 저장"과 "저장됐는지 확인"을 위한 것이다.
 */

export type TeacherSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface TeacherSaveStatus {
  state: TeacherSaveState;
  /** 마지막으로 저장에 성공한 시각(ms) */
  savedAt?: number;
}

export interface TeacherSaveBarView {
  label: string;
  tone: 'muted' | 'warn' | 'busy' | 'good' | 'error';
  buttonDisabled: boolean;
  buttonText: string;
}

/**
 * 비동기 작업을 겹치지 않게 실행한다.
 * 실행 중에 다시 불리면 새로 시작하지 않고, 지금 실행이 끝난 뒤 딱 한 번 더 실행한다
 * (버튼 여러 번 누르기·자동 저장과 버튼이 겹칠 때 같은 내용을 두 번 보내지 않기 위함).
 */
export function serializeRuns(task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let again = false;
  return () => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await task();
        } while (again);
      } finally {
        running = null;
      }
    })();
    return running;
  };
}

const formatTime =(ms: number): string =>
  new Date(ms).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });

/** 화면에 보일 문구와 버튼 상태 (화면 그리기와 분리해 테스트한다) */
export function teacherSaveBarView(
  status: TeacherSaveStatus | undefined,
  onServer: boolean
): TeacherSaveBarView {
  if (!onServer) {
    return {
      label: '서버 학생 명단에 없는 기록이라 이 기기에만 보관됩니다.',
      tone: 'muted',
      buttonDisabled: true,
      buttonText: '저장',
    };
  }
  const s = status ?? { state: 'idle' };
  switch (s.state) {
    case 'dirty':
      return { label: '저장되지 않은 변경 있음', tone: 'warn', buttonDisabled: false, buttonText: '저장' };
    case 'saving':
      return { label: '저장 중…', tone: 'busy', buttonDisabled: true, buttonText: '저장 중…' };
    case 'error':
      return {
        label: '저장 실패 — 인터넷 연결을 확인하고 다시 눌러 주세요. 입력한 글은 그대로 있습니다.',
        tone: 'error',
        buttonDisabled: false,
        buttonText: '다시 저장',
      };
    case 'saved':
      return {
        label: s.savedAt ? `저장됨 (${formatTime(s.savedAt)})` : '저장됨',
        tone: 'good',
        buttonDisabled: true,
        buttonText: '저장',
      };
    default:
      return { label: '변경 사항 없음', tone: 'muted', buttonDisabled: true, buttonText: '저장' };
  }
}

const TONE_CLASS: Record<TeacherSaveBarView['tone'], string> = {
  muted: 'text-slate-500',
  warn: 'text-amber-700',
  busy: 'text-blue-700',
  good: 'text-emerald-700',
  error: 'text-rose-700',
};

export const TeacherSaveBar: React.FC<{
  status: TeacherSaveStatus | undefined;
  onServer: boolean;
  onSave: () => void;
}> = ({ status, onServer, onSave }) => {
  const view = teacherSaveBarView(status, onServer);
  const Icon =
    view.tone === 'busy' ? Loader2 : view.tone === 'good' ? CheckCircle2 : view.tone === 'error' ? AlertTriangle : null;
  return (
    <div className="flex items-center justify-end gap-3 flex-wrap">
      <span
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-1 text-xs font-bold ${TONE_CLASS[view.tone]}`}
      >
        {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${view.tone === 'busy' ? 'animate-spin' : ''}`} />}
        {view.label}
      </span>
      <button
        type="button"
        onClick={onSave}
        disabled={view.buttonDisabled}
        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600"
      >
        <Save className="h-4 w-4 shrink-0" />
        {view.buttonText}
      </button>
    </div>
  );
};
