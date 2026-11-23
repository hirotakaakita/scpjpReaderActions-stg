'use strict';
// Reconcile planned editions after catalog refresh; never publish or notify.
const fs=require('node:fs'),path=require('node:path');
const {loadCatalogs,matches,rankCandidates,featureArticle}=require('./generate-weekly-features');

function reconcile(catalog,rows,weeks,editorials=new Map()) {
 const source=new Map(rows.map(row=>[row.itemId,row])),themes=new Map(weeks.map(t=>[t.id,t]));
 const used=new Map(),features=[],changes=[];
 for(const f of catalog.features)for(const a of f.articles)used.set(a.itemId,(used.get(a.itemId)||0)+1);
 for(const feature of catalog.features){
  const theme=themes.get(feature.id),editorial=editorials.get(feature.id);
  if(!theme||theme.themeId!==feature.themeId||theme.publishedAt!==feature.publishedAt||
     feature.articles.length<5||feature.articles.length>10)throw Error('Invalid planned feature '+catalog.language+'/'+feature.id);
  if(editorial){
   if(JSON.stringify(feature)!==JSON.stringify(editorial)||feature.articles.some(a=>{
    const row=source.get(a.itemId);return !row||row.titleJP!==a.title||row.urlJP!==a.url||!a.blurb||a.blurb.length<=20;
   }))throw Error('Editorial feature requires review: '+catalog.language+'/'+feature.id);
   features.push(feature);continue;
  }
  const chosen=new Set(),replacements=[];
  const articles=feature.articles.map(article=>{
   const row=source.get(article.itemId);
   if(!row||!matches(row,theme)||chosen.has(article.itemId)){
    used.set(article.itemId,Math.max(0,(used.get(article.itemId)||0)-1));return null;
   }
   chosen.add(article.itemId);
   return row.titleJP===article.title&&row.urlJP===article.url&&article.blurb?.length>20?
    article:featureArticle(row,theme);
  });
  const candidates=rankCandidates(rows,theme,used).filter(row=>!chosen.has(row.itemId));
  for(let i=0;i<articles.length;i++)if(!articles[i]){
   const row=candidates.shift();if(!row)continue;
   articles[i]=featureArticle(row,theme);chosen.add(row.itemId);
   used.set(row.itemId,(used.get(row.itemId)||0)+1);
   replacements.push({previous:feature.articles[i].itemId,next:row.itemId});
  }
  const retained=articles.filter(Boolean);
  if(retained.length<5){
   for(const a of retained)used.set(a.itemId,Math.max(0,(used.get(a.itemId)||0)-1));
   changes.push({featureId:feature.id,removed:true});continue;
  }
  const next={...feature,articles:retained};
  if(JSON.stringify(next)!==JSON.stringify(feature))changes.push({featureId:feature.id,replacements});
  features.push(next);
 }
 return {catalog:{...catalog,features},changes};
}

function refresh({root=__dirname,catalogs}={}) {
 catalogs??=loadCatalogs(path.join(root,'local-data'));
 const folder=path.join(root,'features'),weeks=JSON.parse(fs.readFileSync(path.join(folder,'schedule.json'))).weeks;
 const updates=[],report={};
 for(const [language,rows] of Object.entries(catalogs)){
  const file=path.join(folder,'planned',language+'.json'),catalog=JSON.parse(fs.readFileSync(file));
  if(catalog.language!==language)throw Error('Feature language mismatch: '+language);
  const editorials=new Map();
  for(const feature of catalog.features){
   const editorial=path.join(folder,'editorial',language,feature.id+'.json');
   if(fs.existsSync(editorial))editorials.set(feature.id,JSON.parse(fs.readFileSync(editorial)));
  }
  const result=reconcile(catalog,rows,weeks,editorials);
  if(result.changes.length){updates.push({file,catalog:result.catalog});report[language]=result.changes;}
 }
 // Validate every editorial selection before writing any changed language.
 for(const {file,catalog} of updates){
  fs.writeFileSync(file+'.tmp',JSON.stringify(catalog,null,2)+'\n');fs.renameSync(file+'.tmp',file);
 }
 return report;
}
if(require.main===module)console.log(JSON.stringify(refresh({root:path.resolve(process.argv[2]||__dirname)}),null,2));
module.exports={reconcile,refresh};
