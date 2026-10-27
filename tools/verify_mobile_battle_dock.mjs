import assert from 'node:assert/strict';
import {attachMobileControls} from '../web/src/ui/mobilecontrols.js';
const oldInterval=globalThis.setInterval;
const oldViewport=globalThis.visualViewport;
let tick;globalThis.setInterval=(fn)=>{tick=fn;return 1};globalThis.visualViewport={scale:.5};
const nodes=new Map(),natives=new Map();let clicks=0;
for(const id of ['bassault','battack','bformation','bwall','bdefend','bretreat'])natives.set('#'+id,{disabled:false,click(){clicks++}});
const doc={querySelector(s){return nodes.get(s)||natives.get(s)},createElement(){return {style:{},dataset:{},children:[],listeners:{},addEventListener(t,f){this.listeners[t]=f},appendChild(e){this.children.push(e)},append(...es){this.children.push(...es)}}},body:{appendChild(e){nodes.set('#'+e.id,e)}}};
const app={gameStarted:true,battleView:{active:true}};
try{
attachMobileControls(app,{document:doc,search:'?mobileui=1'});tick();const dock=nodes.get('#mobilecontrols-battle');assert.equal(dock.children.length,6);assert.equal(dock.style.display,'grid');
for(const button of dock.children){assert.equal(button.style.minHeight,'88px');assert.equal(button.style.fontSize,'32px');button.listeners.click()};assert.equal(clicks,6);
natives.get('#bwall').disabled=true;tick();assert.equal(dock.children[3].disabled,true);dock.children[3].listeners.click();assert.equal(clicks,6);
app.battleView.active=false;tick();assert.equal(dock.style.display,'none');dock.children[0].listeners.click();assert.equal(clicks,6);
assert.equal(attachMobileControls(app,{document:doc,search:'?mobileui=1'}),nodes.get('#mobilecontrols'));assert.equal(nodes.size,5); // root+list+dock+info panel(+menubar는 body 비경유)
console.log('mobile battle dock: six native routes, disabled/inactive gates, 44px scaled targets, no duplicate DOM PASS');
}finally{globalThis.setInterval=oldInterval;globalThis.visualViewport=oldViewport}
