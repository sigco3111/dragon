// Real SQLite DO adapter around explicit test-only ports. Not a Root API lane.
import { DurableObject } from 'cloudflare:workers';
import worldManifest from '../../server/pinned/world-manifest.txt';
import entityManifest from '../../server/pinned/entity-manifest.txt';
import { installedSourcePolicy } from '../../server/sourcecatalogpolicy.js';
import { trialPortraitFixture } from './trial_portrait_fixture.mjs';
export class TrialPortraitPNGFixture extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.call = trialPortraitFixture(ctx.storage, installedSourcePolicy(Buffer.from(worldManifest, 'utf8'), Buffer.from(entityManifest, 'utf8')));
  }
  async fetch(request) {
    const result = this.call(await request.json());
    return Response.json(result, { status: result.status });
  }
}
export default { fetch(request, env) { return env.TRIAL_PNG.get(env.TRIAL_PNG.idFromName('owned-test')).fetch(request); } };
