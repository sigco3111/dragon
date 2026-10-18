// Canonical browser source tree; compatibility exports must share identities.
import assert from 'node:assert/strict';
import {readFileSync, realpathSync} from 'node:fs';
import {dirname, resolve, relative} from 'node:path';
import {pathToFileURL} from 'node:url';
const names=['playerclient','playerenvironment','playerpack','playerrepository','playersaves','runtimecontract'];
const root=realpathSync('web/src'), visited=new Set();let checks=0;
function visit(file){
 const path=realpathSync(file), local=relative(root,path);
 assert.ok(local&&!local.startsWith('..')&&!local.includes(':'),'browser dependency stays in web/src');
 if(visited.has(path))return;visited.add(path);
 const source=readFileSync(path,'utf8');
 for(const match of source.matchAll(/^\s*(?:import|export)\b\s*(?:[^;'\"]*?\bfrom\s*)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/gm)){
  const spec=match[1]??match[2];assert.ok(spec.startsWith('.'),'native relative browser import: '+spec);
  visit(resolve(dirname(path),spec));
 }
}
for(const name of names){
 const canonical=resolve('web/src/player/'+name+'.js'),compatibility=resolve('reader/'+name+'.js');
 assert.equal(readFileSync(compatibility,'utf8'),`// Compatibility export; the public Web tree owns the single implementation.\nexport * from '../web/src/player/${name}.js';\n`);
 const [current,old]=await Promise.all([import(pathToFileURL(canonical).href),import(pathToFileURL(compatibility).href)]);
 assert.deepEqual(Object.keys(old),Object.keys(current));
 for(const key of Object.keys(current))assert.equal(old[key],current[key],name+':'+key);
 checks++;visit(canonical);
}
assert.ok(visited.size>6);checks++;
process.stdout.write(JSON.stringify({checks,modules:names.length,staticModuleClosure:visited.size,scope:'Literal ESM module dependencies and shared export identity only; not lazy resource, production admission or cloud proof.'})+'\n');
