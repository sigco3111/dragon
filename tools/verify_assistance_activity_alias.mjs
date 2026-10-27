// Isolated source-level regression. No original executable or campaign proof.
import assert from 'node:assert/strict';
import { beginScenarioAssistanceEvent, createNegotiationIo } from '../web/src/game/navigation/scenarionegotiation.js';
import { readScenarioFactionActivity351A } from '../web/src/game/navigation/scenariowarconsumer.js';
function fixture() {
 const records = Array.from({length:22},(_,idx)=>({idx,attr:128,diplomat_idx:null,monarch_idx:idx}));
 return { nativeFactionSlots:{version:1,records}, nativeDiplomacyMatrix:{version:1,rows:Array.from({length:24},()=>Array(24).fill(255))}, generals:Array.from({length:128},(_,idx)=>({idx,faction:null,status:0,ability:{politics:0}})), nativePlayerFactionPointer:4*64, player_faction:4 };
}
const sc=fixture(), rng={nextByte(){throw Error('unexpected RNG')}};
assert.equal(readScenarioFactionActivity351A(sc,24),255);
assert.equal(createNegotiationIo(sc,rng).readFactionAttr(24),255);
// 3771's first checked free-general scan finds no payer24 representative.
// Original qualification return occurs without money, faction or event edits.
const before=structuredClone(sc);
const result=beginScenarioAssistanceEvent(sc,{type:2,arg0:4,arg1:13,arg2:24},rng);
assert.equal(result.status,'qualification-failed');
assert.deepEqual(sc,before);
sc.nativeDiplomacyMatrix.rows[0][0]=127;
assert.equal(beginScenarioAssistanceEvent(sc,{type:2,arg0:4,arg1:13,arg2:24},rng).status,'ignored-inactive');
assert.equal(createNegotiationIo(sc,rng).readFactionAttr(22),0);
assert.equal(createNegotiationIo(sc,rng).readFactionAttr(23),0);
assert.throws(()=>createNegotiationIo(sc,rng).readFactionAttr(36),/alias address/);
assert.throws(()=>createNegotiationIo(sc,rng).readFactionAttr(-1),/attr index/);
assert.throws(()=>createNegotiationIo(sc,rng).writeFactionTarget(24,1),/slot/);
console.log('assistance351A: shared live alias, exact packet checked return, inactive gate, no state writes, spare slots, fail-closed unknown and write boundaries PASS');
