import test from 'node:test';
import assert from 'node:assert/strict';
import { createZoomInput } from '../src/navigation-input.js';

function zoomHarness(initialZoom = 1) {
  let zoom = initialZoom;
  const calls = [];
  const input = createZoomInput({
    getZoom: () => zoom,
    zoomAt: (...args) => { calls.push(args); zoom *= args[0]; },
  });
  return { input, calls, get zoom() { return zoom; } };
}

test('wheel bursts multiply factors and use the latest cursor anchor in one flush', () => {
  const h = zoomHarness();
  h.input.enqueue(1.12, 20, 40);
  h.input.enqueue(1.12, 30, 50);
  h.input.enqueue(0.89, 35, 60);
  assert.equal(h.calls.length, 0);
  assert.equal(h.input.flush(), true);
  assert.deepEqual(h.calls, [[1.12 * 1.12 * 0.89, 35, 60]]);
});

test('zoom limits are applied in event order before reversing direction', () => {
  const h = zoomHarness(319);
  h.input.enqueue(1.12, 4, 5);
  h.input.enqueue(0.89, 4, 5);
  h.input.flush();
  assert.equal(h.zoom, 320 * 0.89);
  const low = zoomHarness(0.8);
  low.input.enqueue(0.89, 4, 5);
  low.input.enqueue(1.12, 4, 5);
  low.input.flush();
  assert.equal(low.zoom, 0.75 * 1.12);
});

test('explicit flush separates input before an intervening navigation action', () => {
  const h = zoomHarness();
  h.input.enqueue(2, 1, 2);
  h.input.flush();
  h.input.enqueue(3, 8, 9);
  h.input.flush();
  assert.deepEqual(h.calls, [[2, 1, 2], [3, 8, 9]]);
  assert.equal(h.zoom, 6);
});

test('empty flushes do not invoke zoom or repeat the previous burst', () => {
  const h = zoomHarness();
  assert.equal(h.input.flush(), false);
  h.input.enqueue(1.12, 1, 2);
  h.input.flush();
  assert.equal(h.input.flush(), false);
  assert.equal(h.calls.length, 1);
});
