import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createLessonAccessPreset } from '../utils/mathLogic';
import { withClassLessonAccess } from '../utils/classLessonAccess';
import { ACCESS_TARGET_ALL, ClassLessonAccessPanel } from './ClassLessonAccessPanel';

const global = createLessonAccessPreset('upTo3');
const classMap = withClassLessonAccess({}, '수일고|1|1', createLessonAccessPreset('upTo5'));
const keys = ['수일고|1|1', '수일고|1|2'];

const render = (target: string) =>
  renderToStaticMarkup(
    <ClassLessonAccessPanel
      classKeys={keys}
      studentCountByClass={{ '수일고|1|1': 25, '수일고|1|2': 24 }}
      classMap={classMap}
      globalConfig={global}
      target={target}
      onChangeTarget={() => {}}
      onResetTarget={() => {}}
      syncStatus="synced"
    />
  );

const rowOpenCount = (html: string, key: string) => {
  const row = html.split(`data-class-key="${key}"`)[1].split('</tr>')[0];
  return (row.match(/차시 열림/g) || []).length;
};

test('반별 현황 표: 반별 설정 반은 자기 설정, 없는 반은 전체 설정', () => {
  const html = render(ACCESS_TARGET_ALL);
  assert.equal(rowOpenCount(html, ACCESS_TARGET_ALL), 3);
  assert.equal(rowOpenCount(html, '수일고|1|1'), 5);
  assert.equal(rowOpenCount(html, '수일고|1|2'), 3);
  assert.ok(html.includes('수일고 1학년 1반 (25명) · 반별 설정'));
  assert.ok(html.includes('수일고 1학년 2반 (24명)'));
  assert.ok(!html.includes('전체 설정으로 되돌리기'), '전체가 대상일 때는 되돌리기 버튼 없음');
});

test('대상 반에 따라 안내와 되돌리기 버튼', () => {
  const own = render('수일고|1|1');
  assert.ok(own.includes('이 반을 전체 설정으로 되돌리기'));
  assert.ok(own.includes('반별 설정</strong>을 쓰고 있습니다'));
  const follow = render('수일고|1|2');
  assert.ok(!follow.includes('이 반을 전체 설정으로 되돌리기'));
  assert.ok(follow.includes('전체 설정을 따르고'));
});
