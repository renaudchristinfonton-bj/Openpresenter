// Historique annuler/rétablir (EF-09.47 → EF-09.49).
// Pile en mémoire, bornée bas : au moins 80 états garantis (A-10h).
// Un point n'est créé qu'après un geste **terminé**, jamais à chaque pixel.

export const MIN_STATES = 80;

export function createHistory({ limit = 200 } = {}) {
  const capacity = Math.max(MIN_STATES, limit);
  let past = [];
  let future = [];
  let present = null;
  let label = '';

  return {
    get size() { return past.length; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    get value() { return present; },
    get label() { return label; },

    /** Fixe l'état initial sans créer de point d'annulation. */
    reset(value) {
      past = [];
      future = [];
      present = value;
      label = '';
      return this;
    },

    /**
     * Enregistre un nouvel état.
     * @param {any} value
     * @param {string} [action] libellé du geste (« déplacement », « style »…)
     */
    push(value, action = '') {
      if (present !== null) {
        past.push({ value: present, action });
        if (past.length > capacity) past.shift();
      }
      present = value;
      future = [];
      label = action;
      return value;
    },

    undo() {
      if (!past.length) return present;
      const entry = past.pop();
      future.push({ value: present, action: entry.action });
      present = entry.value;
      label = entry.action;
      return present;
    },

    redo() {
      if (!future.length) return present;
      const entry = future.pop();
      past.push({ value: present, action: entry.action });
      present = entry.value;
      label = entry.action;
      return present;
    },

    /** Nombre d'annulations encore possibles. */
    depth() {
      return past.length;
    }
  };
}
