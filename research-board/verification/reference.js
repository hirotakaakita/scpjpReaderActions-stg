'use strict';
// Independently examines live publisher content. NEVER import extract.js / catalog.js.
const {JSDOM, VirtualConsole} = require('jsdom');

const HOST_ALIASES = new Map([
  ['www.scpfoundation.net','scpfoundation.net'],
  ['www.scp-wiki.net','scp-wiki.wikidot.com'],
  ['scp-wiki.net','scp-wiki.wikidot.com'],
  ['scpwiki.com','scp-wiki.wikidot.com'],
  ['www.scpwiki.com','scp-wiki.wikidot.com']
]);
const AUX_SELECTORS = [
  'nav', '[role="navigation"]', '#toc', '.toc', '.page-tags',
  '.page-rate-widget-box', '.creditRate', '.credit-rate', '.credit',
  '.credit-box', '.licensebox', '.license-box', '.license-area',
  '.authorbox', '#u-author_block', '#u-author-block', '#u-credit-view',
  '.footer-wikiwalk-nav', '.wikiwalk-nav', '.page-navigation', '.scp-footer',
  '.interwiki-box', '#interwiki', '.translation-source',
  '.credit-back', '.acs-hybrid-text-bar', '.classification-decoration',
  '.error-block', '.collapsible-block-link', 'script', 'style',
  '.licensebox-credits'
].join(',');

