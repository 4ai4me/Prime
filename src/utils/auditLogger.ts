import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDeviceHashAsMac } from './authLogic';

export interface StudentAccessLog {
  logId: string;
  studentKey: string;
  school: string;
  grade: string;
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

export interface LogAccessParams {
  studentKey: string;
  school: string;
  grade: string;
  classNum: string;
  studentNum: string;
  name: string;
  eventType: 'login' | 'register' | 'resume' | 'save';
  status: 'pending' | 'approved' | 'rejected' | 'teacher';
  deviceHash: string;
  ipAddress: string;
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

    const logDoc: StudentAccessLog = {
      logId,
      studentKey: params.studentKey.slice(0, 110),
      school: (params.school || '').slice(0, 40),
      grade: String(params.grade || '1').slice(0, 5),
      classNum: String(params.classNum || '1').slice(0, 10),
      studentNum: String(params.studentNum || '1').slice(0, 10),
      name: (params.name || '').slice(0, 25),
      eventType: params.eventType,
      status: params.status,
      deviceHash: params.deviceHash || 'DEV_UNKNOWN',
      ipAddress: (params.ipAddress || 'unknown').slice(0, 60),
      userAgent: safeUa,
      createdAt: serverTimestamp(),
    };

    // 1. Write immutable audit log
    await setDoc(doc(db, 'student_access_logs', logId), logDoc);

    // 2. If requested and student is approved, update registration updatedAt & client info
    if (params.updateRegistrationUpdatedAt && params.status === 'approved') {
      try {
        await updateDoc(doc(db, 'student_registrations', params.studentKey), {
          updatedAt: serverTimestamp(),
          deviceHash: params.deviceHash || 'DEV_UNKNOWN',
          ipAddress: (params.ipAddress || 'unknown').slice(0, 60),
          userAgent: safeUa,
        });
      } catch (err) {
        console.warn('Registration updatedAt update skipped:', err);
      }
    }
  } catch (error) {
    console.error('Failed to record student access log:', error);
  }
}
