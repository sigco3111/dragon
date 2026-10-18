// Actual UI module with owned DOM/transport/session seams. No browser or authority proof.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const moduleURL='data:text/javascript;base64,'+Buffer.from(readFileSync('server/public/management.txt')).toString('base64');
const {installGameDeletion}=await import(moduleURL);
const A='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',G='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',R='cccccccc-cccc-4ccc-8ccc-cccccccccccc',T='2026-10-15T00:00:00.000Z';
const actor={user:{id:A,version:1,role:'author',mustChangePassword:false}},key='editor-deletion-operation:'+A;
const error=(status,code)=>Object.assign(new Error(code),{status,code});
const parse=text=>{try{return JSON.parse(text);}catch(cause){throw new Error('owned JSON',{cause});}};
class Element{children=[];textContent='';disabled=false;append(...v){this.children.push(...v);}replaceChildren(...v){this.children=[...v];}}
let checks=0;
function setup(){
 const nodes=Object.fromEntries([...readFileSync('server/public/index.html','utf8').matchAll(/id="(deletion-[^"]+)"/g)].map(m=>[m[1],new Element()]));
 const journal=new Map(),calls=[],dialogs=[];let identity=structuredClone(actor),consent=true,name='測試',mode='ok';
 const game={gameId:G,ownerId:A,rowRevision:'4',listed:false,metadata:{name:'測試'}};
 const result={gameId:G,state:'fenced',rowRevision:'5',createdAt:T};
 const observed={version:1,gameId:G,result,distribution:{gameId:G,operationId:R,generation:2,kind:'delete-fence',state:'pending',visibleAt:null,recoveryRequired:false}};
 let post=async()=>structuredClone(result),get=async()=>structuredClone(result),status=async()=>structuredClone(observed),preview=async()=>({gameId:G,rowRevision:'4',confirmationName:'測試'});
 const managed={gameId:G,rowRevision:'4',listed:false,name:null,creatorAccount:'other-author'};
 globalThis.document={querySelector:s=>nodes[s.slice(1)],createElement:()=>new Element()};
 globalThis.sessionStorage={getItem:k=>journal.get(k)??null,setItem(k,v){if(mode==='throw')throw new Error('quota');if(mode!=='silent')journal.set(k,v);},removeItem:k=>journal.delete(k)};
 globalThis.prompt=text=>{dialogs.push(text);return name;};globalThis.confirm=text=>{dialogs.push(text);return consent;};
 const api=async(path,value,options)=>{calls.push({path,value:structuredClone(value),options:structuredClone(options)});if(value!==undefined)return post();if(path==='/api/games')return {games:[game]};if(path==='/api/admin/games')return {games:[managed]};if(path.endsWith('/deletion-preview'))return preview();if(path.endsWith('/distribution'))return status();if(path.includes('/deletion-operations/'))return get();throw new Error('unexpected route');};
 let ui;const mount=()=>{ui=installGameDeletion({api,authority:()=>identity,work:fn=>fn(),isBusy:()=>false});ui.setIdentity(identity);};mount();
 return {nodes,journal,calls,dialogs,game,result,observed,mount,managed,preview:fn=>{preview=fn;},adminLoad:()=>nodes['deletion-admin-load'].onclick(),get ui(){return ui;},load:()=>nodes['deletion-load'].onclick(),start:()=>nodes['deletion-games'].children[0].children[1].onclick(),query:()=>nodes['deletion-query'].onclick(),retry:()=>nodes['deletion-retry'].onclick(),forget:()=>nodes['deletion-forget'].onclick(),text:()=>nodes['deletion-result'].textContent,posts:()=>calls.filter(c=>c.value!==undefined),post:fn=>{post=fn;},get:fn=>{get=fn;},status:fn=>{status=fn;},mode:v=>{mode=v;},name:v=>{name=v;},consent:v=>{consent=v;},identity:v=>{identity=v;ui.setIdentity(v);}};
}
{
 const f=setup();await f.load();f.post(async()=>{assert.ok(f.journal.has(key));return f.result;});await f.start();const saved=parse(f.journal.get(key));assert.deepEqual(f.posts()[0],{path:'/api/games/'+G+'/deletion',value:{gameId:G,expectedRowRevision:'4',confirmationName:'測試'},options:{key:saved.key}});assert.match(f.text(),/非物理清理完成.*分發待確認/);assert.equal(f.nodes['deletion-retry'].disabled,true);checks++;
 f.observed.distribution.state='confirmed';f.observed.distribution.visibleAt=T;await f.query();assert.match(f.text(),/分發曾於.*不證明歷史內容/);checks++;
 f.observed.distribution.recoveryRequired=true;await f.query();assert.match(f.text(),/恢復鎖/);const n=f.calls.length;f.mount();assert.equal(f.calls.length,n);assert.equal(f.text(),'');await f.query();assert.match(f.text(),/恢復鎖/);checks++;
 const d=f.dialogs.length;assert.equal(f.ui.canLeave(true),false);assert.equal(f.dialogs.length,d);f.consent(false);f.forget();assert.ok(f.journal.has(key));f.consent(true);f.forget();assert.equal(f.journal.has(key),false);assert.equal(f.posts().length,1);checks++;
}
{
 const f=setup();await f.load();f.post(async()=>{throw error(503,'LOST');});await assert.rejects(f.start());const original=structuredClone(f.posts()[0]);f.mount();f.get(async()=>{throw error(404,'DELETE_OPERATION_NOT_FOUND');});await assert.rejects(f.query());assert.equal(f.nodes['deletion-retry'].disabled,false);f.game.rowRevision='99';f.game.metadata.name='新名稱';await f.load();f.post(async()=>f.result);f.get(async()=>f.result);await f.retry();assert.deepEqual(f.posts()[1],original);checks++;
 f.get(async()=>{throw error(404,'DELETE_OPERATION_NOT_FOUND');});await assert.rejects(f.query());assert.equal(f.nodes['deletion-retry'].disabled,true);await assert.rejects(f.retry());checks++;
}
for(const [status,code] of [[404,'GAME_NOT_FOUND'],[401,'SESSION_INVALID'],[409,'OPERATION_REVOKED'],[503,'DISTRIBUTION_NOT_CONFIGURED'],[503,'DISTRIBUTION_STATUS_UNAVAILABLE']]){
 const f=setup();await f.load();f.post(async()=>{throw error(503,'LOST');});await assert.rejects(f.start());f.get(async()=>{throw error(status,code);});await assert.rejects(f.query());await assert.rejects(f.retry());assert.ok(f.journal.has(key));checks++;
}
for(const mutate of [v=>{v.gameId=R;},v=>{v.extra=1;},v=>{v.result.state='deleted';},v=>{v.result.rowRevision='4';},v=>{v.distribution=null;},v=>{v.distribution.kind='listing';},v=>{v.distribution.operationId='bad';},v=>{v.distribution.generation=0;},v=>{v.distribution.visibleAt=T;},v=>{v.distribution.state='done';},v=>{v.distribution.recoveryRequired=1;},v=>{v.distribution.extra=1;}]){
 const f=setup();await f.load();await f.start();const bad=structuredClone(f.observed);mutate(bad);f.status(async()=>bad);await assert.rejects(f.query());assert.doesNotMatch(f.text(),/分發曾於/);assert.equal(f.nodes['deletion-retry'].disabled,true);checks++;
}
{
 const f=setup();await f.load();await f.start();f.status(async()=>{throw error(404,'DELETE_OPERATION_NOT_FOUND');});await assert.rejects(f.query());await assert.rejects(f.retry());checks++;
 f.identity({user:{...actor.user,version:2}});f.get(async()=>{throw error(404,'DELETE_OPERATION_NOT_FOUND');});await assert.rejects(f.query());await assert.rejects(f.retry());checks++;
 f.identity({user:{...actor.user,id:R}});assert.equal(f.text(),'');assert.ok(f.journal.has(key));assert.equal(f.nodes['deletion-operation'].textContent.includes(G),false);checks++;
}
for(const mode of ['throw','silent']){const f=setup();await f.load();f.mode(mode);await assert.rejects(f.start(),/無法保留/);assert.equal(f.posts().length,0);checks++;}
for(const raw of ['{','{}','x'.repeat(4097)]){const f=setup();f.journal.set(key,raw);f.mount();await f.load();await assert.rejects(f.start());assert.equal(f.posts().length,0);checks++;}
for(const name of [null,'錯誤','測試 ']){const f=setup();await f.load();f.name(name);if(name===null)await f.start();else await assert.rejects(f.start());assert.equal(f.posts().length,0);assert.equal(f.journal.size,0);checks++;}
{
 const f=setup();f.game.listed=true;await f.load();assert.equal(f.nodes['deletion-games'].children[0].children[1].disabled,true);await assert.rejects(f.start());assert.equal(f.posts().length,0);checks++;
 f.game.gameId='wolong-builtin';await assert.rejects(f.load());assert.equal(f.posts().length,0);checks++;
}
{
 const f=setup();await f.load();let release;f.post(()=>new Promise(r=>{release=r;}));const running=f.start();f.identity(null);release(f.result);await running;assert.equal(f.text(),'');assert.equal(f.calls.some(c=>c.path.includes('/deletion-operations/')),false);checks++;
}
{
 const f=setup();await f.load();await f.start();let release,entered;const ready=new Promise(r=>{entered=r;});f.status(()=>new Promise(r=>{release=r;entered();}));const older=f.query();await ready;f.status(async()=>({...f.observed,distribution:{...f.observed.distribution,state:'confirmed',visibleAt:T}}));await f.query();release(f.observed);await older;assert.match(f.text(),/分發曾於/);checks++;
 f.status(async()=>({...f.observed,distribution:{...f.observed.distribution,operationId:A}}));await assert.rejects(f.query());assert.match(f.text(),/分發曾於/);checks++;
}
for(const user of [null,{...actor.user,mustChangePassword:true},{...actor.user,role:'other'}]){const f=setup();f.identity(user?{user}:null);await assert.rejects(f.load());assert.equal(f.calls.length,0);checks++;}
{
 const f=setup();f.identity({user:{...actor.user,id:R,role:'admin'}});await f.adminLoad();assert.equal(f.nodes['deletion-admin-load'].hidden,false);assert.match(f.nodes['deletion-games'].children[0].children[0].textContent,/other-author/);await f.start();assert.equal(f.calls.filter(c=>c.path.endsWith('/deletion-preview')).length,1);assert.equal(f.posts()[0].value.confirmationName,'測試');assert.ok(f.journal.has('editor-deletion-operation:'+R));assert.equal(f.journal.has(key),false);checks++;
}
{const f=setup();assert.equal(f.nodes['deletion-admin-load'].hidden,true);await assert.rejects(f.adminLoad());assert.equal(f.calls.length,0);checks++;}
for(const bad of [{gameId:R,rowRevision:'4',confirmationName:'測試'},{gameId:G,rowRevision:'5',confirmationName:'測試'},{gameId:G,rowRevision:'4',confirmationName:'123456789'},{gameId:G,rowRevision:'4',confirmationName:'測試',extra:1},null]){
 const f=setup();f.identity({user:{...actor.user,role:'admin'}});await f.adminLoad();f.preview(async()=>bad);await assert.rejects(f.start());assert.equal(f.posts().length,0);assert.equal(f.dialogs.length,0);assert.equal(f.journal.size,0);checks++;
}
{const f=setup();f.identity({user:{...actor.user,role:'admin'}});await f.adminLoad();f.preview(async()=>{throw error(503,'UNAVAILABLE');});await assert.rejects(f.start());assert.equal(f.journal.size,0);assert.equal(f.dialogs.length,0);checks++;}
{
 const f=setup();f.identity({user:{...actor.user,role:'admin'}});await f.adminLoad();let release;f.preview(()=>new Promise(r=>{release=r;}));const running=f.start();f.identity(null);release({gameId:G,rowRevision:'4',confirmationName:'測試'});await running;assert.equal(f.posts().length,0);assert.equal(f.dialogs.length,0);checks++;
}
{
 const f=setup();f.identity({user:{...actor.user,role:'admin'}});await f.adminLoad();let release;f.preview(()=>new Promise(r=>{release=r;}));const first=f.start();f.preview(async()=>({gameId:G,rowRevision:'4',confirmationName:'測試'}));await f.start();release({gameId:G,rowRevision:'4',confirmationName:'測試'});await assert.rejects(first);assert.equal(f.posts().length,1);checks++;
}
process.stdout.write(JSON.stringify({checks,scope:'Actual deletion UI with owned DOM/session/transport seams; not physical purge or authority proof'})+'\n');
