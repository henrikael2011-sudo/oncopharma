import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { syntheticApiEnabled, oncoEnvironment } = require('../services/api/dist/synthetic-mode.js');
const run = (env, fn) => { const keys = ['ONCO_ENVIRONMENT', 'NODE_ENV', 'ALLOW_SYNTHETIC_API']; const old = Object.fromEntries(keys.map((k) => [k, process.env[k]])); for (const k of keys) delete process.env[k]; Object.assign(process.env, env); try { return fn(); } finally { for (const k of keys) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } } };
test('modo sintético por ambiente explícito', () => {
  assert.equal(run({ ALLOW_SYNTHETIC_API: 'true', NODE_ENV: 'production', ONCO_ENVIRONMENT: 'hml' }, syntheticApiEnabled), true, 'hml com build de produção');
  assert.equal(run({ ALLOW_SYNTHETIC_API: 'true', NODE_ENV: 'production' }, syntheticApiEnabled), false, 'produção sem ONCO_ENVIRONMENT');
  assert.equal(run({ ALLOW_SYNTHETIC_API: 'true', ONCO_ENVIRONMENT: 'prod' }, syntheticApiEnabled), false);
  assert.equal(run({ ALLOW_SYNTHETIC_API: 'true', ONCO_ENVIRONMENT: 'staging' }, syntheticApiEnabled), false, 'valor desconhecido');
  assert.equal(run({ ONCO_ENVIRONMENT: 'dev' }, syntheticApiEnabled), false, 'sem flag');
  assert.equal(run({ NODE_ENV: 'test' }, oncoEnvironment), 'dev');
});
