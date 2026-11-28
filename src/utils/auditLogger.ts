import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * 학생 접속 기록 (교사만 열람)
 * 2026-11-28~ 가상 정보만 기록합니다: 년도·학년·반 이름·가상 이름.
 * 보안 규칙이 요구하는 항목 이름(school·classNum·studentNum)은 그대로 두고
 *   classNum = 반 이름, studentNum = '-' 로 채웁니다.
 */
export interface StudentAccessLog {
  logId: string;
  studentKey: string;
  school: string;
  year?: string;
  grade: string;
  /** 반 이름 (예: 참새반) */
  classNum: string;
  studentNum: string;
  name: string;
  eventType: 'login' | 'register' | 'resume' | 'save';
  status: 'pending' | 'approved' | 'rejected' | 'teacher';
  deviceHash: string;
  ipAddress: string;
  userAgent: string;
  createdAt?: unknown;
}

export interface AccessLogProfile {
  studentKey: string;
  school: string;
  year: string;
  grade: string;
  className: string;
  name: string;
}

export interface LogAccessParams {
  profile: AccessLogProfile;
  eventType: 'login' | 'register' | 'resume' | 'save';
  status: 'pending' | 'approved' | 'rejected' | 'teacher';
  deviceHash: string;
  ipAddress?: string;
  userAgent?: string;
  updateRegistrationUpdatedAt?: boolean;
}

/**
 * Records real-time student access log to Firestore `student_access_logs` collection.
 * Also touches `updatedAt` on `student_registrations/{studentKey}` so that last active timestamp is guaranteed up-to-date.
 */
export async function recordStudentAccessLog(params: LogAccessParams): Promise<void> {
  try {
    const rawUa = params.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown');
    const safeUa = rawUa.slice(0, 240);
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    const logId = `log_${ts}_${rand}`;
    const p = params.profile;

    const logDoc: StudentAccessLog = {
      logId,
      studentKey: p.studentKey.slice(0, 110),
      school: (p.school || '').slice(0, 40),
      year: (p.year || '').slice(0, 4),
      grade: String(p.grade || '').slice(0, 5),
      classNum: String(p.className || '').slice(0, 10),
      studentNum: '-',
      name: (p.name || '').slice(0, 25),
      eventType: params.eventType,
      status: params.status,
      deviceHash: params.deviceHash || 'DEV_UNKNOWN',
      ipAddress: (params.ipAddress || 'mac-only').slice(0, 60),
      userAgent: safeUa,
      createdAt: serverTimestamp(),
    };

    // 1. Write immutable audit log
    await setDoc(doc(db, 'student_access_logs', logId), logDoc);

    // 2. If requested and student is approved, update registration updatedAt & client info
    if (params.updateRegistrationUpdatedAt && params.status === 'approved') {
      try {
        await updateDoc(doc(db, 'student_registrations', p.studentKey), {
          updatedAt: serverTimestamp(),
          deviceHash: params.deviceHash || 'DEV_UNKNOWN',
          ipAddress: (params.ipAddress || 'mac-only').slice(0, 60),
          userAgent: safeUa || 'Unknown',
        });
      } catch (err) {
        console.warn('Registration updatedAt update skipped:', err);
      }
    }
  } catch (error) {
    console.error('Failed to record student access log:', error);
  }
}
