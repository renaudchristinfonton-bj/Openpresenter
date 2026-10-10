import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { parsePptx } from '../src/modules/media/pptx.mjs';
import { pptxSlideToSvg } from '../src/modules/media/library.mjs';

test('PPTX reader preserves slide order, text formatting, positions, backgrounds, and embedded pictures', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
  globalThis.DOMParser = DOMParser;
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'DOMParser', previous);
    else delete globalThis.DOMParser;
  });

  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>`);
  zip.file('ppt/slides/slide1.xml', `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="112233"/></a:solidFill></p:bgPr></p:bg><p:spTree><p:sp><p:spPr><a:xfrm rot="5400000"><a:off x="914400" y="1828800"/><a:ext cx="4572000" cy="914400"/></a:xfrm></p:spPr><p:txBody><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="3200" b="1"><a:solidFill><a:srgbClr val="ABCDEF"/></a:solidFill></a:rPr><a:t>Welcome</a:t></a:r></a:p><a:p><a:r><a:t>Sunday</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:blipFill><a:blip r:embed="rId3"/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="457200"/></a:xfrm></p:spPr></p:pic></p:spTree></p:cSld></p:sld>`);
  zip.file('ppt/slides/_rels/slide1.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`);
  zip.file('ppt/media/image1.png', Buffer.from('89504e470d0a1a0a', 'hex'));
  zip.file('ppt/slides/slide2.xml', `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="500000"/></a:xfrm><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:spPr><p:txBody><a:p><a:r><a:t>Second slide</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);

  const presentation = await parsePptx(await zip.generateAsync({ type: 'arraybuffer' }), JSZip);
  assert.equal(presentation.widthEMU, 9144000);
  assert.equal(presentation.heightEMU, 5143500);
  assert.equal(presentation.slides.length, 2);
  assert.equal(presentation.slides[0].background, '#112233');
  assert.deepEqual(presentation.slides[0].shapes.map((shape) => shape.type), ['text', 'image']);
  assert.equal(presentation.slides[0].shapes[0].text, 'Welcome\nSunday');
  assert.equal(presentation.slides[0].shapes[0].fontSizePt, 32);
  assert.equal(presentation.slides[0].shapes[0].bold, true);
  assert.equal(presentation.slides[0].shapes[0].align, 'center');
  assert.equal(presentation.slides[0].shapes[0].x, 914400);
  assert.match(presentation.slides[0].shapes[1].dataUrl, /^data:image\/png;base64,/);
  assert.match(decodeURIComponent(pptxSlideToSvg(presentation, presentation.slides[0])), /Welcome/);
  assert.equal(presentation.slides[1].shapes[0].text, 'Second slide');
});