function normalizedUrl(raw, from) {
  try {
    const u = new URL(raw, from);
    if (!['http:','https:'].includes(u.protocol) || u.username || u.password || u.port) return null;
    if ([...u.searchParams.keys()].some(k => !['utm_source','utm_medium','utm_campaign'].includes(k))) return null;
    const host = HOST_ALIASES.get(u.hostname.toLowerCase()) || u.hostname.toLowerCase();
    const slug = decodeURIComponent(u.pathname).replace(/^\/+|\/+$/g,'').toLowerCase();
    if (!/^[\p{L}\p{N}][\p{L}\p{N}_:-]*$/u.test(slug)) return null;
    if (/^(?:system|admin|forum|user|component|theme|nav|fragment|css|template):/.test(slug)) return null;
    return 'https://' + host + '/' + encodeURI(slug);
  } catch (_) { return null; }
}
function hostOf(url) {
  try { return new URL(url).hostname; } catch (_) { return ''; }
}
function selectorFor(anchor) {
  const nodes = [];
  let node = anchor;
  for (let i=0; node && i<7 && node.nodeType===1; i++,node=node.parentElement) {
    let part = node.localName;
    if (node.id) { part += '#' + node.id.replace(/[^\w-]/g,'_'); nodes.unshift(part); break; }
    const siblings = node.parentElement ? [...node.parentElement.children].filter(n=>n.localName===node.localName) : [];
    if (siblings.length>1) part += ':nth-of-type(' + (siblings.indexOf(node)+1) + ')';
    nodes.unshift(part);
  }
  return nodes.join(' > ');
}
function evaluate(candidate, source, workByUrl, supportedHosts) {
  const targetUrl = normalizedUrl(candidate.href, source);
  if (!targetUrl) return {...candidate, reason:'unresolvable_url', targetUrl:null, targetWork:null};
  const work = workByUrl.get(targetUrl) || null;
  if (!work) {
    const why = supportedHosts.has(hostOf(targetUrl)) ? 'outside_catalog' : 'external_site';
    return {...candidate, reason:why, targetUrl, targetWork:null};
  }
  if (work === workByUrl.get(normalizedUrl(source,source))) {
    return {...candidate, reason:'same_work', targetUrl, targetWork:work};
  }
  return {...candidate, reason:'reference', targetUrl, targetWork:work};
}
function resultFromRaw(raw, source, workByUrl, supportedHosts, warnings) {
  const all = raw.map(c=>c.skip ? {...c,reason:c.skip,targetUrl:null,targetWork:null} : evaluate(c,source,workByUrl,supportedHosts));
  const links = new Map(), counts = {};
  for (const c of all) {
    counts[c.reason] = (counts[c.reason]||0)+1;
    if (c.reason!=='reference') continue;
    if (!links.has(c.targetWork)) links.set(c.targetWork,[]);
    links.get(c.targetWork).push({href:c.href,quote:c.quote,selector:c.selector,sourceElement:c.sourceElement});
  }
  return {links,all,counts,warnings};
}
function fromHtml(html,source,workByUrl,supportedHosts) {
  const doc = new JSDOM(html,{url:source,virtualConsole:new VirtualConsole()});
  try {
    const root = doc.window.document.querySelector('#page-content');
    if (!root) throw new Error('missing_article_body');
    const title = (doc.window.document.querySelector('#page-title')?.textContent||doc.window.document.title||'').trim();
    if (/^(?:page not found|page does not exist|access denied|security check)$/i.test(title)) throw new Error('not_article');
    const raw = [];
    for (const a of root.querySelectorAll('a[href]')) {
      const href = (a.getAttribute('href')||'').trim();
      let skip = null;
      if (!href || href.startsWith('#')) skip='fragment_or_empty';
      else if (a.classList.contains('newpage')) skip='missing_page_link';
      else if (a.matches('[rel~="alternate"],[data-translation-source]')) skip='translation_metadata';
      else if (a.closest(AUX_SELECTORS) || [...a.parentElement?.classList||[]].some(c=>/^(licensebox|creditRate)/i.test(c))) skip='auxiliary_content';
      raw.push({
        href,quote:(a.textContent||'').replace(/\s+/g,' ').trim().slice(0,180),
        selector:selectorFor(a),sourceElement:a.outerHTML.slice(0,450),skip
      });
    }
    const warnings = [];
    if (root.querySelector('iframe')) warnings.push('iframe_not_expanded');
    if (root.querySelector('script')) warnings.push('dynamic_script_content');
    return resultFromRaw(raw,source,workByUrl,supportedHosts,warnings);
  } finally { doc.window.close(); }
}
function fromFtml(sourceText,source,workByUrl,supportedHosts) {
  if (typeof sourceText!=='string') throw new Error('missing_ftml_source');
  const raw=[],stack=[],warnings=[];
  if (/\[\[include\b/i.test(sourceText)) warnings.push('ftml_includes_not_expanded');
  if (/\[\[module\b/i.test(sourceText)) warnings.push('ftml_modules_not_expanded');
  // Independent token scanner; ignores comments and literal code/html blocks.
  const pattern=/\[\[!--[\s\S]*?--\]\]|\[\[(?:code|html)\b[^\]]*\]\][\s\S]*?\[\[\/(?:code|html)\]\]|\[\[\/?(?:div|span|section)\b[^\]]*\]\]|\[\[\[[\s\S]*?\]\]\]|\[https?:\/\/[^\]\r\n]+\]/gi;
  for (const match of sourceText.matchAll(pattern)) {
    const token=match[0],container=/^\[\[(\/?)(div|span|section)\b([\s\S]*?)\]\]$/i.exec(token);
    if (container) {
      const tag=container[2].toLowerCase();
      if (container[1]) {
        const at=stack.map(x=>x.tag).lastIndexOf(tag);
        if (at>=0) stack.splice(at);
      } else {
        const text=container[3].toLowerCase();
        const classes=/(?:^|\s)class\s*=\s*["']?([^"'\]]+)/i.exec(text)?.[1]?.split(/\s+/)||[];
        const drop=classes.some(c=>/^(?:credit|creditrate|credit-box|license|licensebox|interwiki|toc|page-navigation|wikiwalk-nav|footer-wikiwalk-nav|scp-footer|authorbox)/i.test(c))||
          /role\s*=\s*["']?navigation/.test(text);
        stack.push({tag,drop});
      }
      continue;
    }
    if (!token.startsWith('[[[') && !token.startsWith('[http')) continue;
    let href='',quote='';
    if (token.startsWith('[[[')) {
      const content=token.slice(3,-3),sep=content.indexOf('|');
      href=(sep<0?content:content.slice(0,sep)).trim();
      quote=sep<0?href:content.slice(sep+1).trim();
    } else {
      const inner=token.slice(1,-1),split=/^(\S+)(?:\s+([\s\S]*))?$/.exec(inner);
      if (!split) continue;
      href=split[1];quote=split[2]||href;
    }
    const skip=stack.some(x=>x.drop)?'auxiliary_content':href.startsWith('#')?'fragment_or_empty':null;
    raw.push({href,quote:quote.slice(0,180),selector:'FTML offset '+match.index,
      sourceElement:token.slice(0,450),skip});
  }
  return resultFromRaw(raw,source,workByUrl,supportedHosts,warnings);
}
module.exports={normalizedUrl,fromHtml,fromFtml,resultFromRaw};
