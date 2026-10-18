// Owned opaque resources exercise transport/ownership/UI, not playable rules.
import { mountPlayerNewGame } from '/src/player/playernewgame.js';
import { sha256 } from '/src/player/runtimecontract.js';
export async function setup(options = {}) {
  const gameId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', digest='a'.repeat(64);
  const chapters=[gameId+'#one',gameId+'#two'];
  const selection={gameId,releaseId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',ordinal:'1.0',revision:'1',sourceDigest:digest,name:'<img src=x onerror=alert(1)>',publishedAt:'2030-01-01',chapters};
  const c=window.__choice={calls:[],sessions:[],selected:null,settled:false,urls:[],revoked:[],options,release:null,entered:false};
  const encode=value=>new TextEncoder().encode(JSON.stringify(value));
  const reply=async(value,contentType='application/json')=>{const bytes=encode(value);return{bytes,contentType,sha256:await sha256(bytes)};};
  const manifest={schemaVersion:1,buildFormat:'studio-app-2',compilerRevision:'owned-compiler',identity:{gameId,draftRevision:'1',sourceDigest:digest},world:{id:gameId+'-world',revision:digest,width:384,height:256,tileSize:16},chapters,assets:[],minimapAssets:[],portraits:[],visualAssets:{seasonAtlases:{},seasons:{}}};
  const data=new Map(),statics=new Map();
  const types={terrain:'application/octet-stream',roadGraph:'application/json',roadCost:'application/octet-stream',roadOffset:'application/json',minimapBase:'image/png',minimapLarge:'image/png'};
  const roles={terrain:'rules-initial-terrain',roadGraph:'native-road-v2',roadCost:'legacy-grid-visual',roadOffset:'legacy-grid-visual',minimapBase:'automatic-minimap',minimapLarge:'automatic-minimap'};
  for(const [id,type]of Object.entries(types)){
    const value=await reply({id},type);data.set('asset:'+id,value);
    (id.startsWith('minimap')?manifest.minimapAssets:manifest.assets).push({assetId:id,role:roles[id],sha256:value.sha256,byteLength:value.bytes.length,url:`/api/trial-asset?game=${gameId}&revision=1&digest=${digest}&asset=${id}`});
  }
  for(const[group,stem]of[['seasonAtlases','map_atlas_'],['seasons','map_tiles_']])for(const season of['spring','summer','autumn','winter']){
    const path=`content/builtin/compiled/map-2-${digest}/${stem}${season}.png`,value=await reply(path,'image/png');statics.set(path,value);
    manifest.visualAssets[group][season]={path,url:path,sha256:value.sha256,byteLength:value.bytes.length};
  }
  for(const[id,index]of chapters.map((id,index)=>[id,index]))data.set('chapter:'+id,await reply({name:index?'第二章':'<b>第一章</b>',start:{year:184+index,month:1,day:1},factions:options.factions??[{idx:0,monarch:''},{idx:3,monarch:'甲'},{idx:7,monarch:'<script>乙</script>'}]}));
  const manifestReply=await reply(manifest);data.set('manifest',manifestReply);
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=value=>{const url=create(value);c.urls.push(url);return url;};URL.revokeObjectURL=url=>{c.revoked.push(url);revoke(url);};
  const wait=async stage=>{if(c.options.hold===stage){c.entered=true;await new Promise(resolve=>{c.release=resolve;});}};
  const reader={async status(){c.calls.push('status');await wait('status');return{...selection,listed:c.options.unlisted!==true};},async admit({chapterId}){
    c.calls.push('admit:'+chapterId);await wait('admit');
    if(c.options.changed)throw new Error('RELEASE_CHANGED');
    const s={state:'active',closed:0,chapterId};c.sessions.push(s);
    return{identity:{...selection,chapterId,manifestDigest:manifestReply.sha256},state:()=>s.state,close(){s.closed++;s.state='closed';},async read(role){
      c.calls.push(role);await wait(role==='manifest'?'manifest':'read');if(c.options.failRole===role)throw new Error('owned failure');return structuredClone(data.get(role));
    }};
  }};
  const root=document.querySelector('#owned'),config={root,reader,selection,compilerRevision:'owned-compiler',maxTotalBytes:1000000,async readStatic(path){c.calls.push('static');await wait('static');return structuredClone(statics.get(path));}};
  c.config=config;c.selection=selection;c.data=data;c.reader=reader;
  c.mount=()=>{c.view=mountPlayerNewGame(config);c.view.result.then(value=>{c.settled=true;c.selected=value;});};
  c.mount();return{chapters,selection};
}
