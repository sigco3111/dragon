// Formal end ownership around the unchanged real Session; presentation/I/O seams.
import assert from 'node:assert/strict';
import {OriginalBattleSession} from '../web/src/game/battle/originalsession.js';
import {openStrategicBattle} from '../web/src/app/battleflow.js';
const elements=new Map(),images=[],requests=[],cancelled=[];let commits=0,callbacks=0,checks=0;
Object.defineProperty(globalThis,'indexedDB',{get(){throw new Error('no storage in disposal test');}});
globalThis.document={querySelector(id){if(!elements.has(id))elements.set(id,{style:{},dataset:{},removeAttribute(){}});return elements.get(id);}};
globalThis.Image=class{set src(value){this.url=value;images.push(this);}};
globalThis.fetch=url=>new Promise((resolve,reject)=>requests.push({url,resolve,reject}));
globalThis.cancelAnimationFrame=id=>cancelled.push(id);globalThis.removeEventListener=()=>{};
const {BattleView}=await import('../web/src/render/battleview.js');
function fixture(layout){
 const session=new OriginalBattleSession({rngClock:{ch:0x12,cl:0x34,dh:0x56},registers:{side0Active:1,side1Active:1}});
 session.enqueue({type:'tactical-command',frame:0,side:0,groups:[0],commandNumber:1});
 session.consumeInitialNativeCommit=()=>{commits++;throw new Error('late commit');};
 const handle={session,layout,title:'owned formal',sideMap:{atk:0,def:1}};
 const view=Object.assign(Object.create(BattleView.prototype),{
  app:{_formalEntry:{ended:false},clock:{hold:false,_legacyPaused:false,strategicSpeed:2},score:{beginBattle(){}}},
  cv:{style:{}},_openGeneration:0,_raf:12,active:false,scriptAccumulator:5,
  originalDisplayProcess:{endBattle(){throw new Error('must not commit scratch');}},sceneCanvas:{},terrainLayers:[{}],
  dialoguePresentation:{dispose(){}},focusCameraOnPlayer(){},updateCursor(){},syncBattlePanel(){},
 });
 let deleted=false;
 view.app.checkFormalCurrent=()=>{if(deleted){view.app._formalEntry.ended=true;view.discardFormal();return false;}return true;};
 return{view,handle,session,retire(){deleted=true;}};
}
for(const [layout,fail] of [[0,false],[1,true]]){
 const {view,handle,session,retire}=fixture(layout),before=session.snapshot();
 assert.throws(()=>view.discardFormal(),/has not ended/);assert.throws(()=>view.discardTrial(),/isolated Trial/);checks++;
 const pending=view.open(handle,()=>callbacks++);assert.equal(view.battle,handle);assert.equal(view.app.clock.hold,true);
 retire(); // No manual discard: the actual late-open boundary must discover it.
 for(const image of images.splice(0)){if(fail)image.onerror();else image.onload();}
 for(const request of requests.splice(0))request.resolve({ok:true,json:async()=>({}),arrayBuffer:async()=>new ArrayBuffer(299520)});
 await pending;
 assert.deepEqual(session.snapshot(),before);assert.equal(view.active,false);assert.equal(view.battle,null);assert.equal(view.onFinish,null);assert.equal(view.originalDisplayProcess,null);assert.equal(view.mapImg,null);checks++;
 const generation=view._openGeneration;assert.equal(view.discardFormal(),false);assert.equal(view._openGeneration,generation);
 assert.equal(view.updateBattleFrames(100000),false);view.finish();view.queuePanelInput({type:'formation-select',index:1});await view.open(handle,()=>callbacks++);
 assert.deepEqual(session.snapshot(),before);assert.equal(commits,0);assert.equal(callbacks,0);checks++;
 assert.equal(Object.hasOwn(view.app,'trialIdentity'),false);assert.equal(Object.hasOwn(view.app,'canPersist'),false);checks++;
}
for(const boundary of ['updateBattleFrames','queuePanelInput','finish']){
 const {view,handle,session,retire}=fixture(2),before=session.snapshot();view.battle=handle;view.active=true;view.onFinish=()=>callbacks++;
 retire();view[boundary](boundary==='queuePanelInput'?{type:'formation-select',index:1}:1);
 assert.equal(view.active,false);assert.equal(view.battle,null);assert.equal(callbacks,0);assert.deepEqual(session.snapshot(),before);checks++;
}
let creates=0;assert.equal(await openStrategicBattle({checkFormalCurrent:()=>false},()=>creates++,()=>callbacks++),false);assert.equal(creates,0);checks++;
assert.ok(cancelled.includes(12));assert.equal(commits,0);assert.equal(callbacks,0);assert.equal(images.length,0);assert.equal(requests.length,0);
process.stdout.write(JSON.stringify({checks,commits,callbacks,scope:'Actual view open/frame/input/finish/discard and real Session unchanged on retirement; fake pending asset/DOM ports. Not a full battle, authenticated reader or browser proof.'})+'\n');
