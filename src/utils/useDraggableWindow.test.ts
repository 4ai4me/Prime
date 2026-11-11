import test from 'node:test';
import assert from 'node:assert/strict';
import { clampWindowPosition, KEEP_VISIBLE_PX } from './useDraggableWindow';

const viewport = { width: 1280, height: 800 };
const size = { width: 840 };

test('화면 안의 위치는 그대로 둔다', () => {
  assert.deepEqual(clampWindowPosition({ left: 100, top: 50 }, size, viewport), { left: 100, top: 50 });
});

test('왼쪽·오른쪽으로 끝까지 끌어도 창 일부가 화면에 남는다', () => {
  assert.equal(clampWindowPosition({ left: -5000, top: 50 }, size, viewport).left, KEEP_VISIBLE_PX - size.width);
  assert.equal(clampWindowPosition({ left: 5000, top: 50 }, size, viewport).left, viewport.width - KEEP_VISIBLE_PX);
});

test('제목 표시줄이 화면 위로 사라지거나 아래로 숨지 않는다', () => {
  assert.equal(clampWindowPosition({ left: 0, top: -300 }, size, viewport).top, 0);
  assert.equal(clampWindowPosition({ left: 0, top: 5000 }, size, viewport).top, viewport.height - KEEP_VISIBLE_PX);
});

test('창이 화면보다 넓은 작은 화면(패드 세로)에서도 값이 뒤집히지 않는다', () => {
  const small = { width: 360, height: 640 };
  const r = clampWindowPosition({ left: 9999, top: 9999 }, { width: 800 }, small);
  assert.ok(r.left <= small.width && r.top <= small.height);
});
