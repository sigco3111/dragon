import { openStorage } from '../vps/sqlite-port.mjs';
import { exerciseListingOperations } from './fixtures/listing-operations.mjs';
const storage=openStorage(':memory:');
try {
 const {checks,binding}=exerciseListingOperations(storage);
 process.stdout.write(`listing operations: ${checks} legacy + ${binding.checks} distribution association groups; principal/callback seams, no HTTP/R2\n`);
} finally { storage.close(); }
