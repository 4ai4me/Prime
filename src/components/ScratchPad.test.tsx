import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PAD_H, PAD_W, ScratchPadButton, toPadPoint } from './ScratchPad';

test('toPadPoint: 화면 크기와 상관없이 고정 좌표(1000×620)로 바꾸고, 칸 밖은 가장자리로 제한한다', () => {
  const rect = { left: 100, top: 50, width: 500, height: 310 };
  assert.deepEqual(toPadPoint(100, 50, rect), [0, 0]);
  assert.deepEqual(toPadPoint(600, 360, rect), [PAD_W, PAD_H]);
  assert.deepEqual(toPadPoint(350, 205, rect), [500, 310]);
  // 두 배 크기 창에서도 같은 위치는 같은 좌표
  assert.deepEqual(toPadPoint(600, 360, { left: 100, top: 50, width: 1000, height: 620 }), [500, 310]);
  assert.deepEqual(toPadPoint(0, 9999, rect), [0, PAD_H]);
});

test('연습장 버튼: 그린 내용이 있으면 표시 점이 보이고, 열려 있을 때는 숨긴다', () => {
  const used = renderToStaticMarkup(<ScratchPadButton onClick={() => {}} used />);
  assert.ok(used.includes('연습장') && used.includes('그린 내용 있음'));
  assert.ok(!renderToStaticMarkup(<ScratchPadButton onClick={() => {}} />).includes('그린 내용 있음'));
  assert.ok(!renderToStaticMarkup(<ScratchPadButton onClick={() => {}} used active />).includes('그린 내용 있음'));
});
