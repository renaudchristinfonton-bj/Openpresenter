import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OUTPUTS, createOutput, duplicateOutput, normalizeOutputs, removeOutput, renameOutput, updateOutput,
} from '../src/core/output-registry.mjs';

test('legacy fixed outputs migrate to independent editable definitions', () => {
  const outputs = normalizeOutputs(DEFAULT_OUTPUTS);
  assert.deepEqual(outputs.map(({ id }) => id), ['main', 'annexe', 'lt']);
  assert.notEqual(outputs[0].preset, outputs[1].preset);
  assert.notEqual(outputs[1].preset, outputs[2].preset);
  assert.equal(normalizeOutputs(null).length, 3);
});

test('output registry validates names, sizes, fitting, and unique stable channel ids', () => {
  const first = createOutput(DEFAULT_OUTPUTS, { name: 'Projecteur gauche', preset: 'screen80', width: 1280, height: 720 }, () => 'out_left');
  assert.equal(first.output.id, 'out_left');
  assert.equal(first.output.width, 1280);
  assert.throws(() => createOutput(first.outputs, { name: 'projecteur gauche' }, () => 'out_other'), /déjà utilisé/i);
  assert.throws(() => createOutput(first.outputs, { name: 'Autre' }, () => 'main'), /déjà utilisé/i);
  assert.throws(() => createOutput(first.outputs, { name: 'Autre', preset: 'unknown' }, () => 'out_other'), /disposition/i);
  assert.throws(() => renameOutput(first.outputs, 'out_left', '   '), /vide/i);
  assert.throws(() => updateOutput(first.outputs, 'out_left', { fit: 'unknown' }), /cadrage/i);
  assert.equal(updateOutput(first.outputs, 'out_left', { width: 100 })[3].width, 1920, 'unsafe dimensions fall back to the safe default');
});

test('outputs can be renamed, duplicated with all settings, and removed without orphaning the last output', () => {
  const made = createOutput(DEFAULT_OUTPUTS, { name: 'Salle annexe', preset: 'bottom-right', width: 1280, height: 720, fit: 'cover' }, () => 'out_room');
  const renamed = renameOutput(made.outputs, 'out_room', 'Salle des musiciens');
  assert.equal(renamed.at(-1).name, 'Salle des musiciens');
  const copied = duplicateOutput(renamed, 'out_room', () => 'out_copy');
  assert.equal(copied.output.name, 'Salle des musiciens (copie)');
  assert.equal(copied.output.preset, 'bottom-right');
  assert.equal(copied.output.width, 1280);
  assert.equal(copied.output.fit, 'cover');
  assert.notEqual(copied.output.id, 'out_room');
  assert.equal(removeOutput(copied.outputs, 'out_room').some((output) => output.id === 'out_room'), false);
  assert.throws(() => removeOutput([copied.output], 'out_copy'), /au moins une sortie/i);
});
