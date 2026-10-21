// Validateur JSON Schema 2020-12 — sous-ensemble suffisant pour les schémas
// d'OpenPresenter (annexe 24), sans aucune dépendance npm.
//
// Pris en charge : $ref (local et fichier), $defs, type, enum, const,
// properties, required, additionalProperties, propertyNames, items, prefixItems,
// contains, minItems, maxItems, uniqueItems, minLength, maxLength, pattern,
// minimum, maximum, exclusiveMinimum/Maximum, multipleOf, oneOf, anyOf, allOf,
// not, if/then/else, format (date-time, date, time, uri, email, uuid).
// Les mots-clés inconnus sont ignorés (comportement conforme à la spécification).

const FORMATS = {
  'date-time': (v) => !Number.isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T/.test(v),
  date: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)),
  time: (v) => /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(v),
  uri: (v) => /^[a-z][a-z0-9+.-]*:/i.test(v),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  uuid: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
  hostname: (v) => /^[a-z0-9.-]+$/i.test(v)
};

const TYPES = {
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  array: (v) => Array.isArray(v),
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  null: (v) => v === null
};

/** Erreur de validation exploitable par l'API (`VALIDATION` 400). */
export class ValidationError extends Error {
  constructor(errors, message) {
    super(message || `Données invalides : ${errors[0]?.path || ''} ${errors[0]?.message || ''}`.trim());
    this.name = 'ValidationError';
    this.code = 'VALIDATION';
    this.errors = errors;
    this.path = errors[0]?.path;
  }
}

/**
 * Valide `data` contre `schema`.
 * @returns {{valid: boolean, errors: {path: string, message: string, keyword: string}[]}}
 */
export function validate(data, schema, { root = null, path = '' } = {}) {
  const errors = [];
  const ctx = { root: root || schema, baseDir: null };
  walk(data, schema, path, ctx, errors);
  return { valid: errors.length === 0, errors };
}

/** Valide et lève une `ValidationError` — usage direct dans les routes HTTP. */
export function assertValid(data, schema, label = 'données') {
  const result = validate(data, schema);
  if (!result.valid) {
    const first = result.errors[0];
    throw new ValidationError(result.errors, `${label} invalide : ${first.path || '/'} — ${first.message}`);
  }
  return data;
}

