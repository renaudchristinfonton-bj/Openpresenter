import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { parseBibleXML } from '../src/modules/bible/xml.mjs';

globalThis.DOMParser = DOMParser;

test('Bible XML parser reads the standard book/chapter/verse format', () => {
  const bible = parseBibleXML(`<?xml version="1.0"?><bible translation="LSG">
    <testament><book number="43" name="Jean"><chapter number="3"><verse number="16">Car Dieu a tant aimé le monde.</verse></chapter></book></testament>
  </bible>`);
  assert.equal(bible.name, 'LSG');
  assert.equal(bible.books[0].name, 'Jean');
  assert.equal(bible.books[0].chapters[0].num, 3);
  assert.equal(bible.books[0].chapters[0].verses[0].text, 'Car Dieu a tant aimé le monde.');
});

test('Bible XML parser reads Zefania BIBLEBOOK/CHAPTER/VERS tags case-insensitively', () => {
  const bible = parseBibleXML(`<XMLBIBLE biblename="Demo Zefania"><BIBLEBOOK bnumber="43" bname="Jean">
    <CHAPTER cnumber="3"><VERS vnumber="16">Car <STYLE fs="italic">Dieu</STYLE> a tant aimé le monde.</VERS></CHAPTER>
  </BIBLEBOOK></XMLBIBLE>`);
  assert.equal(bible.name, 'Demo Zefania');
  assert.equal(bible.books[0].name, 'Jean');
  assert.equal(bible.books[0].chapters[0].verses[0].num, 16);
  assert.equal(bible.books[0].chapters[0].verses[0].text, 'Car Dieu a tant aimé le monde.');
});

test('Bible XML parser reports files with no recognizable books', () => {
  assert.throws(() => parseBibleXML('<root><entry>no bible content</entry></root>'), /Aucun élément Livre/);
});
