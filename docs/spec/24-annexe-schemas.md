# 24 — Annexe : schémas JSON machine-vérifiables

> **But :** les chapitres décrivent les objets en JSON commenté (`jsonc`), lisible mais
> non validable. Cette annexe fournit les **schémas JSON Schema 2020-12** correspondants,
> qui constituent la référence normative en cas de divergence de lecture.
> **Exigences couvertes :** EF-01, EF-04.4, INV-1 → INV-7, ENF-22, ENF-40.

---

## 24.1 Règles d'usage

| # | Règle |
|---|---|
| 1 | Les schémas vivent dans `app/schema/*.schema.json` et sont versionnés avec le code. |
| 2 | `$id` = `https://openpresenter.local/schema/<nom>.schema.json` — valeur **non résolue sur le réseau**, simple identité logique. |
| 3 | Toute écriture (`PUT`/`POST`) est validée **avant** d'atteindre le disque. Un objet invalide renvoie `400 VALIDATION` avec le chemin JSON fautif. |
| 4 | Toute lecture valide aussi : un fichier invalide sur disque n'est **jamais** chargé silencieusement ; il est déplacé en `project/backups/invalides/<nom>-<date>.json` et signalé dans le diagnostic (chapitre 23). |
| 5 | La validation runtime est écrite **à la main** (`app/src/core/validate.mjs`, ~300 lignes) : aucune dépendance npm au runtime. `ajv` est une **devDependency** utilisée uniquement par `npm test` pour vérifier que le validateur maison et les schémas disent la même chose. |
| 6 | Un schéma ne décrit **jamais** de donnée calculée : `stats`, `refs`, `counts` sont recalculés et peuvent être absents d'un fichier valide. |
| 7 | `additionalProperties: false` partout, sauf mention contraire : un champ inconnu est une erreur de programmation, pas une extension. |
| 8 | Les migrations s'appuient sur `formatVersion` (entier), jamais sur la présence d'un champ. |

**AN-24.1** — `npm run schema:check` valide tous les fichiers de `project/` contre les
schémas et produit un rapport par fichier.
**AN-24.2** — Les fichiers de test (`app/tests/fixtures/*.json`) couvrent au moins un cas
**valide** et un cas **invalide** par schéma, chacun nommé `<schema>-ok.json` /
`<schema>-ko-<raison>.json`.