function resolveRef(ref, schema, ctx) {
  // Les schémas d'OpenPresenter référencent les définitions communes sous la
  // forme `common.schema.json#/$defs/x` : elles sont fusionnées dans `$defs`
  // par `compile()` et par l'outil de contrôle.
  let pointer = ref;
  if (!ref.startsWith('#/')) {
    const hash = ref.indexOf('#/');
    if (hash < 0) throw new Error(`Référence externe non résolue : ${ref}`);
    pointer = ref.slice(hash);
  }
  const parts = pointer.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node = ctx.root || schema;
  for (const part of parts) {
    node = node?.[part];
    if (node === undefined) throw new Error(`Référence introuvable : ${ref}`);
  }
  return node;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function walk(value, schema, path, ctx, errors) {
  if (schema === true || schema === undefined || schema === null) return;
  if (schema === false) {
    errors.push({ path, message: 'valeur interdite', keyword: 'false' });
    return;
  }

  if (schema.$ref) {
    let target;
    try {
      target = resolveRef(schema.$ref, schema, ctx);
    } catch (err) {
      errors.push({ path, message: err.message, keyword: '$ref' });
      return;
    }
    walk(value, target, path, ctx, errors);
  }

  for (const sub of schema.allOf || []) walk(value, sub, path, ctx, errors);

  if (schema.not && validateSub(value, schema.not, path, ctx).valid) {
    errors.push({ path, message: 'valeur exclue par « not »', keyword: 'not' });
  }

  if (schema.if) {
    const cond = validateSub(value, schema.if, path, ctx).valid;
    if (cond && schema.then) walk(value, schema.then, path, ctx, errors);
    if (!cond && schema.else) walk(value, schema.else, path, ctx, errors);
  }

  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    const ok = expected.some((t) => (t === 'number' ? actual === 'number' || actual === 'integer' : TYPES[t]?.(value)));
    if (!ok) {
      errors.push({ path, message: `type attendu ${expected.join(' ou ')}, reçu ${actual}`, keyword: 'type' });
      return; // inutile de poursuivre sur un type faux
    }
  }

  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push({ path, message: `valeur attendue ${JSON.stringify(schema.const)}`, keyword: 'const' });
  }
  if (schema.enum && !schema.enum.some((candidate) => deepEqual(value, candidate))) {
    errors.push({
      path,
      message: `valeur hors liste (${schema.enum.slice(0, 6).map((v) => JSON.stringify(v)).join(', ')})`,
      keyword: 'enum'
    });
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path, message: `chaîne trop courte (${value.length} < ${schema.minLength})`, keyword: 'minLength' });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path, message: `chaîne trop longue (${value.length} > ${schema.maxLength})`, keyword: 'maxLength' });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path, message: `ne respecte pas le motif ${schema.pattern}`, keyword: 'pattern' });
    }
    if (schema.format && FORMATS[schema.format] && !FORMATS[schema.format](value)) {
      errors.push({ path, message: `format ${schema.format} invalide`, keyword: 'format' });
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `minimum ${schema.minimum} non atteint`, keyword: 'minimum' });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `maximum ${schema.maximum} dépassé`, keyword: 'maximum' });
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push({ path, message: `doit être > ${schema.exclusiveMinimum}`, keyword: 'exclusiveMinimum' });
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      errors.push({ path, message: `doit être < ${schema.exclusiveMaximum}`, keyword: 'exclusiveMaximum' });
    }
    if (schema.multipleOf !== undefined && Math.abs(value / schema.multipleOf - Math.round(value / schema.multipleOf)) > 1e-9) {
      errors.push({ path, message: `multiple de ${schema.multipleOf} attendu`, keyword: 'multipleOf' });
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path, message: `trop peu d'éléments (${value.length} < ${schema.minItems})`, keyword: 'minItems' });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({ path, message: `trop d'éléments (${value.length} > ${schema.maxItems})`, keyword: 'maxItems' });
    }
    if (schema.uniqueItems) {
      const seen = new Set();
      for (const [i, item] of value.entries()) {
        const key = JSON.stringify(item);
        if (seen.has(key)) errors.push({ path: `${path}/${i}`, message: 'élément en double', keyword: 'uniqueItems' });
        seen.add(key);
      }
    }
    if (Array.isArray(schema.prefixItems)) {
      schema.prefixItems.forEach((sub, i) => { if (i < value.length) walk(value[i], sub, `${path}/${i}`, ctx, errors); });
    }
    if (schema.items && !Array.isArray(schema.items)) {
      const start = Array.isArray(schema.prefixItems) ? schema.prefixItems.length : 0;
      for (let i = start; i < value.length; i++) walk(value[i], schema.items, `${path}/${i}`, ctx, errors);
    }
    if (schema.contains) {
      const hits = value.filter((item, i) => validateSub(item, schema.contains, `${path}/${i}`, ctx).valid);
      const min = schema.minContains ?? 1;
      const max = schema.maxContains ?? Infinity;
      if (hits.length < min || hits.length > max) {
        errors.push({ path, message: 'aucun élément ne correspond à « contains »', keyword: 'contains' });
      }
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const props = schema.properties || {};
    for (const key of schema.required || []) {
      if (!(key in value)) {
        errors.push({ path: `${path}/${key}`, message: 'propriété obligatoire manquante', keyword: 'required' });
      }
    }
    for (const [key, item] of Object.entries(value)) {
      const target = `${path}/${key}`;
      if (props[key] !== undefined) {
        walk(item, props[key], target, ctx, errors);
      } else if (schema.additionalProperties === false) {
        errors.push({ path: target, message: 'propriété non autorisée', keyword: 'additionalProperties' });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        walk(item, schema.additionalProperties, target, ctx, errors);
      }
      if (schema.propertyNames) {
        walk(key, schema.propertyNames, target, ctx, errors);
      }
    }
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) {
      errors.push({ path, message: 'pas assez de propriétés', keyword: 'minProperties' });
    }
    if (schema.maxProperties !== undefined && Object.keys(value).length > schema.maxProperties) {
      errors.push({ path, message: 'trop de propriétés', keyword: 'maxProperties' });
    }
  }

  // oneOf / anyOf : on retient le message le plus utile en cas d'échec global.
  if (Array.isArray(schema.oneOf)) {
    const results = schema.oneOf.map((sub) => validateSub(value, sub, path, ctx));
    const ok = results.filter((r) => r.valid).length;
    if (ok !== 1) {
      const detail = results.map((r, i) => `#${i} ${r.errors[0]?.message || ''}`).join(' ; ');
      errors.push({ path, message: `une et une seule variante attendue (${ok} valide(s) : ${detail})`, keyword: 'oneOf' });
    }
  }
  if (Array.isArray(schema.anyOf)) {
    const results = schema.anyOf.map((sub) => validateSub(value, sub, path, ctx));
    if (!results.some((r) => r.valid)) {
      errors.push({ path, message: `aucune variante valide (${results[0]?.errors[0]?.message || ''})`, keyword: 'anyOf' });
    }
  }
}

function validateSub(value, schema, path, ctx) {
  const errors = [];
  walk(value, schema, path, ctx, errors);
  return { valid: errors.length === 0, errors };
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

/** Charge un schéma et prépare un validateur lié à ses `$defs` communs. */
export function compile(schema, { common = null } = {}) {
  const root = common ? { ...schema, $defs: { ...(common.$defs || {}), ...(schema.$defs || {}) } } : schema;
  return {
    schema: root,
    validate: (data) => validate(data, root),
    assert: (data, label) => assertValid(data, root, label)
  };
}
