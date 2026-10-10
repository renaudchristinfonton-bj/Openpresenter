export const OUTPUT_PRESETS = Object.freeze(['full', 'screen80', 'bottom', 'bottom-right', 'lowerthird']);
export const OUTPUT_FITS = Object.freeze(['contain', 'cover', 'stretch']);
export const MAX_OUTPUTS = 32;

export const DEFAULT_OUTPUTS = Object.freeze([
  Object.freeze({ id: 'main', name: 'Principale', preset: 'full', width: 1920, height: 1080, fit: 'contain', enabled: true, targetByDefault: true }),
  Object.freeze({ id: 'annexe', name: 'Bandeau bas', preset: 'bottom', width: 1920, height: 1080, fit: 'contain', enabled: true, targetByDefault: true }),
  Object.freeze({ id: 'lt', name: 'Lower third', preset: 'lowerthird', width: 1920, height: 1080, fit: 'contain', enabled: true, targetByDefault: false }),
]);

const clone = (value) => structuredClone(value);
const validId = (value) => /^[\w.-]{1,100}$/.test(String(value || ''));
const cleanName = (value) => String(value || '').trim().replace(/[\u0000-\u001f]/g, '').slice(0, 48);
const dimensions = (value, fallback) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 320 && number <= 8192 ? number : fallback;
};

function uniqueCopyName(outputs, base) {
  const names = new Set(outputs.map((output) => output.name.toLocaleLowerCase()));
  let candidate = `${base} (copie)`;
  let index = 2;
  while (names.has(candidate.toLocaleLowerCase())) candidate = `${base} (copie ${index++})`;
  return candidate.slice(0, 48);
}

export function normalizeOutputs(value) {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_OUTPUTS.map((output) => clone(output));
  const seenIds = new Set();
  const result = [];
  for (const item of value.slice(0, MAX_OUTPUTS)) {
    if (!item || !validId(item.id) || seenIds.has(item.id)) continue;
    const fallback = DEFAULT_OUTPUTS.find((output) => output.id === item.id) || DEFAULT_OUTPUTS[0];
    const name = cleanName(item.name) || fallback.name;
    result.push({
      id: item.id,
      name,
      preset: OUTPUT_PRESETS.includes(item.preset) ? item.preset : fallback.preset,
      width: dimensions(item.width, fallback.width),
      height: dimensions(item.height, fallback.height),
      fit: OUTPUT_FITS.includes(item.fit) ? item.fit : fallback.fit,
      enabled: item.enabled !== false,
      targetByDefault: item.targetByDefault === undefined ? fallback.targetByDefault : !!item.targetByDefault,
    });
    seenIds.add(item.id);
  }
  return result.length ? result : DEFAULT_OUTPUTS.map((output) => clone(output));
}

export function createOutput(outputs, { name, preset = 'full', width = 1920, height = 1080, fit = 'contain' } = {}, makeId = defaultOutputId) {
  const current = normalizeOutputs(outputs);
  const outputName = cleanName(name);
  if (!outputName) throw new TypeError('Donnez un nom à cette sortie.');
  if (current.length >= MAX_OUTPUTS) throw new RangeError(`Maximum : ${MAX_OUTPUTS} sorties.`);
  if (current.some((output) => output.name.toLocaleLowerCase() === outputName.toLocaleLowerCase())) throw new TypeError('Ce nom de sortie est déjà utilisé.');
  if (!OUTPUT_PRESETS.includes(preset)) throw new TypeError('Disposition de sortie inconnue.');
  if (!OUTPUT_FITS.includes(fit)) throw new TypeError('Mode de cadrage inconnu.');
  const id = makeId();
  if (!validId(id) || current.some((output) => output.id === id)) throw new TypeError('Identifiant de sortie invalide ou déjà utilisé.');
  const output = { id, name: outputName, preset, width: dimensions(width, 1920), height: dimensions(height, 1080), fit, enabled: true, targetByDefault: true };
  return { output, outputs: [...current, output] };
}

export function renameOutput(outputs, id, name) {
  const current = normalizeOutputs(outputs);
  const outputName = cleanName(name);
  if (!outputName) throw new TypeError('Le nom de sortie ne peut pas être vide.');
  if (current.some((output) => output.id !== id && output.name.toLocaleLowerCase() === outputName.toLocaleLowerCase())) throw new TypeError('Ce nom de sortie est déjà utilisé.');
  if (!current.some((output) => output.id === id)) throw new TypeError('Sortie introuvable.');
  return current.map((output) => output.id === id ? { ...output, name: outputName } : output);
}

export function updateOutput(outputs, id, updates = {}) {
  const current = normalizeOutputs(outputs);
  if (!current.some((output) => output.id === id)) throw new TypeError('Sortie introuvable.');
  const candidate = { ...current.find((output) => output.id === id), ...updates, id };
  if (updates.name !== undefined) return renameOutput(current, id, updates.name);
  if (updates.preset !== undefined && !OUTPUT_PRESETS.includes(candidate.preset)) throw new TypeError('Disposition de sortie inconnue.');
  if (updates.fit !== undefined && !OUTPUT_FITS.includes(candidate.fit)) throw new TypeError('Mode de cadrage inconnu.');
  candidate.width = dimensions(candidate.width, 1920);
  candidate.height = dimensions(candidate.height, 1080);
  candidate.enabled = candidate.enabled !== false;
  candidate.targetByDefault = !!candidate.targetByDefault;
  return current.map((output) => output.id === id ? candidate : output);
}

export function duplicateOutput(outputs, id, makeId = defaultOutputId) {
  const current = normalizeOutputs(outputs);
  const source = current.find((output) => output.id === id);
  if (!source) throw new TypeError('Sortie introuvable.');
  if (current.length >= MAX_OUTPUTS) throw new RangeError(`Maximum : ${MAX_OUTPUTS} sorties.`);
  const newId = makeId();
  if (!validId(newId) || current.some((output) => output.id === newId)) throw new TypeError('Identifiant de sortie invalide ou déjà utilisé.');
  const output = { ...source, id: newId, name: uniqueCopyName(current, source.name), enabled: true, targetByDefault: source.targetByDefault };
  return { output, outputs: [...current, output] };
}

export function removeOutput(outputs, id) {
  const current = normalizeOutputs(outputs);
  if (!current.some((output) => output.id === id)) throw new TypeError('Sortie introuvable.');
  if (current.length <= 1) throw new RangeError('OpenPresenter doit conserver au moins une sortie OBS.');
  return current.filter((output) => output.id !== id);
}

export function defaultOutputId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `out_${uuid || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`}`;
}

export function createDefaultSceneMap(outputs, kinds, makeScene) {
  return Object.fromEntries(normalizeOutputs(outputs).map((output) => [
    output.id,
    Object.fromEntries(kinds.map((kind) => [kind, makeScene(output.preset, kind)])),
  ]));
}
