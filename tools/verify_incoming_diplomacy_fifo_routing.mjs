// UI routing regression, no native executable/campaign certification.
import assert from 'node:assert/strict';
import { GameBar } from '../web/src/ui/gamebar.js';
for (const type of ['incoming-truce','incoming-assistance']) {
 let shown=null, commits=0;
 const payload={type,requesterFaction:{idx:1},result:{outcome:1},nativeDecision:{resolveChoice(){return {outcome:2}}},onResolve(){commits++}};
 const g={_strategicMessageQueue:[],_scenarioUiGeneration:0,_canShowStrategicMessage(){return true},syncClock(){},async _showIncomingDiplomacyRequest(p){shown=p;return true},_drainStrategicMessages(){}};
 GameBar.prototype.enqueueIncomingDiplomacyRequest.call(g,payload);
 assert.equal(g._strategicMessageQueue[0].type,'incoming-diplomacy');
 assert.equal(g._strategicMessageQueue[0].diplomacyType,type);
 await GameBar.prototype._drainStrategicMessages.call(g);
 assert.equal(shown.type,type);assert.equal(shown.nativeDecision,payload.nativeDecision);
 assert.equal(shown.onResolve,payload.onResolve);assert.equal(g._strategicMessageQueue.length,0);assert.equal(commits,0);
 shown.onResolve();assert.equal(commits,1);
}
console.log('incoming diplomacy FIFO: both types reach native decision UI with original choice/commit callbacks PASS');
