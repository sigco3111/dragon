// Isolated source-level regression for the mobile big battle info panel.
// Display-only mirror: reads native battle DOM + playerUnits, forwards
// card/formation/deployment inputs to native element clicks only.
import assert from 'node:assert/strict';
import {attachMobileControls} from '../web/src/ui/mobilecontrols.js';
const oldInterval=globalThis.setInterval;
let tick;globalThis.setInterval=(fn)=>{tick=fn;return 1};
const nodes=new Map(),natives=new Map();
const clicks={card:0,formation:[],deploy:[]};
const mkClassList=(init=[])=>({set:new Set(init),toggle(c){this.set.has(c)?this.set.delete(c):this.set.add(c)},remove(c){this.set.delete(c)},contains(c){return this.set.has(c)}});
const mkEl=(extra={})=>({style:{},dataset:{},children:[],listeners:{},classList:mkClassList(),attrs:{},
 addEventListener(t,f){this.listeners[t]=f},appendChild(e){this.children.push(e)},append(...es){this.children.push(...es)},
 setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},
 querySelector(){return null},click(){extra.onClick?.()},...extra});
// native battle DOM
const nativeCards=[];
for(let i=0;i<6;i++){
 const card=mkEl({onClick(){clicks.card++}});
 card.classList=mkClassList(i===2?['active']:[]);
 const role=mkEl();role.textContent=['좌익','좌비','대장','선봉','우비','우익'][i];
 const icon=mkEl();icon.style.backgroundImage=`url("grf/ui/battle_unit_infantry.png")`;
 const status=mkEl();status.style.backgroundImage=`url("grf/ui/battle_status_3.png")`;
 card.querySelector=(s)=>s==='.battle-card-role-label'?role:s==='.battle-card-unit-icon'?icon:s==='.battle-card-status'?status:null;
 natives.set(`#bunit${i}`,card);nativeCards.push(card);
}
const nativeFormations=[];
for(let n=0;n<16;n++){const b=mkEl({onClick(){clicks.formation.push(n)}});b.classList=mkClassList(n===5?['active']:[]);natives.set(`.battle-symbol-btn[data-formation="${n}"]`,b);nativeFormations.push(b)}
for(const x of [48,28,5]){const b=mkEl({onClick(){clicks.deploy.push(x)}});natives.set(`.battle-deployment-btn[data-base-x="${x}"]`,b)}
const texts={'#btitle':'육상　작전','#bbelligerents':'조조　대　여포','#batkname':'조조','#batktroops':'1240','#batkmorale':'80','#bdefname':'여포','#bdeftroops':'990','#bdefmorale':'63'};
for(const [k,v] of Object.entries(texts))natives.set(k,{textContent:v,style:{}});
for(const [k,w] of [['#batk-troops-fill',124],['#batk-morale-fill',80],['#bdef-troops-fill',99],['#bdef-morale-fill',63]])natives.set(k,{style:{width:`${w}px`}});
const body={classList:mkClassList(),appendChild(e){nodes.set('#'+e.id,e)}};
const doc={body,querySelector(s){return nodes.get(s)||natives.get(s)||null},createElement(){return mkEl()}};
const units=[{troops:124,maxTroops:200},{troops:50,maxTroops:100},{troops:0,maxTroops:150,routed:true},null,{troops:88,maxTroops:88},{troops:30,maxTroops:120,gone:true}];
const app={gameStarted:true,battleView:{active:true,playerUnits:()=>units}};
try{
attachMobileControls(app,{document:doc,search:'?mobileui=1'});
tick();
const panel=nodes.get('#mobilecontrols-battleinfo');
assert.ok(panel,'panel exists');
assert.equal(panel.style.display,'none','hidden until 정보 toggle');
const infoBtn=nodes.get('#mobilecontrols').children.find(c=>c.id==='mobilecontrols-info');
infoBtn.listeners.click(); // toggle on
tick();
assert.equal(panel.style.display,'flex','visible after toggle');
assert.equal(infoBtn.style.outline,'3px solid #ffe9a8','toggle highlight');
// structure: head, sides, units, label, formations, label, deploys
const [head,sides,unitGrid,,formGrid,,deployRow]=panel.children;
const [titleBox]=head.children;
assert.equal(titleBox.children[0].textContent,'육상　작전','title mirrored');
assert.equal(titleBox.children[1].textContent,'조조　대　여포','belligerents mirrored');
const [playerSide,enemySide]=sides.children;
assert.equal(playerSide.children[0].textContent,'조조','player side name');
assert.equal(playerSide.children[1].children[0].textContent,'병력 1240','player troops');
assert.equal(playerSide.children[1].children[1].textContent,'사기 80','player morale');
assert.equal(playerSide.children[2].children[0].style.width,'77.5%','player troops bar 124/160');
assert.equal(enemySide.children[0].textContent,'여포','enemy side name');
assert.equal(enemySide.children[3].children[0].style.width,'39.375%','enemy morale bar 63/160');
// unit cards
assert.equal(unitGrid.children.length,6);
const [c0,c1,c2,c3,c4,c5]=unitGrid.children;
assert.equal(c0.children[0].textContent,'좌익','role label');
assert.equal(c0.children[3].children[0].textContent,'1240','unit troops x10');
assert.equal(c0.children[3].children[1].children[0].style.width,'62%','unit troops pct');
assert.equal(c1.children[3].children[1].children[0].style.width,'50%');
assert.equal(c2.style.outline,'3px solid #ffd700','selected highlight from native active');
assert.equal(c2.attrs['aria-pressed'],'true');
assert.equal(c2.style.opacity,'.45','routed unit dimmed even when selected');
assert.equal(c3.style.opacity,'.45','missing unit dimmed');
assert.equal(c5.style.opacity,'.45','gone unit dimmed');
assert.equal(c4.style.opacity,'1','healthy unit solid');
assert.equal(c0.children[1].style.backgroundImage,'url("grf/ui/battle_unit_infantry.png")','unit icon mirrored');
assert.equal(c0.children[2].style.backgroundImage,'url("grf/ui/battle_status_3.png")','status icon mirrored');
// clicks forward to native only
c0.listeners.click();assert.equal(clicks.card,1,'card click forwards');
formGrid.children[7].listeners.click();assert.deepEqual(clicks.formation,[7],'formation click forwards');
deployRow.children[1].listeners.click();assert.deepEqual(clicks.deploy,[28],'deploy click forwards');
assert.equal(formGrid.children[5].style.outline,'3px solid #f0e000','active formation highlighted');
assert.equal(formGrid.children[5].attrs['aria-pressed'],'true');
assert.equal(formGrid.children[7].style.outline,'none');
// live update: native values change -> next tick mirrors
natives.get('#batktroops').textContent='900';units[0].troops=90;nativeCards[0].classList.set.add('active');
tick();
assert.equal(playerSide.children[1].children[0].textContent,'병력 900','live side update');
assert.equal(c0.children[3].children[0].textContent,'900','live unit update');
assert.equal(c0.style.outline,'3px solid #ffd700','live selection update');
// close button collapses and battle end resets
head.children[1].listeners.click();tick();
assert.equal(panel.style.display,'none','close button hides');
assert.equal(body.classList.contains('mobile-battle-biginfo'),false,'class removed');
infoBtn.listeners.click();tick();assert.equal(panel.style.display,'flex','reopen works');
app.battleView.active=false;tick();
assert.equal(panel.style.display,'none','battle end hides');
assert.equal(body.classList.contains('mobile-battle-biginfo'),false,'battle end resets class');
// guard: out-of-battle toggle does nothing
infoBtn.listeners.click();assert.equal(body.classList.contains('mobile-battle-biginfo'),false,'no toggle outside battle');
console.log('mobile battle info panel: mirror text/bars/cards/formations/deploys, native-only input forwarding, live sync, toggle/reset PASS');
}finally{globalThis.setInterval=oldInterval}
