'use strict';
const { LANGUAGES } = require('./languages');
const VERSION = 1;
const hosts = new Map(Object.entries(LANGUAGES).map(([code,c])=>[new URL(c.baseUrl).hostname,code==='zh-tr'?'zh':code]));
hosts.set('scpfoundation.net','ru');
for (const [code,host] of Object.entries({la:'scp-la.wikidot.com',ro:'scp-ro.wikidot.com',tr:'scpvakfi.wikidot.com',el:'scp-el.wikidot.com',eo:'scp-esperanto.wikidot.com',ms:'scp-ms.wikidot.com'})) hosts.set(host,code);
const aliases = {'www.scp-wiki.net':'scp-wiki.wikidot.com','scp-wiki.net':'scp-wiki.wikidot.com','scpwiki.com':'scp-wiki.wikidot.com','www.scpwiki.com':'scp-wiki.wikidot.com'};
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
  for(const a of document.querySelectorAll('.licensebox a[href],.license-box a[href],.credit a[href],.credit-box a[href],#u-credit-view a[href],.translation-source a[href]')) {
    const target=originalPage(a.getAttribute('href'),url);
    if(!target||target.url===originalPage(url)?.url||a.classList.contains('newpage'))continue;
    const container=a.closest('p,li,td,div')||a.parentElement;
    let prefix='',stopped=false;
    function walk(n){if(stopped)return;if(n===a){stopped=true;return;}if(n.nodeType===3)prefix+=n.textContent;else{if(n.tagName==='BR')prefix+='\n';for(const child of n.childNodes)walk(child);}}
    walk(container);
    const line=prefix.split(/[\r\n]/).at(-1).trim();
    const label=/^(?:original(?: article| work)?|originál|oryginał|źródło|原文|原作|原著|來源|来源|bản gốc|tác phẩm gốc|источник|оригинал)\s*[:：]\s*$/iu;
    if(!a.closest('.translation-source')&&!label.test(line))continue;
    found.set(target.url,{...target,method:'credit_original_label',quote:line.slice(0,200)});
  }
  return [...found.values()].sort((a,b)=>a.url.localeCompare(b.url));
}
module.exports={VERSION,originalPage,extractOriginalSources};
