import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStudentState } from './mathLogic';
import { codeLabelOf, groupLabelOf, isRecordOfStudent, studentDraftKey } from './studentDraft';

const A = { year: '2026', grade: '중1', className: '참새반', name: '김하늘' };
const B = { year: '2026', grade: '중1', className: '참새반', name: '이바다' };

function recordOf(p: typeof A) {
  const r = createInitialStudentState();
  r.group = groupLabelOf(p);
  r.code = codeLabelOf(p);
  return r;
}

test('같은 학생의 기기 보관본만 합칠 대상으로 인정한다 (공용 기기에서 답안 섞임 방지)', () => {
  assert.equal(isRecordOfStudent(recordOf(A), A), true);
  assert.equal(isRecordOfStudent(recordOf(A), B), false, '앞 학생(A)의 답안은 B에게 합치지 않음');
  assert.equal(isRecordOfStudent(createInitialStudentState(), A), false, '주인이 없는 빈 활동지는 합치지 않음');
  assert.equal(isRecordOfStudent(null, A), false);
});

test('표시 이름 형식: 반 묶음 = 년도 학년 반, 학생 구분 = 가상 이름', () => {
  assert.equal(codeLabelOf(A), '김하늘');
  assert.equal(groupLabelOf(A), '2026 중1 참새반');
});

test('학생별 보관 키는 학생마다 다르다', () => {
  assert.notEqual(studentDraftKey('base', 'v2_김하늘'), studentDraftKey('base', 'v2_이바다'));
  assert.equal(studentDraftKey('base', 'v2_김하늘'), 'base::v2_김하늘');
});
