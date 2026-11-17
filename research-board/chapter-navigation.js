'use strict';

const LINK = '\ufffc';
const LEFT = /^[<«‹〈《≪←]+\s*/u;
const RIGHT = /\s*[>»›〉》≫→]+$/u;
const identity = text => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Match a navigation block's structure, never the destination's SCP number.
// A genuine reference to the preceding/following SCP elsewhere must survive.
function isChapterNavigation(text, source, hasCurrentLink = false) {
  text = text.normalize('NFKC').replace(/\*\*|__|\/\//g, '').replace(/\s+/g, ' ').trim();
  const count = [...text].filter(c => c === LINK).length;
  if (count < 2 || count > 5) return false;
  const arrows = LEFT.test(text) && RIGHT.test(text);
  const inner = arrows ? text.replace(LEFT, '').replace(RIGHT, '').trim() : text;
  const parts = inner.split('|').map(s => s.trim());
  const triplet = parts.length === 3 && parts[0] === LINK && parts[2] === LINK &&
    parts[1].length > 0 && parts[1].length <= 160;
  if (arrows) {
    return triplet || /^[\s\ufffc|/,:;·•\-–—]*$/u.test(inner);
  }
  return triplet && (parts[1] === LINK ? hasCurrentLink :
    identity(parts[1]) === identity(source.slug) ||
    !!source.title && identity(parts[1]) === identity(source.title));
}

function removeHtmlNavigation(root, source, normalizePage) {
  for (const a of [...root.querySelectorAll('a[href]')]) {
    if (!root.contains(a)) continue;
    if (a.matches('[rel~="prev"], [rel~="next"]')) {
      a.remove();
      continue;
    }
    for (let block = a.parentElement; block && block !== root; block = block.parentElement) {
      if (!block.matches('p, div, section, footer, center, td, tr, li')) continue;
      const anchors = [...block.querySelectorAll('a[href]')];
      if (anchors.length > 5) break;
      if (anchors.length < 2) continue;
      const hasCurrent = anchors.some(link => normalizePage(link.getAttribute('href'), source.url)?.id === source.id);
      const copy = block.cloneNode(true);
      for (const link of copy.querySelectorAll('a[href]')) link.replaceWith(LINK);
      if (isChapterNavigation(copy.textContent, source, hasCurrent)) {
        block.remove();
        break;
      }
    }
  }
}

function removeFtmlNavigation(body, source, normalizePage) {
  function navigation(text) {
    let hasCurrent = false;
    const replace = (_, href) => {
      if (normalizePage(href.trim().replace(/^\*/, ''), source.url)?.id === source.id) hasCurrent = true;
      return LINK;
    };
    text = text.replace(/\[\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\]/g, replace)
      .replace(/(?<!\[)\[(https?:\/\/[^\s\]]+)(?:\s+[^\]]*)?\](?!\])/g, replace)
      .replace(/\[\[\/?(?:(?:div|span|section|size)\b[^\]]*|[=<>])\]\]/g, '')
      .replace(/^[ \t]*=[ \t]+/gm, '');
    return isChapterNavigation(text, source, hasCurrent);
  }
  body = body.replace(/\[\[=\]\]([\s\S]*?)\[\[\/=\]\]/g,
    (block, content) => navigation(content) ? '' : block);
  body = body.split(/(\n\s*\n)/).map(block => navigation(block) ? '' : block).join('');
  return body.split('\n').map(line => navigation(line) ? '' : line).join('\n');
}

module.exports = { removeHtmlNavigation, removeFtmlNavigation };
