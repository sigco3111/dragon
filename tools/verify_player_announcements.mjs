// The old localhost/first-five/non-clickable assertions described the retired
// prototype, contradicting approved public-history policy. This is wiring only;
// catalog and public-entry browser suites exercise the actual interaction.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publicPlayerRequest } from '../web/src/player/playerpublic.js';
const menu = await readFile(new URL('../web/src/ui/startmenu.js',import.meta.url),'utf8');
const boot = await readFile(new URL('../web/src/boot.js',import.meta.url),'utf8');
const g='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';let checks=0;
for(const old of ['/api/published-games','/api/announcements','127.0.0.1:8322','_announcements.slice']){assert.ok(!menu.includes(old));checks++;}
assert.match(menu,/mountPublicCatalog\(document.body\)/);assert.match(menu,/if \(!selected\) return/);checks++;
for(const mode of ['new','load']){assert.ok(menu.includes(`navigatePlayerGame(this.selectedGame.gameId, "${mode}")`));assert.deepEqual(publicPlayerRequest(`?formalGame=${g}&mode=${mode}`),{gameId:g,mode});checks++;}
assert.match(boot,/if \(request\) await launchPublicPlayer/);assert.equal(publicPlayerRequest(''),null);checks++;
for(const value of ['?mode=load',`?formalGame=${g}`,`?formalGame=${g}&mode=other`,`?formalGame=${g}&mode=load&mode=new`,`?formalGame=${g}&mode=load&origin=https://elsewhere.invalid`,'?formalGame=wolong-builtin&mode=new']){assert.throws(()=>publicPlayerRequest(value),TypeError);checks++;}
process.stdout.write(JSON.stringify({checks,scope:'Current public wiring and strict query capture; browser suites provide UI/runtime proof.'})+'\n');
