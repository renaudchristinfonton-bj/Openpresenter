import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { annotationPlainText, hasAnnotationFormatting, sanitizeAnnotationHtml, splitAnnotationHtml } from '../src/modules/bible/annotations.mjs';

test('rich Bible annotations retain allowed formatting while stripping scripts, links, and unsafe styles', () => {
  const window = new Window();
  const document = window.document;
  const html = '<strong onclick="alert(1)">Espérance</strong><a href="javascript:alert(2)"> vivante</a><script>alert(3)</script><img src=x onerror="alert(4)"><span style="color:#f5b942;background-color:rgb(255, 240, 120);position:fixed;background-image:url(javascript:alert(5))"> !</span>';
  const safe = sanitizeAnnotationHtml(html, document);
  assert.match(safe, /<strong>Espérance<\/strong>/);
  assert.match(safe, /<span style="color: #f5b942; background-color: rgb\(255, 240, 120\)"> !<\/span>/);
  assert.doesNotMatch(safe, /script|onclick|onerror|javascript:|position:|background-image|<img|href=/i);
  assert.equal(annotationPlainText(safe, document), 'Espérance vivante !');
  assert.equal(hasAnnotationFormatting(safe, document), true);
  window.happyDOM.abort();
});

test('formatted annotations preserve their markup across automatic verse parts', () => {
  const window = new Window();
  const document = window.document;
  const source = 'Car Dieu a tant aimé le monde qu’il a donné son Fils.';
  const html = 'Car <strong>Dieu a tant aimé</strong> le monde qu’il a donné son <span style="color:#f5b942">Fils</span>.';
  const parts = ['Car Dieu a tant aimé', 'le monde qu’il a donné son Fils.'];
  const split = splitAnnotationHtml(html, source, parts, document);
  assert.equal(annotationPlainText(split[0], document), parts[0]);
  assert.equal(annotationPlainText(split[1], document), parts[1]);
  assert.match(split[0], /<strong>Dieu a tant aimé<\/strong>/);
  assert.match(split[1], /<span style="color: #f5b942">Fils<\/span>/);
  window.happyDOM.abort();
});

test('annotation sanitizer converts legacy font colors and escapes input without a DOM', () => {
  const window = new Window();
  const safe = sanitizeAnnotationHtml('<font color="#e0a020" size="7">Lumière</font>', window.document);
  assert.match(safe, /<span style="color: #e0a020;?">Lumière<\/span>/);
  assert.equal(sanitizeAnnotationHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  window.happyDOM.abort();
});