### 24.1.1 Définitions communes — `common.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/common.schema.json",
  "title": "Définitions communes OpenPresenter",
  "$defs": {
    "id": {
      "type": "string",
      "pattern": "^(prj|bible|sng|scn|out|prof|org|plc|evt|plan|cue|as|fld|grp|tmr|ann|lt|look)_[a-z0-9_]{2,40}$"
    },
    "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "sha8": { "type": "string", "pattern": "^[a-f0-9]{8}$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "date": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
    "rev": { "type": "integer", "minimum": 1 },
    "color": { "type": "string", "pattern": "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" },
    "cssColor": {
      "type": "string",
      "pattern": "^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\\([0-9., ]+\\)|transparent)$"
    },
    "percent": { "type": "number", "minimum": 0, "maximum": 100 },
    "coord": { "type": "number", "minimum": -200, "maximum": 300 },
    "assetRef": { "type": "string", "pattern": "^as_[a-z0-9_]{2,40}$" },
    "locale": { "type": "string", "pattern": "^(fr|en)(-[A-Z]{2})?$" },
    "fit": { "enum": ["contain", "cover", "stretch"] }
  }
}
```

### 24.1.2 Ce que JSON Schema ne peut pas dire

Ces contraintes sont vérifiées par le validateur maison et par les tests de recette.

| Règle | Pourquoi hors schéma | Vérifiée par |
|---|---|---|
| `x`/`y` bornés relativement à `w`/`h` (EF-09.3) | dépendance entre champs | `validate.mjs` + A-10g |
| `arrangements[].order` ne cite que des sections existantes (EF-15.2) | référence inter-objets | test unitaire |
| `scenesByKind` ne cite que des `kind` supportés | dépend du catalogue interne | `validate.mjs` |
| Unicité des `id` dans une collection | unicité inter-documents | `validate.mjs` + index |
| `preset` compatible avec `kind` | table de compatibilité | chapitre 07 § 7.4 |
| Polices : présence de l'asset de police | disponibilité fichier | test A-10 + outil d'intégrité |
| Profondeur de groupe ≤ 3 (EF-09.38) | récursion bornée | `validate.mjs` |
| `order` d'arrangement sans section vide | contrainte sémantique | test unitaire |

---

## 24.2 `project.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/project.schema.json",
  "title": "project.json",
  "type": "object",
  "required": ["id", "name", "formatVersion", "createdAt", "settings"],
  "additionalProperties": false,
  "properties": {
    "id": { "$ref": "common.schema.json#/$defs/id" },
    "name": { "type": "string", "minLength": 1, "maxLength": 120 },
    "formatVersion": { "type": "integer", "minimum": 1, "maximum": 99 },
    "appVersion": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    "createdAt": { "$ref": "common.schema.json#/$defs/timestamp" },
    "updatedAt": { "$ref": "common.schema.json#/$defs/timestamp" },
    "language": { "$ref": "common.schema.json#/$defs/locale" },
    "settings": { "$ref": "#/$defs/settings" },
    "stats": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "bibles": { "type": "integer", "minimum": 0 },
        "songs": { "type": "integer", "minimum": 0 },
        "media": { "type": "integer", "minimum": 0 },
        "scenes": { "type": "integer", "minimum": 0 },
        "profiles": { "type": "integer", "minimum": 0 },
        "events": { "type": "integer", "minimum": 0 }
      }
    }
  },
  "$defs": {
    "settings": {
      "type": "object",
      "additionalProperties": false,
      "required": ["port"],
      "properties": {
        "port": { "type": "integer", "minimum": 1024, "maximum": 65535 },
        "lanToken": { "type": ["string", "null"], "pattern": "^[A-Z2-9]{4}$" },
        "lanTokenEnabled": { "type": "boolean" },
        "activeProfileId": { "type": ["string", "null"] },
        "activeEventId": { "type": ["string", "null"] },
        "defaultBibleId": { "type": ["string", "null"] },
        "maxAssetWarnBytes": { "type": "integer", "minimum": 1048576 },
        "autoBackup": { "type": "boolean" },
        "autoBackupKeep": { "type": "integer", "minimum": 1, "maximum": 100 },
        "readOnly": { "type": "boolean" },
        "catalogEnabled": { "type": "boolean", "default": false },
        "blankOnStartup": { "type": "boolean" },
        "verboseLog": { "type": "boolean", "default": false }
      }
    }
  }
}
```

**Remarque** — `lanToken` est `null` quand `lanTokenEnabled` est faux ; les deux champs
existent toujours pour éviter un état indéfini après régénération.

---

## 24.3 `asset-index.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/asset-index.schema.json",
  "title": "assets/index.json",
  "type": "object",
  "required": ["version", "assets"],
  "additionalProperties": false,
  "properties": {
    "version": { "const": 1 },
    "assets": {
      "type": "object",
      "propertyNames": { "pattern": "^[a-f0-9]{64}$" },
      "additionalProperties": { "$ref": "#/$defs/asset" }
    }
  },
  "$defs": {
    "asset": {
      "type": "object",
      "required": ["sha256", "path", "mime", "ext", "bytes", "kind", "importedAt", "refs"],
      "additionalProperties": false,
      "properties": {
        "sha256": { "$ref": "common.schema.json#/$defs/sha256" },
        "path": { "type": "string", "pattern": "^(media|bibles|songs|backgrounds|logos|fonts)/[a-f0-9]{8}\\.[a-z0-9]{1,8}$" },
        "mime": { "type": "string", "minLength": 3 },
        "ext": { "type": "string", "pattern": "^[a-z0-9]{1,8}$" },
        "bytes": { "type": "integer", "minimum": 0 },
        "originalName": { "type": "string", "maxLength": 255 },
        "importedAt": { "$ref": "common.schema.json#/$defs/timestamp" },
        "kind": { "enum": ["bible", "song", "media", "background", "logo", "font"] },
        "linked": { "type": "boolean", "default": false },
        "absolutePath": { "type": "string", "description": "UNIQUEMENT si linked=true (EF-02.6)" },
        "meta": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "width": { "type": "integer", "minimum": 1 },
            "height": { "type": "integer", "minimum": 1 },
            "durationMs": { "type": "integer", "minimum": 0 },
            "pages": { "type": "integer", "minimum": 1 },
            "codec": { "type": "string" }
          }
        },
        "refs": { "type": "integer", "minimum": 0 }
      },
      "allOf": [
        {
          "if": { "properties": { "linked": { "const": true } }, "required": ["linked"] },
          "then": { "required": ["absolutePath"] },
          "else": { "not": { "required": ["absolutePath"] } }
        }
      ]
    }
  }
}
```

---

## 24.4 `bible.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/bible.schema.json",
  "title": "library/bibles/<id>.json",
  "type": "object",
  "required": ["id", "name", "language", "source", "books"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^bible_[a-z0-9_]{2,40}$" },
    "rev": { "$ref": "common.schema.json#/$defs/rev" },
    "name": { "type": "string", "minLength": 1, "maxLength": 120 },
    "shortName": { "type": "string", "maxLength": 24 },
    "abbreviation": { "type": "string", "maxLength": 12 },
    "language": { "$ref": "common.schema.json#/$defs/locale" },
    "direction": { "enum": ["ltr", "rtl"], "default": "ltr" },
    "source": {
      "type": "object",
      "required": ["kind"],
      "additionalProperties": false,
      "properties": {
        "kind": { "enum": ["import", "catalog", "sample"] },
        "format": { "enum": ["beblia", "zefania", "osis", "usfx"] },
        "originalName": { "type": "string" },
        "assetId": { "$ref": "common.schema.json#/$defs/assetRef" },
        "catalogEntry": { "type": ["string", "null"] },
        "license": { "type": "string" },
        "importedAt": { "$ref": "common.schema.json#/$defs/timestamp" }
      }
    },
    "counts": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "books": { "type": "integer", "minimum": 1 },
        "chapters": { "type": "integer", "minimum": 1 },
        "verses": { "type": "integer", "minimum": 1 }
      }
    },
    "books": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["num", "name", "abbr", "chapters"],
        "additionalProperties": false,
        "properties": {
          "num": { "type": "integer", "minimum": 1, "maximum": 66 },
          "name": { "type": "string", "minLength": 1 },
          "abbr": { "type": "string", "minLength": 1, "maxLength": 6 },
          "chapters": { "type": "integer", "minimum": 1 }
        }
      }
    },
    "indexAssetId": { "type": ["string", "null"] },
    "favorites": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[0-9]{1,2}-[0-9]{1,3}-[0-9]{1,3}$" }
    },
    "annotations": {
      "type": "object",
      "propertyNames": { "pattern": "^[0-9]{1,2}-[0-9]{1,3}-[0-9]{1,3}$" },
      "additionalProperties": {
        "type": "object",
        "required": ["html"],
        "additionalProperties": false,
        "properties": {
          "html": { "type": "string", "maxLength": 8000 },
          "note": { "type": "string", "maxLength": 2000 },
          "updatedAt": { "$ref": "common.schema.json#/$defs/timestamp" }
        }
      }
    }
  }
}
```

### 24.4.1 `verses.schema.json` (fichier séparé, EF-11.1)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/verses.schema.json",
  "title": "library/bibles/<id>.verses.json",
  "type": "object",
  "required": ["bibleId", "chapters"],
  "additionalProperties": false,
  "properties": {
    "bibleId": { "type": "string", "pattern": "^bible_[a-z0-9_]{2,40}$" },
    "chapters": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["b", "c", "v"],
        "additionalProperties": false,
        "properties": {
          "b": { "type": "integer", "minimum": 1, "maximum": 66 },
          "c": { "type": "integer", "minimum": 1 },
          "v": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } }
        }
      }
    }
  }
}
```

