'use strict';
const { LANGUAGES } = require('./languages');
const VERSION = 1;
const hosts = new Map(Object.entries(LANGUAGES).map(([code,c])=>[new URL(c.baseUrl).hostname,code==='zh-tr'?'zh':code]));
hosts.set('scpfoundation.net','ru');
for (const [code,host] of Object.entries({la:'scp-la.wikidot.com',ro:'scp-ro.wikidot.com',tr:'scpvakfi.wikidot.com',el:'scp-el.wikidot.com',eo:'scp-esperanto.wikidot.com',ms:'scp-ms.wikidot.com'})) hosts.set(host,code);
const aliases = {'www.scp-wiki.net':'scp-wiki.wikidot.com','scp-wiki.net':'scp-wiki.wikidot.com','scpwiki.com':'scp-wiki.wikidot.com','www.scpwiki.com':'scp-wiki.wikidot.com'};
for(const host of ['scp-wiki-cn.org','www.scp-wiki-cn.org'])aliases[host]='scp-wiki-cn.wikidot.com';
function originalPage(value, base) {
  try {
    const u=new URL(value,base),host=aliases[u.hostname]||u.hostname;
    if(!hosts.has(host)||!/^https?:$/.test(u.protocol)||u.username||u.password||u.port||u.search)return null;
    const slug=decodeURIComponent(u.pathname).replace(/^\/+|\/+$/g,'');
    if(!/^[\p{L}\p{N}][\p{L}\p{N}_:-]*$/u.test(slug)||/^(?:system|user|forum|component|theme|admin):/.test(slug))return null;
    return {url:`https://${host}/${encodeURI(slug.toLowerCase())}`,hostBranch:hosts.get(host)};
  }catch{return null;}
}
function extractOriginalSources(document, url) {
  const found=new Map();
  const terms='original(?: article| work| link| source)?|article original|artículo original|artigo original|originál|oryginał|źródło|原文(?:リンク|链接|連結|地址)?|原作|原著|元記事(?:リンク)?|翻訳元|來源|来源|bản gốc|tác phẩm gốc|источник|оригинал';
  for(const a of document.querySelectorAll('.licensebox a[href],.license-box a[href],.credit a[href],.credit-box a[href],#u-credit-view a[href],.translation-source a[href]')) {
    const target=originalPage(a.getAttribute('href'),url);
    if(!target||target.url===originalPage(url)?.url||a.classList.contains('newpage'))continue;
    const container=a.closest('p,li,td,div')||a.parentElement;
    let prefix='',stopped=false;
    function walk(n){if(stopped)return;if(n===a){stopped=true;return;}if(n.nodeType===3)prefix+=n.textContent;else{if(n.tagName==='BR')prefix+='\n';for(const child of n.childNodes)walk(child);}}
    walk(container);
    const line=prefix.split(/[\r\n]/).at(-1).trim();
    const label=new RegExp('^(?:'+terms+')\\s*[:：]\\s*$','iu');
    const anchorLabel=new RegExp('^(?:'+terms+')\\s*[:：]?\\s*$','iu');
    if(!a.closest('.translation-source')&&!label.test(line)&&!anchorLabel.test(a.textContent.trim()))continue;
    found.set(target.url,{...target,method:'credit_original_label',quote:line.slice(0,200)});
  }
  // Some credits print a bracketed URL as text rather than an <a> element.
  const plainLabel=new RegExp('^((?:'+terms+')\\s*[:：])\\s*\\[?(https?:\\/\\/[^\\s\\]]+)\\]?\\s*$','iu');
  for(const p of document.querySelectorAll('.licensebox p,.license-box p,.credit p,.credit-box p,#u-credit-view p')){
    const copy=p.cloneNode(true);for(const br of copy.querySelectorAll('br'))br.replaceWith('\n');
    for(const line of copy.textContent.split(/[\r\n]/).map(s=>s.trim()).filter(Boolean)){
      const m=plainLabel.exec(line);if(!m)continue;
      const target=originalPage(m[2],url);
      if(target&&target.url!==originalPage(url)?.url)found.set(target.url,{...target,method:'credit_original_label',quote:m[1]});
    }
  }
  return [...found.values()].sort((a,b)=>a.url.localeCompare(b.url));
}
function extractAuthorCredits(document){
  const authors=new Map(),translators=new Map(),derivativeAuthors=new Map();
  for(const a of document.querySelectorAll('.licensebox a[href],.license-box a[href],.credit a[href],.credit-box a[href],#u-credit-view a[href]')){
    const id=/wikidot\.com\/user:info\/([^/?#]+)/i.exec(a.getAttribute('href')||'')?.[1]?.toLowerCase();
    if(!id)continue;
    const container=a.closest('p,li,td')||a.parentElement;let prefix='',stopped=false;
    function walk(n){if(stopped)return;if(n===a){stopped=true;return;}if(n.nodeType===3)prefix+=n.textContent;else{if(n.tagName==='BR')prefix+='\n';for(const child of n.childNodes)walk(child);}}
    walk(container);const line=prefix.split(/[\r\n]/).map(s=>s.trim()).filter(Boolean).at(-1)||'';
    const author=/^(?:original author|author(?:s)?|written by|著者|著作権者|作者|原作者|原著者|auteur|autor|autore|автор|tác giả)\s*[:：]/iu;
    const derivative=/^(?:衍生作品作者|derivative(?: work)? author)\s*[:：]/iu;
    const translator=/^(?:translator(?:s)?|translated by|翻訳(?:者|責任者)?|訳者|译者|譯者|traducteur|traductor|traduttore|переводчик|dịch giả)\s*[:：]/iu;
    const value={id,name:a.textContent.trim()||a.querySelector('img')?.getAttribute('alt')||id,url:'https://www.wikidot.com/user:info/'+id};
    if(translator.test(line))translators.set(id,value);else if(derivative.test(line))derivativeAuthors.set(id,value);else if(author.test(line))authors.set(id,value);
  }
  return {authorCreditVersion:1,originalAuthors:[...(derivativeAuthors.size?derivativeAuthors:authors).values()].sort((a,b)=>a.id.localeCompare(b.id)),
    upstreamAuthors:derivativeAuthors.size?[...authors.values()]:[],translators:[...translators.values()].sort((a,b)=>a.id.localeCompare(b.id))};
}
module.exports={VERSION,originalPage,extractOriginalSources,extractAuthorCredits};
