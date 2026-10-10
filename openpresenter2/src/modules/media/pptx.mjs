// Browser-side OOXML (.pptx) reader ported into V2 without changing the V1 files.
// It intentionally handles the common slide shapes, text, images and layout placeholders.
const EMU_PER_INCH = 914400;
const PX_PER_INCH = 96;
function emuToPx(emu) { return (emu / EMU_PER_INCH) * PX_PER_INCH; }

function qChildren(el, tag) {
    if (!el) return [];
    return Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.tagName === tag);
}
function qChild(el, tag) { return qChildren(el, tag)[0] || null; }
function qAll(el, tag) { return el ? Array.from(el.getElementsByTagName(tag)) : []; }
function attr(el, name, fallback) {
    if (!el) return fallback;
    const v = el.getAttribute(name);
    return v === null || v === undefined ? fallback : v;
}
function parseXmlString(str) { return new DOMParser().parseFromString(str, 'application/xml'); }

function parseRels(xmlStr) {
    const map = {};
    if (!xmlStr) return map;
    const doc = parseXmlString(xmlStr);
    qAll(doc, 'Relationship').forEach(r => { map[attr(r, 'Id')] = { target: attr(r, 'Target'), type: attr(r, 'Type') }; });
    return map;
}

function resolvePath(basePath, relTarget) {
    if (relTarget.startsWith('/')) return relTarget.slice(1);
    const baseParts = basePath.split('/'); baseParts.pop();
    const relParts = relTarget.split('/');
    for (const part of relParts) {
        if (part === '.' || part === '') continue;
        else if (part === '..') baseParts.pop();
        else baseParts.push(part);
    }
    return baseParts.join('/');
}

function readXfrm(spPr) {
    const xfrm = qChild(spPr, 'a:xfrm');
    if (!xfrm) return null;
    const off = qChild(xfrm, 'a:off'), ext = qChild(xfrm, 'a:ext');
    if (!off || !ext) return null;
    return {
        x: parseFloat(attr(off, 'x', '0')), y: parseFloat(attr(off, 'y', '0')),
        w: parseFloat(attr(ext, 'cx', '0')), h: parseFloat(attr(ext, 'cy', '0')),
        rot: parseFloat(attr(xfrm, 'rot', '0')) / 60000
    };
}

function readGroupXfrm(grpSpPr) {
    const xfrm = qChild(grpSpPr, 'a:xfrm');
    if (!xfrm) return null;
    const off = qChild(xfrm, 'a:off'), ext = qChild(xfrm, 'a:ext');
    const chOff = qChild(xfrm, 'a:chOff'), chExt = qChild(xfrm, 'a:chExt');
    if (!off || !ext || !chOff || !chExt) return null;
    return {
        x: parseFloat(attr(off, 'x', '0')), y: parseFloat(attr(off, 'y', '0')),
        w: parseFloat(attr(ext, 'cx', '0')), h: parseFloat(attr(ext, 'cy', '0')),
        chX: parseFloat(attr(chOff, 'x', '0')), chY: parseFloat(attr(chOff, 'y', '0')),
        chW: parseFloat(attr(chExt, 'cx', '1')) || 1, chH: parseFloat(attr(chExt, 'cy', '1')) || 1
    };
}

function applyGroupTransform(group, rect) {
    if (!group || !rect) return rect;
    const scaleX = group.w / group.chW, scaleY = group.h / group.chH;
    return {
        x: group.x + (rect.x - group.chX) * scaleX, y: group.y + (rect.y - group.chY) * scaleY,
        w: rect.w * scaleX, h: rect.h * scaleY, rot: rect.rot || 0
    };
}

function readTextBody(txBody) {
    if (!txBody) return null;
    const paragraphs = qChildren(txBody, 'a:p');
    if (paragraphs.length === 0) return null;
    let firstSize = null, firstColor = null, firstBold = false, align = 'l';
    const lines = []; let hasAnyText = false;
    paragraphs.forEach(p => {
        const pPr = qChild(p, 'a:pPr');
        if (pPr) { const a = attr(pPr, 'algn', null); if (a) align = a; }
        const runs = qChildren(p, 'a:r');
        let lineText = '';
        runs.forEach(r => {
            const t = qChild(r, 'a:t');
            const text = t ? (t.textContent || '') : '';
            if (text) hasAnyText = true;
            lineText += text;
            if (firstSize === null) {
                const rPr = qChild(r, 'a:rPr');
                if (rPr) {
                    const sz = attr(rPr, 'sz', null);
                    if (sz) firstSize = parseFloat(sz) / 100;
                    if (attr(rPr, 'b', '0') === '1') firstBold = true;
                    const fill = qChild(rPr, 'a:solidFill');
                    const clr = fill ? qChild(fill, 'a:srgbClr') : null;
                    if (clr) firstColor = '#' + attr(clr, 'val', '000000');
                }
            }
        });
        lines.push(lineText);
    });
    if (!hasAnyText) return null;
    return {
        text: lines.join('\n'), fontSizePt: firstSize || 18, color: firstColor || '#000000',
        bold: firstBold, align: align === 'ctr' ? 'center' : (align === 'r' ? 'right' : 'left')
    };
}

