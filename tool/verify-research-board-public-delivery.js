'use strict';
// Read-only public CDN verification of the exact URL fetched by the
// com.scp.reader.stg ResearchBoardCatalog Dart client.
// No Firebase credentials or GitHub write access required.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {isDeepStrictEqual}=require('node:util');
const output=path.resolve(process.argv[2]||'delivery-check');
const base='https://raw.githubusercontent.com/hirotakaakita/scpjpReaderActions-stg/refs/heads/master/local-data/mobile-v3/research-board/';
const prodBase=base.replace('/scpjpReaderActions-stg/','/scpjpReaderActions/');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
async function get(url,limit=32e6,attempts=3){
  let last;
  for(let i=0;i<attempts;i++){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(35000),headers:{
        'User-Agent':'SCPReader-Postmerge-Delivery-Verification/1.0',
        'Accept':'application/octet-stream,application/json'
      }});
      if(!response.ok){
        if(response.status===404)return {status:404,error:'not_found',url};
        if(response.status>=500||response.status===429)throw Error('HTTP '+response.status);
        return {status:response.status,error:'http_error',url};
      }
      const len=Number(response.headers.get('content-length')||0);
      if(len>limit)throw Error('Content-Length too large '+len);
      const chunks=[];let size=0;
      for await(const c of response.body){size+=c.length;
        if(size>limit)throw Error('Response exceeds size limit');
        chunks.push(c);
      }
      return {status:response.status,url,bytes:Buffer.concat(chunks),
        etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified'),
        contentType:response.headers.get('content-type')};
    }catch(e){last=String(e.message||e);if(i<attempts-1)
      await new Promise(r=>setTimeout(r,1200*(i+1)));}
  }
  return {status:null,url,error:last};
}
async function main(){
  fs.mkdirSync(output,{recursive:true});
  const localPath=path.resolve('local-data/mobile-v3/research-board');
  const localBytes=fs.readFileSync(path.join(localPath,'manifest.json'));
  const local=JSON.parse(localBytes);
  const summary={source:'Staging Flutter ResearchBoardCatalog exact raw GitHub URL',checkedAt:new Date().toISOString(),
    boardRevisionExpected:local.revision,manifestUrl:base+'manifest.json',
    expectedBoardSha:local.sha256,
    expectedNodeCount:local.nodeCount,expectedEdgeCount:local.edgeCount};
  const remote=await get(base+'manifest.json',128*1024);
  summary.manifestHTTP=remote.status;
  summary.manifestError=remote.error||null;
  summary.manifestETag=remote.etag||null;
  if(remote.bytes){
    summary.manifestByteMatch=remote.bytes.equals(localBytes);
    const remoteManifest=JSON.parse(remote.bytes);
    // Git may check out JSON with CRLF on Windows. Clients parse JSON;
    // retain the byte comparison as evidence without rejecting that checkout.
    summary.manifestJSONMatch=isDeepStrictEqual(remoteManifest,local);
    summary.remoteRevision=remoteManifest.revision;
    summary.remoteManifestHash=hash(remote.bytes);
  } else {summary.manifestByteMatch=false;summary.manifestJSONMatch=false;}
  const board=await get(base+local.fileName,24*1024*1024);
  summary.boardHTTP=board.status;
  summary.boardError=board.error||null;
  if(board.bytes){
    summary.boardSize=board.bytes.length;
    summary.boardHash=hash(board.bytes);
    summary.boardByteMatch=board.bytes.length===local.bytes&&summary.boardHash===local.sha256;
    if(summary.boardByteMatch){
      const decoded=zlib.gunzipSync(board.bytes);
      const parsed=JSON.parse(decoded.toString('utf8'));
      summary.boardValid=decoded.length===local.decodedBytes&&
        parsed.revision===local.revision&&parsed.nodes.length===local.nodeCount&&
        parsed.edges.length===local.edgeCount;
      summary.retrievedNodeCount=parsed.nodes.length;
      summary.retrievedEdgeCount=parsed.edges.length;
    }else summary.boardValid=false;
  }else {summary.boardByteMatch=false;summary.boardValid=false;}
  // This is informational only: the production app uses a different repo.
  const prod=await get(prodBase+'manifest.json',128*1024,2);
  summary.productionManifestUrl=prod.url;
  summary.productionManifestHTTP=prod.status;
  if(prod.bytes){try{summary.productionRevision=JSON.parse(prod.bytes).revision;}
    catch{summary.productionError='non_json';}}
  if(prod.error)summary.productionError=prod.error;
  summary.passed=summary.manifestJSONMatch&&summary.boardByteMatch&&summary.boardValid;
  fs.writeFileSync(path.join(output,'delivery-verification.json'),JSON.stringify(summary,null,2)+'\n');
  fs.writeFileSync(path.join(output,'README.md'),[
    '# SCP Research Board postmerge delivery verification','',
    'This audit requests the exact STG manifest and gzip payload URLs',
    'consumed by the Flutter application from raw.githubusercontent.com.',
    'No Firebase publish or production repo mutation is performed.','',
    '| Check | Result |','| --- | --- |',
    ...Object.entries(summary).filter(([key])=>!key.endsWith('Url')&&!key.endsWith('ETag'))
      .map(([key,value])=>'| '+key+' | '+String(value)+' |'),'', 
    'The production manifest is observed only, not required to match staging.',''
  ].join('\n'));
  console.log(JSON.stringify(summary,null,2));
  if(!summary.passed)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
