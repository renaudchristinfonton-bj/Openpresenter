// ============================================================
// js/qrcode.js — Générateur de QR code autonome (aucun CDN requis)
// ============================================================
// L'ancienne version dépendait du CDN jsdelivr (qrcode.min.js), qui ne se charge
// pas hors-ligne. Ce générateur est 100% autonome, en pur JS, pour que le code QR
// du Command Center s'affiche toujours, même sans accès internet.
//
// Implémente : mode octet, niveau de correction d'erreur L, versions 1 à 6
// (suffisant pour des URL de type http://ip:port/), rendu sur <canvas>.
(function () {
    'use strict';

    // ---- Niveau de correction L (indicateur 2 bits = 01) ----
    var ECC_L = 1;

    // Codewords de correction par bloc (niveau L), versions 1..6
    // [ecPerBlock, [nbBlock1, data1, nbBlock2, data2]...]
    var RS_BLOCKS = {
        1: [7, [1, 19]],
        2: [10, [1, 34]],
        3: [15, [1, 55]],
        4: [20, [1, 80]],
        5: [26, [1, 108]],
        6: [18, [2, 68]]
    };
    var ALIGNMENT = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

    // Nombre total de codewords de données (niveau L)
    function dataCodewords(version) {
        var b = RS_BLOCKS[version], total = 0;
        for (var i = 0; i < b[1].length; i += 2) total += b[1][i] * b[1][i + 1];
        return total;
    }
    // Capacité en octets (niveau L) ≈ données - 2 octets d'en-tête
    function chooseVersion(nbytes) {
        for (var v = 1; v <= 6; v++) if (dataCodewords(v) >= nbytes + 3) return v;
        return null;
    }

    // ---- Corps de Galois GF(256), poly 0x11D ----
    var EXP = new Array(512), LOG = new Array(256);
    (function () {
        var x = 1;
        for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
        for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
    })();
    function gmul(a, b) { if (a === 0 || b === 0) return 0; return EXP[(LOG[a] + LOG[b]) % 255]; }

    function generatorPoly(n) {
        var poly = [1];
        for (var i = 0; i < n; i++) {
            var next = new Array(poly.length + 1).fill(0);
            for (var j = 0; j < poly.length; j++) {
                next[j] ^= gmul(poly[j], EXP[i]);
                next[j + 1] ^= poly[j];
            }
            poly = next;
        }
        return poly;
    }

    function rsEncode(data, ecCount) {
        var gen = generatorPoly(ecCount);
        var res = data.slice().concat(new Array(ecCount).fill(0));
        for (var i = 0; i < data.length; i++) {
            var coef = res[i];
            if (coef === 0) continue;
            for (var j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], coef);
        }
        return res.slice(data.length);
    }

    // ---- Construction des données (mode octet) ----
    function toBin(n, len) { var s = n.toString(2); while (s.length < len) s = '0' + s; return s; }

    function buildData(version, textBytes) {
        var totalData = dataCodewords(version);
        var bits = '0100' + toBin(textBytes.length, 8);
        for (var i = 0; i < textBytes.length; i++) bits += toBin(textBytes[i], 8);
        bits += '0000'; // terminator
        var codewords = [];
        for (i = 0; i + 8 <= bits.length; i += 8) codewords.push(parseInt(bits.substr(i, 8), 2));
        var pad = 0xEC;
        while (codewords.length < totalData) { codewords.push(pad); pad = (pad === 0xEC ? 0x11 : 0xEC); }
        return codewords.slice(0, totalData);
    }

    function interleave(data, ecCount, blockSpec) {
        var blocks = [], idx = 0;
        for (var b = 0; b < blockSpec.length; b += 2) {
            var nBlk = blockSpec[b], len = blockSpec[b + 1];
            for (var k = 0; k < nBlk; k++) blocks.push({ data: data.slice(idx, idx + len), ec: rsEncode(data.slice(idx, idx + len), ecCount) });
            idx += len * nBlk;
        }
        var maxData = Math.max.apply(null, blocks.map(function (x) { return x.data.length; }));
        var result = [];
        for (var d = 0; d < maxData; d++) blocks.forEach(function (bl) { if (d < bl.data.length) result.push(bl.data[d]); });
        for (var e = 0; e < ecCount; e++) blocks.forEach(function (bl) { result.push(bl.ec[e]); });
        return result;
    }

    // ---- Construction de la matrice + placement des motifs fonctionnels ----
    // Retourne { modules, reserved } où reserved[i][j] = true si cellule fonctionnelle.
    function buildModules(version) {
        var size = version * 4 + 17;
        var mods = [], reserved = [];
        for (var i = 0; i < size; i++) { mods.push(new Array(size).fill(false)); reserved.push(new Array(size).fill(false)); }
        function set(r, c, dark) { if (r >= 0 && r < size && c >= 0 && c < size) { mods[r][c] = dark; reserved[r][c] = true; } }

        function placeFinder(r, c) {
            for (var dr = -1; dr <= 7; dr++) {
                for (var dc = -1; dc <= 7; dc++) {
                    var rr = r + dr, cc = c + dc;
                    if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
                    var inside = (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6);
                    var dark = inside && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
                    set(rr, cc, dark);
                }
            }
        }
        placeFinder(0, 0); placeFinder(0, size - 7); placeFinder(size - 7, 0);

        // Timing
        for (i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }

        // Alignment
        var align = ALIGNMENT[version];
        if (align.length > 1) {
            for (var a1 = 0; a1 < align.length; a1++) {
                for (var a2 = 0; a2 < align.length; a2++) {
                    var cr = align[a1], cc = align[a2];
                    if ((cr === 6 && cc === 6) || (cr === 6 && cc === size - 7) || (cr === size - 7 && cc === 6)) continue;
                    for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
                        set(cr + dr, cc + dc, Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
                    }
                }
            }
        }

        // Dark module
        set(size - 8, 8, true);
        return { mods: mods, reserved: reserved };
    }

    // Placement des bits de données (zigzag), en sautant les cellules réservées.
    function placeData(mods, reserved, allCodewords) {
        var size = mods.length;
        var bitIndex = 0, bitLength = allCodewords.length * 8;
        function nextBit() {
            if (bitIndex >= bitLength) return false;
            var byte = allCodewords[bitIndex >> 3];
            var bit = (byte >> (7 - (bitIndex & 7))) & 1;
            bitIndex++;
            return bit === 1;
        }
        var col = size - 1, upward = true;
        while (col > 0) {
            if (col === 6) col--;
            for (var rowStep = 0; rowStep < size; rowStep++) {
                var row = upward ? (size - 1 - rowStep) : rowStep;
                for (var cc2 = 0; cc2 < 2; cc2++) {
                    var realCol = col - cc2;
                    if (reserved[row][realCol]) continue;
                    mods[row][realCol] = nextBit();
                }
            }
            col -= 2; upward = !upward;
        }
    }

    // ---- Masques (ne s'appliquent qu'aux cellules de données) ----
    function maskRules(mask, r, c) {
        switch (mask) {
            case 0: return (r + c) % 2 === 0;
            case 1: return r % 2 === 0;
            case 2: return c % 3 === 0;
            case 3: return (r + c) % 3 === 0;
            case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
            case 5: return ((r * c) % 2 + (r * c) % 3) === 0;
            case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
            case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
        }
        return false;
    }

    // ---- Format info ----
    function formatBits(ecc, mask) {
        var data = (ecc << 3) | mask;
        var rem = data;
        for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        return ((data << 10) | rem) ^ 0x5412;
    }

    function placeFormat(mods, reserved, mask) {
        var bits = formatBits(ECC_L, mask);
        var seq = [];
        for (var i = 0; i < 15; i++) seq.push((bits >> (14 - i)) & 1);
        var size = mods.length;
        // Copie 1 : autour du finder haut-gauche
        for (var a = 0; a < 6; a++) { mods[8][a] = seq[a] === 1; reserved[8][a] = true; }
        mods[8][7] = seq[6] === 1; reserved[8][7] = true;
        mods[8][8] = seq[7] === 1; reserved[8][8] = true;
        mods[7][8] = seq[8] === 1; reserved[7][8] = true;
        for (var b = 5; b >= 0; b--) { mods[b][8] = seq[14 - (5 - b)] === 1; reserved[b][8] = true; }
        // Copie 2 : verticale à droite + bas à gauche
        var idx = 0;
        for (var v = 0; v < 8; v++) { mods[8][size - 1 - v] = seq[idx] === 1; reserved[8][size - 1 - v] = true; idx++; }
        for (var h = 0; h < 7; h++) { mods[size - 1 - h][8] = seq[idx] === 1; reserved[size - 1 - h][8] = true; idx++; }
    }

    // ---- Pénalité ----
    function penalty(mods) {
        var size = mods.length, score = 0;
        function runScore(axis) {
            var s = 0;
            for (var i = 0; i < size; i++) {
                var run = 1;
                for (var j = 1; j < size; j++) {
                    var cur = axis === 0 ? mods[i][j] : mods[j][i];
                    var prev = axis === 0 ? mods[i][j - 1] : mods[j - 1][i];
                    if (cur === prev) run++;
                    else { if (run >= 5) s += 3 + run; run = 1; }
                }
                if (run >= 5) s += 3 + run;
            }
            return s;
        }
        score += runScore(0) + runScore(1);
        for (var r = 0; r < size - 1; r++) for (var c = 0; c < size - 1; c++) {
            var v = mods[r][c];
            if (v === mods[r][c + 1] && v === mods[r + 1][c] && v === mods[r + 1][c + 1]) score += 3;
        }
        // patterns 1:1:3:1:1
        for (var r2 = 0; r2 < size; r2++) for (var c2 = 0; c2 < size - 6; c2++) {
            if (mods[r2][c2] && !mods[r2][c2 + 1] && mods[r2][c2 + 2] && mods[r2][c2 + 3] && mods[r2][c2 + 4] && !mods[r2][c2 + 5] && mods[r2][c2 + 6]) score += 40;
            if (mods[c2][r2] && !mods[c2 + 1][r2] && mods[c2 + 2][r2] && mods[c2 + 3][r2] && mods[c2 + 4][r2] && !mods[c2 + 5][r2] && mods[c2 + 6][r2]) score += 40;
        }
        var dark = 0;
        for (var rr = 0; rr < size; rr++) for (var c3 = 0; c3 < size; c3++) if (mods[rr][c3]) dark++;
        var k = Math.abs(Math.round((dark / (size * size)) * 100) - 50);
        score += Math.floor(k / 5) * 10;
        return score;
    }

    // ---- API principale ----
    function makeQR(text) {
        var bytes = new TextEncoder().encode(text);
        var version = chooseVersion(bytes.length);
        if (!version) return null;
        var data = buildData(version, bytes);
        var spec = RS_BLOCKS[version];
        var codewords = interleave(data, spec[0], spec[1]);

        var base = buildModules(version);
        var best = null, bestScore = Infinity;
        for (var mask = 0; mask < 8; mask++) {
            var mods = base.mods.map(function (row) { return row.slice(); });
            var reserved = base.reserved.map(function (row) { return row.slice(); });
            placeData(mods, reserved, codewords);
            // applique le masque aux cellules de données uniquement
            var size = mods.length;
            for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
                if (!reserved[r][c] && maskRules(mask, r, c)) mods[r][c] = !mods[r][c];
            }
            placeFormat(mods, reserved, mask);
            var sc = penalty(mods);
            if (sc < bestScore) { bestScore = sc; best = mods; }
        }
        return best;
    }

    function toCanvas(canvas, text, size) {
        var matrix = makeQR(text);
        if (!matrix) return false;
        var n = matrix.length;
        var scale = Math.max(1, Math.floor((size || 240) / (n + 4)));
        var total = scale * (n + 4);
        canvas.width = total; canvas.height = total;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, total, total);
        ctx.fillStyle = '#0f172a';
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
            if (matrix[r][c]) ctx.fillRect((c + 2) * scale, (r + 2) * scale, scale, scale);
        }
        return true;
    }

    window.OpenQR = { toCanvas: toCanvas, makeQR: makeQR };
})();
