// tests/pool.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/pool.js';

test('pool returns results in input order even if slower tasks finish last', async () => {
  const tasks = [
    async () => { await new Promise(r => setTimeout(r, 30)); return 'a'; },
    async () => { await new Promise(r => setTimeout(r, 10)); return 'b'; },
    async () => { await new Promise(r => setTimeout(r, 20)); return 'c'; },
  ];
  const results = await pool(3, tasks);
  assert.deepEqual(results, ['a', 'b', 'c']);
});

test('pool runs at most concurrency tasks simultaneously', async () => {
  let concurrent = 0;
  let maxConcurrent = 0;
  const tasks = Array.from({ length: 10 }, () => async () => {
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise(r => setTimeout(r, 10));
    concurrent--;
    return 1;
  });
  await pool(3, tasks);
  assert.ok(maxConcurrent <= 3, `expected max 3 concurrent, got ${maxConcurrent}`);
});

test('pool returns empty array for empty task list', async () => {
  assert.deepEqual(await pool(3, []), []);
});

test('pool with concurrency > tasks.length runs all tasks', async () => {
  const results = await pool(10, [async () => 1, async () => 2]);
  assert.deepEqual(results, [1, 2]);
});

test('pool throws for concurrency less than 1', async () => {
  await assert.rejects(() => pool(0, [async () => 1]), /positive integer/);
});