**AN-24.3** — `v[0]` correspond au verset 1. Aucun trou : un chapitre absent du fichier
n'existe pas ; l'interface affiche alors `TXT: Chapitre non disponible dans cette version.`

---

## 24.5 `song.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/song.schema.json",
  "title": "library/songs/<id>.json",
  "type": "object",
  "required": ["id", "title", "sections", "arrangements"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^sng_[a-z0-9_]{2,40}$" },
    "rev": { "$ref": "common.schema.json#/$defs/rev" },
    "title": { "type": "string", "minLength": 1, "maxLength": 200 },
    "titleOriginal": { "type": "string", "maxLength": 200 },
    "artist": { "type": "string", "maxLength": 200 },
    "composer": { "type": "string", "maxLength": 200 },
    "copyright": { "type": "string", "maxLength": 400 },
    "ccli": { "type": ["string", "null"], "maxLength": 20 },
    "key": { "type": "string", "pattern": "^([A-G](#|b)?)(maj|min)?$" },
    "tempo": { "type": "integer", "minimum": 20, "maximum": 300 },
    "timeSignature": { "type": "string", "pattern": "^[0-9]{1,2}/[0-9]{1,2}$" },
    "durationSec": { "type": ["integer", "null"], "minimum": 1 },
    "language": { "$ref": "common.schema.json#/$defs/locale" },
    "tags": { "type": "array", "items": { "type": "string", "maxLength": 40 } },
    "folders": { "type": "array", "items": { "type": "string", "pattern": "^fld_[a-z0-9_]{2,40}$" } },
    "sections": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "name", "type", "lines"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^sec_[a-z0-9_]{1,30}$" },
          "name": { "type": "string", "minLength": 1, "maxLength": 60 },
          "type": { "enum": ["verse", "chorus", "bridge", "prechorus", "intro", "outro", "tag", "interlude"] },
          "lines": { "type": "array", "minItems": 1, "items": { "type": "string", "maxLength": 400 } }
        }
      }
    },
    "arrangements": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "name", "order"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^arr_[a-z0-9_]{1,30}$" },
          "name": { "type": "string", "minLength": 1, "maxLength": 60 },
          "order": { "type": "array", "minItems": 1, "items": { "type": "string", "pattern": "^sec_[a-z0-9_]{1,30}$" } }
        }
      }
    },
    "activeArrangementId": { "type": "string", "pattern": "^arr_[a-z0-9_]{1,30}$" },
    "sourceAssetId": { "type": ["string", "null"] },
    "chords": {
      "type": "object",
      "propertyNames": { "pattern": "^sec_[a-z0-9_]{1,30}$" },
      "additionalProperties": {
        "type": "array",
        "items": {
          "type": "array",
          "prefixItems": [
            { "type": "string", "pattern": "^([A-G](#|b)?)(maj|min|dim|aug|sus[24]|add[0-9]{1,2}|[0-9]{1,2})?(/[A-G](#|b)?)?$" },
            { "type": "integer", "minimum": 0 }
          ],
          "items": false
        }
      }
    }
  }
}
```

**AN-24.4** — `chords[section][n] = [accord, caractère depuis le début de la ligne]` :
le décalage est un **nombre de caractères**, pas de pixels, pour rester indépendant de la
police.

---

## 24.6 `outputs.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/outputs.schema.json",
  "title": "outputs/outputs.json",
  "type": "object",
  "required": ["rev", "outputs"],
  "additionalProperties": false,
  "properties": {
    "rev": { "$ref": "common.schema.json#/$defs/rev" },
    "outputs": {
      "type": "array",
      "minItems": 1,
      "maxItems": 32,
      "items": { "$ref": "#/$defs/output" }
    }
  },
  "$defs": {
    "kindMap": {
      "type": "object",
      "additionalProperties": false,
      "required": ["bible", "songs", "media", "announcements", "lowerthird", "timer", "plan"],
      "properties": {
        "bible": { "type": "boolean" },
        "songs": { "type": "boolean" },
        "media": { "type": "boolean" },
        "announcements": { "type": "boolean" },
        "lowerthird": { "type": "boolean" },
        "timer": { "type": "boolean" },
        "plan": { "type": "boolean" }
      }
    },
    "output": {
      "type": "object",
      "required": ["id", "name", "preset", "width", "height", "fit", "transparent", "enabled", "receives"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": "string", "pattern": "^out_[a-z0-9_]{2,40}$" },
        "name": { "type": "string", "minLength": 1, "maxLength": 80 },
        "preset": { "enum": ["full", "screen80", "bottom", "bottom-right", "lowerthird", "custom"] },
        "width": { "type": "integer", "minimum": 320, "maximum": 7680 },
        "height": { "type": "integer", "minimum": 240, "maximum": 4320 },
        "fit": { "$ref": "common.schema.json#/$defs/fit" },
        "transparent": { "type": "boolean" },
        "enabled": { "type": "boolean" },
        "targetByDefault": { "type": "boolean" },
        "receives": { "$ref": "#/$defs/kindMap" },
        "scenesByKind": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "bible": { "type": ["string", "null"] },
            "songs": { "type": ["string", "null"] },
            "media": { "type": ["string", "null"] },
            "announcements": { "type": ["string", "null"] },
            "lowerthird": { "type": ["string", "null"] },
            "timer": { "type": ["string", "null"] },
            "plan": { "type": ["string", "null"] }
          }
        },
        "notes": { "type": "string", "maxLength": 400 }
      }
    }
  }
}
```

---

## 24.7 `scene.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/scene.schema.json",
  "title": "scenes/<id>.json",
  "type": "object",
  "required": ["id", "name", "kind", "layers"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^scn_[a-z0-9_]{2,40}$" },
    "rev": { "$ref": "common.schema.json#/$defs/rev" },
    "name": { "type": "string", "minLength": 1, "maxLength": 80 },
    "kind": { "enum": ["bible", "songs", "media", "announcements", "lowerthird", "timer", "plan"] },
    "preset": { "enum": ["full", "screen80", "bottom", "bottom-right", "lowerthird", "custom"] },
    "transparent": { "type": "boolean" },
    "bgColor": { "$ref": "common.schema.json#/$defs/cssColor" },
    "accentColor": { "$ref": "common.schema.json#/$defs/color" },
    "textColor": { "$ref": "common.schema.json#/$defs/color" },
    "shapeRadius": { "type": "integer", "minimum": 0, "maximum": 200 },
    "splitMode": { "enum": ["auto", "manual", "off"] },
    "splitBy": { "enum": ["words", "chars", "lines"] },
    "maxWordsPerScreen": { "type": "integer", "minimum": 3, "maximum": 120 },
    "maxCharsPerScreen": { "type": "integer", "minimum": 20, "maximum": 600 },
    "maxLinesPerScreen": { "type": "integer", "minimum": 1, "maximum": 8 },
    "minWordsPerPart": { "type": "integer", "minimum": 1, "maximum": 20 },
    "balanceParts": { "type": "boolean" },
    "transitionIn": { "$ref": "#/$defs/transition" },
    "transitionOut": { "$ref": "#/$defs/transition" },
    "transitionDurationMs": { "type": "integer", "minimum": 80, "maximum": 2000 },
    "showPartsHint": { "type": "boolean" },
    "safeArea": { "enum": [0, 5, 10] },
    "layers": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/layer" } }
  },
  "$defs": {
    "transition": { "enum": ["none", "fade", "zoom", "slide-up", "slide-down", "slide-left", "slide-right", "wipe", "blur"] },
    "commonLayer": {
      "type": "object",
      "required": ["id", "type", "name", "visible", "opacity", "x", "y", "w"],
      "properties": {
        "id": { "type": "string", "pattern": "^lyr_[a-z0-9_]{2,40}$" },
        "type": { "enum": ["background", "overlay", "text", "image", "group"] },
        "name": { "type": "string", "minLength": 1, "maxLength": 60 },
        "visible": { "type": "boolean" },
        "locked": { "type": "boolean" },
        "opacity": { "type": "number", "minimum": 0, "maximum": 1 },
        "x": { "$ref": "common.schema.json#/$defs/coord" },
        "y": { "$ref": "common.schema.json#/$defs/coord" },
        "w": { "type": "number", "minimum": 2, "maximum": 300 },
        "h": { "type": ["number", "null"], "minimum": 2, "maximum": 300 },
        "rotate": { "type": "number", "minimum": -180, "maximum": 180 },
        "zIndex": { "type": ["integer", "null"] },
        "blendMode": { "enum": ["normal", "multiply", "screen", "overlay"] },
        "shadow": { "$ref": "#/$defs/layerShadow" }
      }
    },
    "layerShadow": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "enabled": { "type": "boolean" },
        "color": { "$ref": "common.schema.json#/$defs/color" },
        "opacity": { "type": "number", "minimum": 0, "maximum": 1 },
        "blur": { "type": "number", "minimum": 0, "maximum": 100 },
        "offsetX": { "type": "number", "minimum": -100, "maximum": 100 },
        "offsetY": { "type": "number", "minimum": -100, "maximum": 100 }
      }
    },
    "layer": {
      "oneOf": [
        { "$ref": "#/$defs/backgroundLayer" },
        { "$ref": "#/$defs/overlayLayer" },
        { "$ref": "#/$defs/textLayer" },
        { "$ref": "#/$defs/imageLayer" },
        { "$ref": "#/$defs/groupLayer" }
      ]
    },
    "backgroundLayer": {
      "allOf": [
        { "$ref": "#/$defs/commonLayer" },
        {
          "properties": {
            "type": { "const": "background" },
            "forceVisible": { "type": "boolean" },
            "source": { "$ref": "#/$defs/backgroundSource" }
          },
          "required": ["source"]
        }
      ]
    },
    "backgroundSource": {
      "type": "object",
      "required": ["kind"],
      "additionalProperties": false,
      "properties": {
        "kind": { "enum": ["image", "video", "gradient", "color"] },
        "assetId": { "$ref": "common.schema.json#/$defs/assetRef" },
        "fit": { "$ref": "common.schema.json#/$defs/fit" },
        "position": { "type": "string", "maxLength": 40 },
        "offsetX": { "type": "number", "minimum": -100, "maximum": 100 },
        "offsetY": { "type": "number", "minimum": -100, "maximum": 100 },
        "scale": { "type": "number", "minimum": 10, "maximum": 400 },
        "blur": { "type": "number", "minimum": 0, "maximum": 40 },
        "brightness": { "type": "number", "minimum": 20, "maximum": 200 },
        "contrast": { "type": "number", "minimum": 20, "maximum": 200 },
        "saturate": { "type": "number", "minimum": 0, "maximum": 300 },
        "grayscale": { "type": "number", "minimum": 0, "maximum": 100 },
        "tint": { "$ref": "common.schema.json#/$defs/color" },
        "tintOpacity": { "type": "number", "minimum": 0, "maximum": 1 },
        "loop": { "type": "boolean" },
        "startAtMs": { "type": "integer", "minimum": 0 },
        "muted": { "type": "boolean" },
        "playbackRate": { "type": "number", "minimum": 0.25, "maximum": 4 },
        "color1": { "$ref": "common.schema.json#/$defs/cssColor" },
        "color2": { "$ref": "common.schema.json#/$defs/cssColor" },
        "gradientType": { "enum": ["linear", "radial"] },
        "gradientAngle": { "type": "number", "minimum": 0, "maximum": 360 },
        "repeat": { "type": "boolean" },
        "color": { "$ref": "common.schema.json#/$defs/cssColor" }
      }
    },
    "overlayLayer": {
      "allOf": [
        { "$ref": "#/$defs/commonLayer" },
        {
          "properties": {
            "type": { "const": "overlay" },
            "shape": { "enum": ["rect", "rounded", "ellipse", "line"] },
            "bg": { "$ref": "common.schema.json#/$defs/cssColor" },
            "radius": { "type": "integer", "minimum": 0, "maximum": 400 },
            "border": { "$ref": "#/$defs/border" },
            "cornerRadiusPerCorner": {
              "type": ["array", "null"],
              "minItems": 4,
              "maxItems": 4,
              "items": { "type": "integer", "minimum": 0, "maximum": 400 }
            }
          }
        }
      ]
    },
    "border": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "width": { "type": "number", "minimum": 0, "maximum": 100 },
        "color": { "$ref": "common.schema.json#/$defs/cssColor" },
        "sides": {
          "type": "array",
          "uniqueItems": true,
          "items": { "enum": ["top", "right", "bottom", "left"] }
        },
        "style": { "enum": ["solid", "dashed", "dotted", "double"] }
      }
    },
    "textLayer": {
      "allOf": [
        { "$ref": "#/$defs/commonLayer" },
        {
          "properties": {
            "type": { "const": "text" },
            "bind": { "$ref": "#/$defs/bind" },
            "customText": { "type": "string", "maxLength": 4000 },
            "style": { "$ref": "#/$defs/textStyle" },
            "autoFit": { "$ref": "#/$defs/autoFit" }
          },
          "required": ["bind", "style"]
        }
      ]
    },
    "bind": {
      "enum": ["custom", "ref", "badge", "verse", "title", "section", "lyrics",
               "announcement", "timer", "image", "media", "clock", "planLabel"]
    },
    "textStyle": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "fontFamily": { "type": "string", "minLength": 1, "maxLength": 80 },
        "fontSize": { "type": "number", "minimum": 8, "maximum": 400 },
        "weight": { "enum": [100, 200, 300, 400, 500, 600, 700, 800, 900] },
        "color": { "$ref": "common.schema.json#/$defs/cssColor" },
        "align": { "enum": ["left", "center", "right", "justify"] },
        "verticalAlign": { "enum": ["top", "center", "bottom"] },
        "alignLast": { "enum": ["auto", "left", "center", "right"] },
        "textCase": { "enum": ["none", "uppercase", "lowercase", "capitalize", "smallcaps"] },
        "letterSpacing": { "type": "number", "minimum": -10, "maximum": 40 },
        "wordSpacing": { "type": "number", "minimum": -10, "maximum": 60 },
        "lineHeight": { "type": "number", "minimum": 0.8, "maximum": 3 },
        "paragraphSpacing": { "type": "number", "minimum": 0, "maximum": 100 },
        "italic": { "type": "boolean" },
        "bold": { "type": "boolean" },
        "underline": { "type": "boolean" },
        "strike": { "type": "boolean" },
        "stroke": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "enabled": { "type": "boolean" },
            "color": { "$ref": "common.schema.json#/$defs/color" },
            "width": { "type": "number", "minimum": 0, "maximum": 20 }
          }
        },
        "shadow": { "type": "number", "minimum": 0, "maximum": 40 },
        "padding": { "type": "number", "minimum": 0, "maximum": 200 },
        "bg": { "type": ["string", "null"] },
        "radius": { "type": "number", "minimum": 0, "maximum": 999 }
      }
    },
    "autoFit": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "enabled": { "type": "boolean" },
        "min": { "type": "number", "minimum": 8, "maximum": 200 },
        "max": { "type": "number", "minimum": 8, "maximum": 400 },
        "scaleDown": { "type": "boolean" },
        "scaleUp": { "type": "boolean" }
      }
    },
    "imageLayer": {
      "allOf": [
        { "$ref": "#/$defs/commonLayer" },
        {
          "properties": {
            "type": { "const": "image" },
            "bind": { "type": ["string", "null"], "enum": [null, "image", "media", "backgroundMedia"] },
            "assetId": { "type": ["string", "null"] },
            "fit": { "$ref": "common.schema.json#/$defs/fit" },
            "radius": { "type": "integer", "minimum": 0, "maximum": 400 },
            "radiusPerCorner": {
              "type": ["array", "null"],
              "minItems": 4,
              "maxItems": 4,
              "items": { "type": "integer", "minimum": 0, "maximum": 400 }
            },
            "crop": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "top": { "$ref": "common.schema.json#/$defs/percent" },
                "right": { "$ref": "common.schema.json#/$defs/percent" },
                "bottom": { "$ref": "common.schema.json#/$defs/percent" },
                "left": { "$ref": "common.schema.json#/$defs/percent" }
              }
            },
            "flipH": { "type": "boolean" },
            "flipV": { "type": "boolean" }
          }
        }
      ]
    },
    "groupLayer": {
      "allOf": [
        { "$ref": "#/$defs/commonLayer" },
        {
          "properties": {
            "type": { "const": "group" },
            "children": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/layer" } }
          },
          "required": ["children"]
        }
      ]
    }
  }
}
```

**AN-24.5** — La profondeur de `group.children` est limitée à **3** ; un 4ᵉ niveau est
rejeté à la validation, pas aplati silencieusement (EF-09.38).
**AN-24.6** — Les calques d'une scène ont des `id` uniques **y compris dans les groupes**.

---

## 24.8 `profile.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/profile.schema.json",
  "title": "profiles/<id>.json",
  "type": "object",
  "required": ["id", "name", "kind", "outputs"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^prof_[a-z0-9_]{2,40}$" },
    "rev": { "$ref": "common.schema.json#/$defs/rev" },
    "name": { "type": "string", "minLength": 1, "maxLength": 100 },
    "kind": { "enum": ["church", "conference", "stream", "school", "custom"] },
    "description": { "type": "string", "maxLength": 400 },
    "color": { "$ref": "common.schema.json#/$defs/color" },
    "icon": { "enum": ["church", "mic", "video", "graduation", "star"] },
    "outputs": {
      "type": "array",
      "minItems": 1,
      "maxItems": 32,
      "items": {
        "type": "object",
        "required": ["ref", "name", "preset", "width", "height", "fit", "transparent", "receives"],
        "additionalProperties": false,
        "properties": {
          "ref": { "type": "string", "pattern": "^out_[a-z0-9_]{2,40}$" },
          "name": { "type": "string", "minLength": 1, "maxLength": 80 },
          "preset": { "enum": ["full", "screen80", "bottom", "bottom-right", "lowerthird", "custom"] },
          "width": { "type": "integer", "minimum": 320, "maximum": 7680 },
          "height": { "type": "integer", "minimum": 240, "maximum": 4320 },
          "fit": { "$ref": "common.schema.json#/$defs/fit" },
          "transparent": { "type": "boolean" },
          "receives": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "bible": { "type": "boolean" },
              "songs": { "type": "boolean" },
              "media": { "type": "boolean" },
              "announcements": { "type": "boolean" },
              "lowerthird": { "type": "boolean" },
              "timer": { "type": "boolean" },
              "plan": { "type": "boolean" }
            }
          }
        }
      }
    },
    "looks": { "type": "array", "items": { "type": "string", "pattern": "^look_[a-z0-9_]{2,40}$" } },
    "defaultLook": { "type": "string", "pattern": "^look_[a-z0-9_]{2,40}$" },
    "bibles": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "primary": { "type": ["string", "null"] },
        "secondary": { "type": ["string", "null"] },
        "showTwoVersions": { "type": "boolean" }
      }
    },
    "songFolders": { "type": "array", "items": { "type": "string" } },
    "mediaGroups": { "type": "array", "items": { "type": "string" } },
    "stage": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "enabled": { "type": "boolean" },
        "timerLabel": { "type": "string", "maxLength": 40 },
        "defaultMinutes": { "type": "integer", "minimum": 1, "maximum": 240 },
        "warnMinutes": { "type": "integer", "minimum": 0, "maximum": 60 },
        "criticalMinutes": { "type": "integer", "minimum": 0, "maximum": 60 },
        "showChords": { "type": "boolean" },
        "messageHistorySize": { "type": "integer", "minimum": 1, "maximum": 20 }
      }
    },
    "planTemplate": { "type": ["string", "null"] },
    "keyboardProfile": { "enum": ["standard", "compact", "custom"] },
    "splitDefaults": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "bible": { "$ref": "#/$defs/splitDefaults" },
        "songs": { "$ref": "#/$defs/splitDefaults" }
      }
    }
  },
  "$defs": {
    "splitDefaults": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "maxWordsPerScreen": { "type": "integer", "minimum": 3, "maximum": 120 },
        "splitBy": { "enum": ["words", "chars", "lines"] }
      }
    }
  }
}
```

---

## 24.9 `org.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/org.schema.json",
  "title": "orgs/<id>.json",
  "type": "object",
  "required": ["id", "name", "kind", "places"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^org_[a-z0-9_]{2,40}$" },
    "rev": { "$ref": "common.schema.json#/$defs/rev" },
    "name": { "type": "string", "minLength": 1, "maxLength": 120 },
    "kind": { "enum": ["church", "conference", "school", "association", "other"] },
    "contact": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "email": { "type": "string", "maxLength": 200 },
        "phone": { "type": "string", "maxLength": 40 },
        "address": { "type": "string", "maxLength": 400 }
      }
    },
    "logoAssetId": { "type": ["string", "null"] },
    "places": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "name"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^plc_[a-z0-9_]{2,40}$" },
          "name": { "type": "string", "minLength": 1, "maxLength": 120 },
          "capacity": { "type": ["integer", "null"], "minimum": 1 },
          "screens": { "type": "array", "items": { "type": "string", "maxLength": 80 } }
        }
      }
    }
  }
}
```

---

## 24.10 `event.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/event.schema.json",
  "title": "events/<id>.json",
  "type": "object",
  "required": ["id", "name", "startsAt", "plan"],
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^evt_[a-z0-9_-]{2,40}$" },
    "rev": { "$ref": "common.schema.json#/$defs/rev" },
    "name": { "type": "string", "minLength": 1, "maxLength": 140 },
    "startsAt": { "$ref": "common.schema.json#/$defs/timestamp" },
    "endsAt": { "type": ["string", "null"] },
    "orgId": { "type": ["string", "null"] },
    "placeId": { "type": ["string", "null"] },
    "profileId": { "type": ["string", "null"] },
    "color": { "$ref": "common.schema.json#/$defs/color" },
    "description": { "type": "string", "maxLength": 2000 },
    "recurrence": {
      "type": ["object", "null"],
      "additionalProperties": false,
      "properties": {
        "freq": { "enum": ["daily", "weekly", "monthly"] },
        "byDay": { "type": "array", "items": { "enum": ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] } },
        "until": { "type": ["string", "null"] }
      }
    },
    "plan": { "$ref": "#/$defs/plan" },
    "history": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["cueId", "shownAt"],
        "additionalProperties": false,
        "properties": {
          "cueId": { "type": "string", "pattern": "^cue_[a-z0-9_]{2,40}$" },
          "shownAt": { "$ref": "common.schema.json#/$defs/timestamp" },
          "outputs": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  },
  "$defs": {
    "plan": {
      "type": "object",
      "required": ["id", "cues"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": "string", "pattern": "^plan_[a-z0-9_]{2,40}$" },
        "cues": { "type": "array", "items": { "$ref": "#/$defs/cue" } }
      }
    },
    "cue": {
      "type": "object",
      "required": ["id", "kind", "label"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": "string", "pattern": "^cue_[a-z0-9_]{2,40}$" },
        "kind": { "enum": ["note", "bible", "song", "media", "announcement", "lowerthird", "timer", "blank"] },
        "label": { "type": "string", "minLength": 1, "maxLength": 120 },
        "durationSec": { "type": ["integer", "null"], "minimum": 0 },
        "notes": { "type": "string", "maxLength": 2000 },
        "bibleId": { "type": ["string", "null"] },
        "ref": { "type": ["string", "null"], "description": "format <livre>-<chapitre>-<verset>[..<livre>-<ch>-<v>]" },
        "songId": { "type": ["string", "null"] },
        "arrangementId": { "type": ["string", "null"] },
        "assetId": { "type": ["string", "null"] },
        "announcementId": { "type": ["string", "null"] },
        "lowerthirdId": { "type": ["string", "null"] },
        "timerId": { "type": ["string", "null"] }
      }
    }
  }
}
```

**AN-24.7** — Le champ `ref` d'un cue utilise le format interne
`<livre>-<chapitre>-<verset>` (`43-3-16`), jamais la forme affichée (`Jean 3:16`).
**AN-24.8** — Un cue `note` ignore tous les champs de contenu ; ils sont refusés par
`additionalProperties: false` s'ils sont présents (liste fermée par `kind`).

---

## 24.11 `session-state.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/session-state.schema.json",
  "title": "session-state.json",
  "type": "object",
  "required": ["savedAt", "outputs"],
  "additionalProperties": false,
  "properties": {
    "savedAt": { "$ref": "common.schema.json#/$defs/timestamp" },
    "activeEventId": { "type": ["string", "null"] },
    "plan": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "eventId": { "type": ["string", "null"] },
        "cueId": { "type": ["string", "null"] },
        "index": { "type": "integer", "minimum": 0 }
      }
    },
    "bible": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "bibleId": { "type": ["string", "null"] },
        "ref": { "type": ["string", "null"] },
        "partIndex": { "type": "integer", "minimum": 0 }
      }
    },
    "timer": {
      "type": ["object", "null"],
      "additionalProperties": false,
      "properties": {
        "id": { "type": ["string", "null"] },
        "running": { "type": "boolean" },
        "remainingMs": { "type": "integer", "minimum": 0 },
        "endAt": { "type": ["string", "null"] }
      }
    },
    "outputs": {
      "type": "object",
      "propertyNames": { "pattern": "^out_[a-z0-9_]{2,40}$" },
      "additionalProperties": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "kind": { "enum": ["bible", "songs", "media", "announcements", "lowerthird", "timer", "plan", "blank", null] },
          "payload": { "type": ["object", "null"] },
          "cleared": { "type": "boolean" }
        }
      }
    }
  }
}
```

**AN-24.9** — `session-state.json` est écrit **au plus une fois par seconde** et à
chaque changement d'état significatif, pour permettre la reprise après plantage (A-15).

---

## 24.12 `manifest.schema.json` (archive d'export)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/manifest.schema.json",
  "title": "manifest.json dans une archive .openpresenter.zip",
  "type": "object",
  "required": ["formatVersion", "appVersion", "exportedAt", "projectId", "files"],
  "additionalProperties": false,
  "properties": {
    "formatVersion": { "type": "integer", "minimum": 1 },
    "appVersion": { "type": "string" },
    "exportedAt": { "$ref": "common.schema.json#/$defs/timestamp" },
    "projectId": { "type": "string" },
    "projectName": { "type": "string" },
    "includesMedia": { "type": "boolean" },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path", "bytes", "sha256"],
        "additionalProperties": false,
        "properties": {
          "path": { "type": "string", "pattern": "^(?!\\.\\.)[A-Za-z0-9._/-]+$" },
          "bytes": { "type": "integer", "minimum": 0 },
          "sha256": { "$ref": "common.schema.json#/$defs/sha256" }
        }
      }
    },
    "counts": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "bibles": { "type": "integer" },
        "songs": { "type": "integer" },
        "media": { "type": "integer" },
        "scenes": { "type": "integer" },
        "profiles": { "type": "integer" },
        "events": { "type": "integer" }
      }
    }
  }
}
```

