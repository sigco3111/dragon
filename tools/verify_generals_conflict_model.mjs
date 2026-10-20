// Controller-only evidence; no user profile, source files or engine execution.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const {installGenerals}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync('server/public/general.txt')).toString('base64'));
function setup() {
  let actor={user:{id:'author',role:'author'}},model,busy=false,hook=null,confirmed=true;
  const data={gameId:'game',draftRevision:'1',metadata:{name:'G',introduction:'private'},chapters:[{chapterId:'ch#1',name:'',generals:[{idx:5,name:'<img>',hao:'字',portraitKey:null}],factions:[{idx:2,monarch_idx:5,advisor_idx:6,capital:8}]}]},calls=[],prompts=[];
  const portraits=[{assetId:'kao000',mime:'image/png',byteLength:100,inUse:false},{assetId:'kao001',mime:'image/png',byteLength:101,inUse:true}];
  const ui=installGenerals({authority:()=>actor,isBusy:()=>busy,publish:value=>{model=value;},prompt:()=>prompts.shift()??null,confirm:()=>confirmed,api:async(path,body,options)=>{
    calls.push({path,body,options});if(hook){const result=await hook(path,body,options);if(result!==undefined)return result;}
    if(path==='/api/games')return {games:[{gameId:data.gameId,draftRevision:data.draftRevision,metadata:data.metadata}]};
    if(path.includes('/draft?'))return structuredClone(data);
    if(path.endsWith('/portraits'))return {portraits:structuredClone(portraits)};
    if(path.endsWith('/draft/save')){data.draftRevision=String(BigInt(data.draftRevision)+1n);const e=body.chapterEdits[0];if(e.op==='rename-general')Object.assign(data.chapters[0].generals[0],e.values);if(e.op==='portrait')data.chapters[0].generals[0].portraitKey=e.portraitKey;return {draftRevision:data.draftRevision};}
    throw new Error('unexpected '+path);
  },work:async fn=>{if(busy)return;busy=true;try{return await fn();}finally{busy=false;ui.render();}}});ui.setIdentity(actor);
  return {ui,a:ui.actions,data,calls,prompts,portraits,get model(){return model;},set hook(value){hook=value;},set identity(value){actor=value;ui.setIdentity(value);},set confirmed(value){confirmed=value;}};
}
const writes=s=>s.calls.filter(c=>c.body!==undefined);
test('explicit read and stable projected rows; no raw DTO aliases; read-only blocker',async()=>{
  const s=setup();assert.equal(s.calls.length,0);await s.a.refresh();assert.equal(s.calls.length,2);assert.equal(s.model.chapters[0].name,'ch#1');assert.equal(s.model.generals[0].idx,5);assert.ok(!JSON.stringify(s.model).includes('private'));s.model.generals[0].name='changed';s.ui.render();assert.equal(s.model.generals[0].name,'<img>');await s.a.blockers('ch#1',5);assert.match(s.model.message,/128/);assert.equal(writes(s).length,0);
});
test('rename cancel is no request; successful name/hao save uses original chapter, slot, metadata and revision',async()=>{
  const s=setup();await s.a.refresh();const n=s.calls.length;await s.a.rename('ch#1',5);assert.equal(s.calls.length,n);s.prompts.push('新名','新字');await s.a.rename('ch#1',5);assert.deepEqual(writes(s)[0].body,{metadata:{name:'G',introduction:'private'},resourceEdits:[],chapterEdits:[{op:'rename-general',chapterId:'ch#1',generalIdx:5,values:{name:'新名',hao:'新字'}}]});assert.equal(writes(s)[0].options.revision,'1');assert.ok(writes(s)[0].options.key);assert.equal(s.model.generals[0].name,'新名');assert.match(s.model.context,/修訂 2/);assert.equal(s.model.saveDisabled,false);
});
test('conflict and unknown write propagate in module, require explicit reread, never automatic retry/latest',async()=>{
  for(const lost of [false,true]){const s=setup();await s.a.refresh();s.prompts.push('新名','新字');s.hook=async(path,body)=>{if(body){if(lost)s.data.draftRevision='2';throw new Error(lost?'LOST':'CONFLICT');}};await assert.rejects(s.a.rename('ch#1',5),/LOST|CONFLICT/);assert.match(s.model.message,/保存失敗/);assert.match(s.model.context,/修訂 1/);assert.equal(s.model.saveDisabled,true);await assert.rejects(s.a.rename('ch#1',5));assert.equal(writes(s).length,1);s.hook=null;await s.a.refresh();assert.equal(s.model.saveDisabled,false);assert.match(s.model.context,lost?/修訂 2/:/修訂 1/);}
});
test('portrait list is read-only, selected stable key binds and existing binding clears via chapter save',async()=>{
  const s=setup();await s.a.refresh();await s.a.portrait('ch#1',5);assert.equal(writes(s).length,0);await s.a.listPortraits();assert.equal(s.model.library.length,2);s.a.selectPortrait('not-listed');assert.equal(s.model.portraitId,'kao000');s.a.selectPortrait('kao001');await s.a.portrait('ch#1',5);assert.deepEqual(writes(s)[0].body.chapterEdits,[{op:'portrait',chapterId:'ch#1',generalIdx:5,portraitKey:'kao001'}]);await s.a.portrait('ch#1',5);assert.equal(writes(s)[1].body.chapterEdits[0].portraitKey,null);assert.ok(writes(s).every(c=>c.path.endsWith('/draft/save')));
});
test('four faction actions preserve original request contracts and confirmation cancellation',async()=>{
  const cases=[['set-monarch',['7'],{generalIdx:7}],['set-strategist',['q'],{generalIdx:null}],['set-strategist',['7'],{generalIdx:7}],['remove-monarch',['7'],{resolution:{successor:7}}],['remove-monarch',['q'],{resolution:{disband:true}}],['disband-faction',[],{confirm:true}]];
  for(const [kind,values,fields] of cases){const s=setup();await s.a.refresh();s.prompts.push(...values);await s.a.faction(kind,'ch#1',2);assert.deepEqual(writes(s)[0].body.chapterEdits,[{op:kind,chapterId:'ch#1',factionIdx:2,...fields}]);assert.equal(writes(s)[0].options.revision,'1');}
  for(const [kind,input] of [['set-strategist','7'],['remove-monarch','q'],['disband-faction',null]]){const s=setup();await s.a.refresh();s.confirmed=false;if(input)s.prompts.push(input);await s.a.faction(kind,'ch#1',2);assert.equal(writes(s).length,0);}
});
test('invalid numeric prompt cannot serialize NaN as null and silently dismiss an advisor',async()=>{
  for(const kind of ['set-monarch','set-strategist','remove-monarch'])for(const raw of ['abc',' ','1.5','Infinity']){const s=setup();await s.a.refresh();s.prompts.push(raw);const n=s.calls.length;await assert.rejects(s.a.faction(kind,'ch#1',2),/整數/);assert.equal(writes(s).length,0);assert.equal(s.calls.length,n);}
});
test('identity guards and late responses prevent private rows or cross-session writes',async()=>{
  for(const identity of [null,{user:{id:'forced',role:'admin',mustChangePassword:true}}]){const s=setup();s.identity=identity;await assert.rejects(s.a.refresh());await assert.rejects(s.a.listPortraits());assert.equal(s.calls.length,0);assert.deepEqual(s.model.generals,[]);}
  for(const action of ['inspect','listPortraits','rename']){const s=setup();await s.a.refresh();let resolve; s.hook=()=>new Promise(done=>{resolve=done;});s.prompts.push('x','y');const pending=action==='rename'?s.a.rename('ch#1',5):s.a[action]();s.identity={user:{id:'other',role:'author'}};resolve(action==='listPortraits'?{portraits:s.portraits}:structuredClone(s.data));await pending;assert.equal(writes(s).length,0);assert.deepEqual(s.model.generals,[]);assert.deepEqual(s.model.library,[]);assert.equal(s.model.message,'');}
});
test('wrong draft binding, duplicate slots and malformed catalogue reject atomically; stale chapter actions cannot write',async()=>{
  const s=setup();await s.a.refresh();s.hook=async path=>path.includes('/draft?')?{...s.data,gameId:'foreign'}:undefined;await assert.rejects(s.a.inspect());assert.equal(s.model.generals[0].name,'<img>');s.hook=null;s.data.chapters[0].generals.push({...s.data.chapters[0].generals[0]});await assert.rejects(s.a.inspect());assert.equal(s.model.generals.length,1);await assert.rejects(s.a.rename('old-chapter',5));assert.equal(writes(s).length,0);await s.a.listPortraits();s.portraits.push({...s.portraits[0]});await assert.rejects(s.a.listPortraits());assert.equal(s.model.library.length,2);
});
