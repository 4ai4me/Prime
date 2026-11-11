import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStudentState } from './mathLogic';
import { codeLabelOf, groupLabelOf, isRecordOfStudent, studentDraftKey } from './studentDraft';

const A = { school: '하연고등학교', grade: '1', classNum: '1', studentNum: '1', name: '김철수' };
const B = { school: '하연고등학교', grade: '1', classNum: '1', studentNum: '2', name: '이영희' };

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

test('표시 이름 형식은 기존 화면과 같다 (기존 보관본 인식)', () => {
  assert.equal(codeLabelOf(A), '10101_김철수');
  assert.equal(groupLabelOf(A), '하연고등학교 1학년 1반');
});

test('학생별 보관 키는 학생마다 다르다', () => {
  assert.notEqual(studentDraftKey('base', 'stu_a'), studentDraftKey('base', 'stu_b'));
  assert.equal(studentDraftKey('base', 'stu_a'), 'base::stu_a');
});