**AN-24.10** — Aucun chemin de `files[].path` ne commence par `/`, ne contient `..`, ni
`\` : une archive ne peut pas écrire hors du dossier cible (ENF-25).

---

## 24.13 Enveloppes d'API et de WebSocket

### 24.13.1 Erreur HTTP

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/api-error.schema.json",
  "title": "Réponse d'erreur uniforme",
  "type": "object",
  "required": ["error"],
  "additionalProperties": false,
  "properties": {
    "error": {
      "type": "object",
      "required": ["code", "message"],
      "additionalProperties": false,
      "properties": {
        "code": {
          "enum": ["NOT_FOUND", "VALIDATION", "CONFLICT", "TOO_LARGE", "UNSUPPORTED",
                   "WRITE_FAILED", "READ_ONLY", "BAD_ARCHIVE", "FORMAT_TOO_RECENT",
                   "OFFLINE", "TIMEOUT", "CHECKSUM", "UNKNOWN_TYPE", "LAST_ITEM",
                   "LOCKED", "UNSUPPORTED_SOURCE"]
        },
        "message": { "type": "string", "minLength": 1 },
        "detail": { "type": ["string", "object", "null"] },
        "path": { "type": "string", "description": "chemin JSON fautif pour VALIDATION" }
      }
    }
  }
}
```

