import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { parseSongFile } from '../src/modules/songs/parser.mjs';

globalThis.DOMParser = DOMParser;

test('ChordPro parser keeps song metadata, sections, readable lyrics, and chord positions', () => {
  const song = parseSongFile(`{title: Amazing Grace}\n{artist: John Newton}\n{key: G}\n\n[Verse 1]\n[G]Amazing [D]grace, how [Em]sweet the sound\n\n[Chorus]\n[C]I once was [G]lost`, 'amazing-grace.pro');
  assert.equal(song.title, 'Amazing Grace');
  assert.equal(song.artist, 'John Newton');
  assert.equal(song.sections.length, 2);
  assert.equal(song.sections[0].name, 'Couplet 1');
  assert.equal(song.sections[0].lines[0], 'Amazing grace, how sweet the sound');
  assert.deepEqual(song.sections[0].chordLines[0].map((item) => item.chord), ['G', 'D', 'Em']);
  assert.equal(song.sections[1].name, 'Refrain');
});

test('OpenSong XML parser extracts title, author, and marked lyric sections', () => {
  const song = parseSongFile(`<song><title>Louange</title><author>Équipe</author><lyrics><![CDATA[[V1]\nChantez avec joie\n[C]\nLe Seigneur est roi]]></lyrics></song>`, 'louange.xml');
  assert.equal(song.title, 'Louange');
  assert.equal(song.artist, 'Équipe');
  assert.equal(song.sections.length, 2);
  assert.equal(song.sections[1].name, 'Refrain');
});

test('plain-text importer treats clear headings as sections and reports empty lyrics', () => {
  const song = parseSongFile('Couplet 1\nLa lumière est là\n\nRefrain\nChantons ensemble', 'chant.txt');
  assert.equal(song.sections.length, 2);
  assert.equal(song.sections[0].name, 'Couplet 1');
  assert.equal(song.sections[1].name, 'Refrain');
  assert.throws(() => parseSongFile('{title: Empty}\n{artist: Test}', 'empty.pro'), /Aucune parole/);
});
