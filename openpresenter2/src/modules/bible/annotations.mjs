const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'INS', 'BR', 'DIV', 'P', 'SPAN']);

function safeColor(value) {
  const color = String(value || '').trim();
  if (/^#[\da-f]{3,4}(?:[\da-f]{3,4})?$/i.test(color)) return color;
  if (/^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(color)) return color;
  return '';
}

function sanitizeChildren(parent) {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType !== 1) continue;
    const tag = child.tagName.toUpperCase();
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH'].includes(tag)) { child.remove(); continue; }
    if (tag === 'FONT') {
      const span = child.ownerDocument.createElement('span');
      const color = safeColor(child.getAttribute('color'));
      if (color) span.style.color = color;
      while (child.firstChild) span.appendChild(child.firstChild);
      child.replaceWith(span);
      sanitizeChildren(span);
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      sanitizeChildren(child);
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }
    const style = tag === 'SPAN' ? child.getAttribute('style') || '' : '';
    for (const attribute of Array.from(child.attributes)) child.removeAttribute(attribute.name);
    if (tag === 'SPAN' && style) {
      const declarations = [];
      for (const declaration of style.split(';')) {
        const separator = declaration.indexOf(':');
        if (separator < 0) continue;
        const property = declaration.slice(0, separator).trim().toLowerCase();
        const value = safeColor(declaration.slice(separator + 1));
        if (value && ['color', 'background-color'].includes(property)) declarations.push(`${property}: ${value}`);
      }
      if (declarations.length) child.setAttribute('style', declarations.join('; '));
    }
    sanitizeChildren(child);
  }
}

export function sanitizeAnnotationHtml(value, documentRef = globalThis.document) {
  const html = String(value ?? '');
  if (!documentRef?.createElement) {
    return html.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }
  const template = documentRef.createElement('template');
  template.innerHTML = html;
  sanitizeChildren(template.content);
  return template.innerHTML;
}

export function annotationPlainText(html, documentRef = globalThis.document) {
  if (!documentRef?.createElement) return String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const template = documentRef.createElement('template');
  template.innerHTML = String(html ?? '');
  return String(template.content.textContent || '').replace(/\u00a0/g, ' ').trim();
}

export function hasAnnotationFormatting(html, documentRef = globalThis.document) {
  if (!documentRef?.createElement) return /<(?:b|strong|i|em|u|s|del|ins)\b|<span\b[^>]*\bstyle\s*=/i.test(String(html || ''));
  const template = documentRef.createElement('template');
  template.innerHTML = String(html ?? '');
  return !!template.content.querySelector('b,strong,i,em,u,s,del,ins,span[style]');
}

function cloneTextSlice(node, start, end, offset, documentRef) {
  const nodeStart = offset.value;
  const nodeEnd = nodeStart + node.data.length;
  offset.value = nodeEnd;
  const from = Math.max(start, nodeStart);
  const to = Math.min(end, nodeEnd);
  return from < to ? documentRef.createTextNode(node.data.slice(from - nodeStart, to - nodeStart)) : null;
}

function cloneNodeSlice(node, start, end, offset, documentRef) {
  if (node.nodeType === 3) return cloneTextSlice(node, start, end, offset, documentRef);
  if (node.nodeType !== 1) return null;
  const clone = node.cloneNode(false);
  for (const child of Array.from(node.childNodes)) {
    const sliced = cloneNodeSlice(child, start, end, offset, documentRef);
    if (sliced) clone.appendChild(sliced);
  }
  return clone.childNodes.length ? clone : null;
}

export function splitAnnotationHtml(html, sourceText, parts, documentRef = globalThis.document) {
  if (!documentRef?.createElement || !Array.isArray(parts) || !parts.length) return parts || [];
  const template = documentRef.createElement('template');
  template.innerHTML = sanitizeAnnotationHtml(html, documentRef);
  const source = String(template.content.textContent || '');
  if (source !== String(sourceText ?? '')) return parts.map((part) => sanitizeAnnotationHtml(part, documentRef));
  let cursor = 0;
  return parts.map((part) => {
    const segment = String(part ?? '');
    const start = source.indexOf(segment, cursor);
    if (!segment || start < 0) return sanitizeAnnotationHtml(segment, documentRef);
    const end = start + segment.length;
    const offset = { value: 0 };
    const fragment = documentRef.createDocumentFragment();
    for (const child of Array.from(template.content.childNodes)) {
      const sliced = cloneNodeSlice(child, start, end, offset, documentRef);
      if (sliced) fragment.appendChild(sliced);
    }
    const output = documentRef.createElement('template'); output.content.appendChild(fragment);
    cursor = end;
    return output.innerHTML;
  });
}