### 24.13.2 Messages WebSocket

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/ws-envelope.schema.json",
  "title": "Enveloppe WebSocket",
  "type": "object",
  "required": ["t", "ts"],
  "additionalProperties": false,
  "properties": {
    "t": {
      "enum": ["show", "nav", "clear", "timer", "stageMessage", "plan",
               "project:changed", "hello", "hello:ack", "ping", "pong", "error"]
    },
    "ts": { "type": "integer", "minimum": 0 },
    "origin": { "type": "string" },
    "kind": { "enum": ["bible", "songs", "media", "announcements", "lowerthird", "timer", "plan"] },
    "bindings": { "type": "object" },
    "parts": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "count": { "type": "integer", "minimum": 1 },
        "index": { "type": "integer", "minimum": 0 },
        "maxWords": { "type": "integer", "minimum": 1 }
      }
    },
    "outputs": { "type": "array", "items": { "type": "string" } },
    "delta": { "type": "integer" },
    "mode": { "enum": ["part", "verse", "chapter"] },
    "text": { "type": "string" },
    "tone": { "enum": ["info", "important", "urgent"] },
    "author": { "type": "string" },
    "label": { "type": "string" },
    "durationMs": { "type": "integer", "minimum": 0 },
    "remainingMs": { "type": "integer", "minimum": 0 },
    "running": { "type": "boolean" },
    "endAt": { "type": "integer" },
    "queue": { "type": "array" },
    "cueId": { "type": "string" },
    "index": { "type": "integer" },
    "next": { "type": ["string", "null"] },
    "resource": { "type": "string" },
    "rev": { "type": "integer" },
    "code": { "type": "string" },
    "message": { "type": "string" }
  }
}
```

### 24.13.3 Fichier de traduction

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openpresenter.local/schema/i18n.schema.json",
  "title": "web/i18n/<lang>.json",
  "type": "object",
  "required": ["_meta", "ui"],
  "additionalProperties": false,
  "properties": {
    "_meta": {
      "type": "object",
      "required": ["lang", "version"],
      "additionalProperties": false,
      "properties": {
        "lang": { "$ref": "common.schema.json#/$defs/locale" },
        "version": { "type": "string" },
        "source": { "const": "docs/spec/25-annexe-textes.md" }
      }
    },
    "ui": {
      "type": "object",
      "propertyNames": { "pattern": "^[a-z]+\\.[a-z0-9_.]+$" },
      "additionalProperties": { "type": "string", "minLength": 1 }
    }
  }
}
```

