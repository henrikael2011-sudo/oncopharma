import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {validateSyntheticBundle,reconcileSynthetic} from '../src/fhir-r4.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/synthetic-bundle.json',import.meta.url)));
test('bundle sintético normalizado',()=>{const x=validateSyntheticBundle(fixture);assert.equal(x.count,2);assert.equal(x.syntheticOnly,true)});
test('deduplicação idempotente',()=>{const one=reconcileSynthetic([],fixture);const two=reconcileSynthetic(one.records,fixture);assert.equal(one.inserted,2);assert.equal(two.inserted,0);assert.equal(two.updated,0)});
test('bloqueia ID não sintético',()=>assert.throws(()=>validateSyntheticBundle({resourceType:'Bundle',type:'collection',entry:[{resource:{resourceType:'Patient',id:'123'}}]})));
test('bloqueia tipo não autorizado',()=>assert.throws(()=>validateSyntheticBundle({resourceType:'Bundle',type:'collection',entry:[{resource:{resourceType:'Binary',id:'syn-a'}}]})));
test('bloqueia duplicatas',()=>assert.throws(()=>validateSyntheticBundle({...fixture,entry:[fixture.entry[0],fixture.entry[0]]})));
