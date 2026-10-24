import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const [before, after] = process.argv.slice(2);
assert.ok(before && after, 'Provide two directories containing frozen production builds');
const harness = fileURLToPath(new URL('./immersive-performance-series.mjs', import.meta.url));
const output = resolve(process.env.PERF_OUTPUT || 'test-results/immersive-performance-ab');
const firstSide = process.env.PERF_FIRST || 'before';
assert.ok(['before', 'after'].includes(firstSide), 'PERF_FIRST must be before or after');
const sides = [['before', before], ['after', after]];
if (firstSide === 'after') sides.reverse();
const harnessSha256 = createHash('sha256').update(await readFile(harness)).digest('hex');
const runs = [];
await mkdir(output, { recursive: true });

for (let pair = 1; pair <= 5; pair++) {
  for (const [side, directory] of sides) {
    const target = resolve(directory);
    const destination = resolve(output, `${pair}-${side}`);
    let command;
    try {
      command = await execute(process.execPath, [harness], {
        cwd: target,
        env: { ...process.env, PERF_RUNS: '1', PERF_OUTPUT: destination },
        maxBuffer: 2 * 1024 * 1024,
      });
    } catch (error) {
      await mkdir(destination, { recursive: true });
      await writeFile(`${destination}/command.log`, `${error.stdout || ''}\n${error.stderr || error.message}`);
      throw new Error(`${side} pair ${pair} did not complete. Full evidence: ${destination}`);
    }
    const { stdout, stderr } = command;
    await writeFile(`${destination}/command.log`, `${stdout}\n${stderr}`);
    const series = JSON.parse(await readFile(`${destination}/series.json`, 'utf8'));
    assert.equal(series.runs.length, 1);
    const result = series.runs[0];
    assert.equal(result.status, 'passed');
    runs.push({ pair, side, directory: target, evidence: destination, ...result });
    await writeFile(`${output}/runs.json`, JSON.stringify({ harnessSha256, firstSide, runs }, null, 2));
    console.log(JSON.stringify({ pair, side, firstInteractiveMs: result.firstInteractiveMs, errors: result.errors }));
  }
}

const distribution = values => {
  const sorted = values.toSorted((a, b) => a - b);
  return { medianMs: sorted[2], minMs: sorted[0], maxMs: sorted.at(-1) };
};
const summary = Object.fromEntries(['before', 'after'].map(side => {
  const selected = runs.filter(run => run.side === side);
  return [side, {
    runCount: selected.length,
    firstInteractive: distribution(selected.map(run => run.firstInteractiveMs)),
    worldApiReady: distribution(selected.map(run => run.worldApiReadyMs)),
    npc100: distribution(selected.map(run => run.npc100.readyMs)),
    taskResponse: distribution(selected.map(run => run.task.responseMs)),
    work: selected.map(run => ({ islands: run.firstWorldState.islandCount, residents: run.npc100.count, resultProps: run.task.propCount })),
    errorCount: selected.reduce((sum, run) => sum + Object.values(run.errors).reduce((count, errors) => count + errors.length, 0), 0),
  }];
}));
await writeFile(`${output}/summary.json`, JSON.stringify({ harnessSha256, firstSide, summary }, null, 2));
console.log(JSON.stringify(summary, null, 2));