**AN-24.11** — Le français est la **source** : toute clé absente d'une autre langue tombe
sur le français, jamais sur la clé (A-17g).

---

## 24.14 Migration et compatibilité des schémas

| Situation | Comportement |
|---|---|
| `formatVersion` inférieur | migration automatique après sauvegarde `backups/pre-migration-<date>.zip` ; le schéma cible est celui de la version courante |
| `formatVersion` supérieur | **aucune écriture** ; bandeau `TXT: Ce projet a été créé par une version plus récente d'OpenPresenter.` ; lecture seule |
| Champ inconnu dans un fichier | validation en erreur ; le fichier est isolé en `backups/invalides/`, l'application continue sans lui |
| Champ obligatoire absent | idem |
| `rev` absent sur un objet métier | traité comme `rev: 1` lors de la lecture, réécrit à la première sauvegarde |

**AN-24.12** — Une version de schéma n'est **jamais** modifiée en place : un changement de
structure incrémente `formatVersion` et fournit une migration.

---

## 24.15 Vecteurs de test

| Fichier | Contenu attendu |
|---|---|
| `tests/fixtures/project-ok.json` | projet minimal valide |
| `tests/fixtures/project-ko-port.json` | `port: 70000` → rejet |
| `tests/fixtures/scene-ok-group3.json` | groupes imbriqués sur 3 niveaux |
| `tests/fixtures/scene-ko-group4.json` | 4 niveaux → rejet |
| `tests/fixtures/scene-ko-bind.json` | `bind: "chorus"` (inexistant) → rejet |
| `tests/fixtures/song-ok.json` | 6 sections, 2 arrangements |
| `tests/fixtures/song-ko-orphan.json` | `order` citant `sec_absent` → rejet |
| `tests/fixtures/asset-ok-linked.json` | `linked: true` + `absolutePath` |
| `tests/fixtures/asset-ko-linked.json` | `absolutePath` sans `linked` → rejet |
| `tests/fixtures/ws-ok-show.json` | `show` complet |
| `tests/fixtures/ws-ko-no-ts.json` | `ts` absent → rejet |

**AN-24.13** — La CI exécute `npm run schema:check -- --fixtures` : chaque `-ok` doit
valider, chaque `-ko-*` doit échouer, et l'erreur doit citer le bon chemin JSON.