function readSolidFillColor(spPr) {
    const fill = qChild(spPr, 'a:solidFill');
    if (!fill) return null;
    const clr = qChild(fill, 'a:srgbClr');
    return clr ? '#' + attr(clr, 'val', '000000') : null;
}

function findPlaceholderMatch(shapes, type, idx) {
    if (idx !== null) { const byIdx = shapes.find(s => s.phIdx === idx); if (byIdx) return byIdx; }
    if (type !== null) {
        const byType = shapes.find(s => s.phType === type);
        if (byType) return byType;
        const titleLike = ['title', 'ctrTitle'];
        if (titleLike.includes(type)) { const alt = shapes.find(s => titleLike.includes(s.phType)); if (alt) return alt; }
    }
    return shapes.find(s => s.phType && s.phType !== 'title' && s.phType !== 'ctrTitle') || null;
}

function extractRawPlaceholders(spTreeEl) {
    const out = [];
    qChildren(spTreeEl, 'p:sp').forEach(sp => {
        const nvPr = qChild(qChild(sp, 'p:nvSpPr'), 'p:nvPr');
        const ph = nvPr ? qChild(nvPr, 'p:ph') : null;
        if (!ph) return;
        out.push({ phType: attr(ph, 'type', null), phIdx: attr(ph, 'idx', null), xfrm: readXfrm(qChild(sp, 'p:spPr')) });
    });
    return out;
}

async function walkSpTree(spTreeEl, zip, slideRelsMap, slideDir, groupTransform, layoutPlaceholders, masterPlaceholders, out) {
    const children = Array.from(spTreeEl.childNodes).filter(n => n.nodeType === 1);
    for (const el of children) {
        if (el.tagName === 'p:sp') {
            const spPr = qChild(el, 'p:spPr');
            let xfrm = readXfrm(spPr);
            const nvPr = qChild(qChild(el, 'p:nvSpPr'), 'p:nvPr');
            const ph = nvPr ? qChild(nvPr, 'p:ph') : null;
            const phType = ph ? attr(ph, 'type', null) : null;
            const phIdx = ph ? attr(ph, 'idx', null) : null;
            if (!xfrm && ph) {
                const fromLayout = findPlaceholderMatch(layoutPlaceholders, phType, phIdx);
                if (fromLayout && fromLayout.xfrm) xfrm = fromLayout.xfrm;
                else { const fromMaster = findPlaceholderMatch(masterPlaceholders, phType, phIdx); if (fromMaster && fromMaster.xfrm) xfrm = fromMaster.xfrm; }
            }
            if (!xfrm) continue;
            const rect = groupTransform ? applyGroupTransform(groupTransform, xfrm) : xfrm;
            const textInfo = readTextBody(qChild(el, 'p:txBody'));
            const bg = readSolidFillColor(spPr);
            if (textInfo || bg) {
                out.push({
                    type: 'text', x: rect.x, y: rect.y, w: rect.w, h: rect.h, rot: rect.rot || 0,
                    text: textInfo ? textInfo.text : '', fontSizePt: textInfo ? textInfo.fontSizePt : 18,
                    color: textInfo ? textInfo.color : '#000000', bold: textInfo ? textInfo.bold : false,
                    align: textInfo ? textInfo.align : 'left', background: bg
                });
            }
        } else if (el.tagName === 'p:pic') {
            const xfrm = readXfrm(qChild(el, 'p:spPr'));
            if (!xfrm) continue;
            const rect = groupTransform ? applyGroupTransform(groupTransform, xfrm) : xfrm;
            const blipFill = qChild(el, 'p:blipFill');
            const blip = blipFill ? qChild(blipFill, 'a:blip') : null;
            const rEmbed = blip ? attr(blip, 'r:embed', null) : null;
            if (!rEmbed || !slideRelsMap[rEmbed]) continue;
            const mediaPath = resolvePath(slideDir + '/x', slideRelsMap[rEmbed].target);
            const zipEntry = zip.file(mediaPath);
            if (!zipEntry) continue;
            const b64 = await zipEntry.async('base64');
            const ext = (mediaPath.split('.').pop() || 'png').toLowerCase();
            const mime = ext === 'jpg' ? 'jpeg' : (ext === 'svg' ? 'svg+xml' : ext);
            out.push({ type: 'image', x: rect.x, y: rect.y, w: rect.w, h: rect.h, rot: rect.rot || 0, dataUrl: `data:image/${mime};base64,${b64}` });
        } else if (el.tagName === 'p:grpSp') {
            const gXfrm = readGroupXfrm(qChild(el, 'p:grpSpPr'));
            let composed;
            if (gXfrm) {
                if (groupTransform) {
                    const mapped = applyGroupTransform(groupTransform, { x: gXfrm.x, y: gXfrm.y, w: gXfrm.w, h: gXfrm.h });
                    composed = { x: mapped.x, y: mapped.y, w: mapped.w, h: mapped.h, chX: gXfrm.chX, chY: gXfrm.chY, chW: gXfrm.chW, chH: gXfrm.chH };
                } else composed = gXfrm;
            } else composed = groupTransform;
            await walkSpTree(el, zip, slideRelsMap, slideDir, composed, layoutPlaceholders, masterPlaceholders, out);
        }
    }
}

