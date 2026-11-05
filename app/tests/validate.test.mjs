// Validateur JSON Schema (annexe 24) : pas de dépendance, messages exploitables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, compile, assertValid, ValidationError } from '../src/core/validate.mjs';

const song = {
  type: 'object',
  required: ['id', 'title', 'sections'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', pattern: '^sng_[a-z0-9_]{2,40}$' },
    rev: { type: 'integer', minimum: 1 },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    language: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' },
    sections: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'name', 'type', 'lines'],
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { enum: ['verse', 'chorus', 'bridge'] },
          lines: { type: 'array', minItems: 1, items: { type: 'string', maxLength: 400 } }
        }
      }
    }
  }
};

const valid = {
  id: 'sng_abc123',
  rev: 2,
  title: 'Que ma bouche chante',
  language: 'fr',
  sections: [{ id: 'sec_1', name: 'Couplet 1', type: 'verse', lines: ['Première ligne'] }]
};

test('validateur : objet conforme accepté', () => {
  const result = validate(valid, song);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('validateur : type, motif et longueur signalés avec un chemin', () => {
  const broken = { ...valid, id: 'pas-un-id', rev: 0, title: '' };
  const result = validate(broken, song);
  assert.equal(result.valid, false);
  const paths = result.errors.map((e) => `${e.path}:${e.keyword}`);
  assert.ok(paths.includes('/id:pattern'), paths.join(' '));
  assert.ok(paths.includes('/rev:minimum'), paths.join(' '));
  assert.ok(paths.includes('/title:minLength'), paths.join(' '));
});

test('validateur : propriété inconnue refusée quand additionalProperties = false', () => {
  const result = validate({ ...valid, updatedAt: '2026-01-01T00:00:00Z' }, song);
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].keyword, 'additionalProperties');
});

test('validateur : propriété obligatoire manquante', () => {
  const { sections, ...withoutSections } = valid;
  const result = validate(withoutSections, song);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.keyword === 'required' && e.path === '/sections'));
});

test('validateur : énumération et éléments imbriqués', () => {
  const result = validate({
    ...valid,
    sections: [{ ...valid.sections[0], type: 'refrain' }]
  }, song);
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].path, '/sections/0/type');
  assert.equal(result.errors[0].keyword, 'enum');
});

test('validateur : $ref local et if/then', () => {
  const schema = {
    type: 'object',
    properties: { asset: { $ref: '#/$defs/asset' } },
    $defs: {
      asset: {
        type: 'object',
        required: ['path'],
        properties: { path: { type: 'string' }, linked: { type: 'boolean' }, absolutePath: { type: 'string' } },
        allOf: [{
          if: { required: ['linked'], properties: { linked: { const: true } } },
          then: { required: ['absolutePath'] },
          else: { not: { required: ['absolutePath'] } }
        }]
      }
    }
  };
  assert.equal(validate({ asset: { path: 'media/aa.png' } }, schema).valid, true);
  assert.equal(validate({ asset: { path: 'media/aa.png', linked: true } }, schema).valid, false);
  assert.equal(validate({ asset: { path: 'media/aa.png', linked: true, absolutePath: '/x/y' } }, schema).valid, true);
  assert.equal(validate({ asset: { path: 'media/aa.png', absolutePath: '/x/y' } }, schema).valid, false);
});

test('validateur : références externes common.schema.json résolues', () => {
  const common = { $defs: { timestamp: { type: 'string', format: 'date-time' } } };
  const schema = { type: 'object', properties: { at: { $ref: 'common.schema.json#/$defs/timestamp' } } };
  const v = compile(schema, { common });
  assert.equal(v.validate({ at: '2026-10-21T10:00:00.000Z' }).valid, true);
  assert.equal(v.validate({ at: 'hier' }).valid, false);
});

test('validateur : oneOf exige exactement une variante', () => {
  const schema = {
    oneOf: [
      { type: 'object', required: ['kind'], properties: { kind: { const: 'a' } } },
      { type: 'object', required: ['kind'], properties: { kind: { const: 'b' } } }
    ]
  };
  assert.equal(validate({ kind: 'a' }, schema).valid, true);
  assert.equal(validate({ kind: 'c' }, schema).valid, false);
});

test('assertValid lève une ValidationError exploitable par l’API', () => {
  assert.throws(() => assertValid({ id: 'x' }, song, 'chant'), (err) => {
    assert.ok(err instanceof ValidationError);
    assert.equal(err.code, 'VALIDATION');
    assert.equal(typeof err.path, 'string');
    assert.match(err.message, /^chant invalide : /);
    return true;
  });
});
