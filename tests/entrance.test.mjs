import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const code = ts.transpileModule(readFileSync(new URL('../src/entrance.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { sampleEntrance, treeRotationForElapsed, ENTRANCE_DURATION_MS } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));

test('入口在桌面與直式裝置保持有限座標及有效視角', () => {
  assert.ok(ENTRANCE_DURATION_MS >= 6000 && ENTRANCE_DURATION_MS <= 8000);
  for (const aspect of [.3, .56, 1, 1.78, 4, NaN, Infinity, 0, -1]) {
    for (const progress of [NaN, -Infinity, Infinity, -1, ...Array.from({ length: 1001 }, (_, i) => i / 1000), 2]) {
      const sample = sampleEntrance(progress, aspect);
      for (const value of [...sample.cameraPosition, ...sample.cameraTarget, sample.fov, sample.veil, sample.islandProgress, sample.libraryScale, sample.cosmosScale]) {
        assert.ok(Number.isFinite(value), `nonfinite value for ${progress}, ${aspect}`);
      }
      assert.ok(sample.cameraPosition.every(value => Math.abs(value) < 110));
      assert.ok(sample.fov >= 45 && sample.fov <= 70);
      assert.ok(sample.veil >= 0 && sample.veil <= 1);
      assert.ok(sample.islandProgress >= 0 && sample.islandProgress <= 1);
      assert.ok(distance(sample.cameraPosition, sample.cameraTarget) > 1);
      assert.equal([sample.libraryVisible, sample.cosmosVisible, sample.islandsVisible].filter(Boolean).length, 1);
    }
  }
  assert.deepEqual(sampleEntrance(-1, 1), sampleEntrance(0, 1));
  assert.deepEqual(sampleEntrance(Infinity, 1), sampleEntrance(1, 1));
  assert.deepEqual(sampleEntrance(NaN, 1), sampleEntrance(0, 1));
});

test('起點保留完整書樹，直式畫面適度後退並保留書樹的視覺份量', () => {
  const wide = sampleEntrance(0, 1.78);
  const portrait = sampleEntrance(0, .56);
  assert.ok(portrait.cameraPosition[2] > wide.cameraPosition[2]);
  assert.ok(portrait.cameraPosition[2] <= 38);
  for (const aspect of [.3, .56, 1, 1.78]) {
    const sample = sampleEntrance(0, aspect);
    assert.equal(sample.cameraPosition[1], 6);
    const halfHeight = (sample.cameraPosition[2] - 1.7) * Math.tan(sample.fov * Math.PI / 360);
    assert.ok(halfHeight > 6, '11-unit tree fits vertically around eye height');
    assert.ok(halfHeight * aspect >= 4.25, 'the central tree fits horizontally');
    assert.ok(11 / (2 * halfHeight) >= .23, 'the tree occupies at least 23 percent of viewport height');
  }
});

test('鏡頭一路連續且在仍可見的圖書館中避開實心書樹', () => {
  for (const aspect of [.56, 1.78]) {
    let previous = sampleEntrance(0, aspect);
    for (let i = 1; i <= 10000; i++) {
      const current = sampleEntrance(i / 10000, aspect);
      assert.ok(distance(previous.cameraPosition, current.cameraPosition) < .1, 'no position jump');
      assert.ok(distance(previous.cameraTarget, current.cameraTarget) < .06, 'no look-at jump');
      if (current.libraryVisible && current.veil < .95) {
        const [x, y, z] = current.cameraPosition;
        const treeRadiusAtHeight = 4.25 * Math.max(0, 1 - y / 11);
        assert.ok(Math.hypot(x, z - 1.7) > treeRadiusAtHeight + .5);
      }
      previous = current;
    }
  }
});

test('更換場景與投影前有遮幕，結束時清晰顯示島嶼', () => {
  let previous = sampleEntrance(0, 1);
  let changes = 0;
  let islandProgress = 0;
  for (let i = 1; i <= 10000; i++) {
    const current = sampleEntrance(i / 10000, 1);
    if (previous.stage !== current.stage) {
      changes++;
      assert.ok(current.veil > .999 && previous.veil > .999);
    }
    assert.ok(current.islandProgress >= islandProgress);
    islandProgress = current.islandProgress;
    previous = current;
  }
  assert.equal(changes, 2);
  assert.equal(previous.stage, 'islands');
  assert.equal(previous.veil, 0);
  assert.equal(previous.islandProgress, 1);
});

test('書樹每150秒一圈，畫格率不影響轉速且長時間不累積大角度', () => {
  assert.ok(Math.abs(treeRotationForElapsed(37.5) - Math.PI / 2) < 1e-12);
  for (const fps of [24, 30, 60, 120]) {
    const frames = fps * 15;
    assert.ok(Math.abs(treeRotationForElapsed(frames / fps) - Math.PI / 5) < 1e-12);
  }
  assert.ok(Math.abs(treeRotationForElapsed(1500015) - treeRotationForElapsed(15)) < 1e-12);
  assert.equal(treeRotationForElapsed(Infinity), 0);
  assert.equal(treeRotationForElapsed(NaN), 0);
});