async function loadPlaceholdersForLayout(zip, layoutPath) {
    const xml = await zip.file(layoutPath).async('text');
    return extractRawPlaceholders(qAll(parseXmlString(xml), 'p:spTree')[0]);
}
async function loadMasterForLayout(zip, layoutPath) {
    const layoutDir = layoutPath.split('/').slice(0, -1).join('/');
    const layoutFile = layoutPath.split('/').pop();
    const relsEntry = zip.file(`${layoutDir}/_rels/${layoutFile}.rels`);
    if (!relsEntry) return null;
    const rels = parseRels(await relsEntry.async('text'));
    const masterRel = Object.values(rels).find(r => r.type && r.type.endsWith('/slideMaster'));
    return masterRel ? resolvePath(layoutPath, masterRel.target) : null;
}

export async function parsePptx(fileBlobOrBuffer, JSZip = globalThis.JSZip) {
    const zip = await JSZip.loadAsync(fileBlobOrBuffer);
    const presDoc = parseXmlString(await zip.file('ppt/presentation.xml').async('text'));
    const sldSz = qAll(presDoc, 'p:sldSz')[0];
    const slideWidthEMU = parseFloat(attr(sldSz, 'cx', '12192000'));
    const slideHeightEMU = parseFloat(attr(sldSz, 'cy', '6858000'));
    const presRels = parseRels(await zip.file('ppt/_rels/presentation.xml.rels').async('text'));
    const sldIds = qChildren(qAll(presDoc, 'p:sldIdLst')[0], 'p:sldId');
    const slidePaths = sldIds.map(sldId => {
        const rel = presRels[attr(sldId, 'r:id')];
        return rel ? resolvePath('ppt/presentation.xml', rel.target) : null;
    }).filter(Boolean);

    const layoutCache = {};
    const slides = [];
    for (const slidePath of slidePaths) {
        const slideDir = slidePath.split('/').slice(0, -1).join('/');
        const slideFile = slidePath.split('/').pop();
        const relsEntry = zip.file(`${slideDir}/_rels/${slideFile}.rels`);
        const slideRelsMap = relsEntry ? parseRels(await relsEntry.async('text')) : {};

        const layoutRel = Object.values(slideRelsMap).find(r => r.type && r.type.endsWith('/slideLayout'));
        let layoutPlaceholders = [], masterPlaceholders = [];
        if (layoutRel) {
            const layoutPath = resolvePath(slidePath, layoutRel.target);
            if (!layoutCache[layoutPath]) {
                const placeholders = await loadPlaceholdersForLayout(zip, layoutPath);
                const masterPath = await loadMasterForLayout(zip, layoutPath);
                const masterPlaceholdersLoaded = masterPath ? await loadPlaceholdersForLayout(zip, masterPath) : [];
                layoutCache[layoutPath] = { placeholders, masterPlaceholders: masterPlaceholdersLoaded };
            }
            layoutPlaceholders = layoutCache[layoutPath].placeholders;
            masterPlaceholders = layoutCache[layoutPath].masterPlaceholders;
        }

        const slideDoc = parseXmlString(await zip.file(slidePath).async('text'));
        const spTree = qAll(slideDoc, 'p:spTree')[0];

        let bg = null;
        const cSld = qAll(slideDoc, 'p:cSld')[0];
        const bgEl = cSld ? qChild(cSld, 'p:bg') : null;
        if (bgEl) { const bgPr = qChild(bgEl, 'p:bgPr'); if (bgPr) bg = readSolidFillColor(bgPr); }

        const shapes = [];
        await walkSpTree(spTree, zip, slideRelsMap, slideDir, null, layoutPlaceholders, masterPlaceholders, shapes);
        slides.push({ background: bg, shapes });
    }
    return { widthEMU: slideWidthEMU, heightEMU: slideHeightEMU, slides };
}
