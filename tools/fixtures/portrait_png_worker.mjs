// Test-only real SQLite DO. Actors/game rows are explicit fixtures, NOT real
// account/session API evidence. Uses the unchanged production GamePortraits.
import { DurableObject } from 'cloudflare:workers';
import { createHash } from 'node:crypto';
import { GamePortraits } from '../../server/portraits.js';
import { HttpError } from '../../server/security.js';
const GAME = '11111111-1111-4111-8111-111111111111';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export class PortraitPNGFixture extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.storage.transactionSync(() => {
      this.sql.exec('CREATE TABLE IF NOT EXISTS content_games (game_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL)');
      this.sql.exec('INSERT OR IGNORE INTO content_games VALUES(?,?)', GAME, 'owner');
    });
    this.library = new GamePortraits({ storage: ctx.storage, principal: token => {
      if (token === 'invalid') { throw new HttpError(401, 'SESSION_INVALID'); }
      return { id: token === 'foreign' ? 'foreign' : 'owner', must_change: token === 'change' };
    }, reservedIds: ['terrain'] });
  }
  snapshot() {
    return this.sql.exec('SELECT * FROM game_portraits ORDER BY asset_id').toArray().map(row => ({ ...row, bytes: sha(Buffer.from(row.bytes)) }));
  }
  async fetch(request) {
    const input = await request.json();
    const before = this.snapshot();
    try {
      const entry = this.library.upload(input.actor ?? 'owner', input.gameId ?? GAME, input.assetId, Buffer.from(input.dataBase64, 'base64'));
      const stored = this.library.forPublish(GAME).find(row => row.assetId === entry.assetId);
      return Response.json({ entry, stored: { ...stored, bytes: Buffer.from(stored.bytes).toString('base64') }, before, after: this.snapshot() });
    } catch (error) {
      if (!(error instanceof HttpError)) { throw error; }
      return Response.json({ error: error.code, before, after: this.snapshot() }, { status: error.status });
    }
  }
}
export default { fetch(request, env) { return env.PORTRAIT_PNG.get(env.PORTRAIT_PNG.idFromName('owned-test')).fetch(request); } };
