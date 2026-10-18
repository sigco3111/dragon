// Cloudflare adapter only. Keep the application and HTTP/auth contract shared
// with the Node entry; the platform base still supplies Durable Object RPC.
import { DurableObject } from 'cloudflare:workers';
import { createEditorApplication } from './editorapp.js';
export const EditorMetadata = createEditorApplication(DurableObject);
export { default } from './editorapp.js';
