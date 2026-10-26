import { localSaveRepository as repository } from '../core/localstore.js';
import { decodeSaveFile, encodeSaveFile, MAX_SAVE_FILE_BYTES } from '../core/saveexchange.js';
import { loadBuiltinContent } from '../content/catalog.js';
import { createWorldResources } from '../game/worldresources.js';

const status = document.querySelector('#status');
const rows = document.querySelector('#rows');
const file = document.querySelector('#file');
const importButton = document.querySelector('#import');
let contextPromise;
function context() {
  contextPromise ??= loadBuiltinContent().then((content) => ({
    content, data: content.data, world: createWorldResources(),
  })).catch((error) => { contextPromise = null; throw error; });
  return contextPromise;
}
function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function refresh() {
  const summaries = await repository.list();
  rows.replaceChildren();
  for (const summary of summaries.filter((entry) => entry.played)) {
    const row = document.createElement('tr');
    const date = summary.date;
    for (const text of [summary.slot + 1, summary.label,
      date ? `${date.year}/${date.month}/${date.day}` : '—']) {
      const cell = document.createElement('td');
      cell.textContent = String(text);
      row.append(cell);
    }
    const cell = document.createElement('td');
    const button = document.createElement('button');
    button.textContent = 'JSON 내보내기';
    button.onclick = () => run(async () => {
      const saved = await repository.get(summary.slot);
      download(await encodeSaveFile(saved, await context()), `wolong-save-${summary.slot + 1}.json`);
      status.textContent = '검증된 단일 파일 백업을 내보냈습니다.';
    });
    cell.append(button);
    row.append(cell);
    rows.append(row);
  }
  status.textContent = `${summaries.filter((entry) => entry.played).length} 개의 저장. 목록만 읽으며 스냅샷 본문은 불러오지 않습니다.`;
}
let busy = false;
async function run(operation) {
  if (busy) { return; }
  busy = true;
  document.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  try { await operation(); }
  catch (error) { status.textContent = `작업에 실패했습니다. 기존 저장을 덮어쓰지 않았습니다: ${error.message}`; }
  finally {
    busy = false;
    document.querySelectorAll('button').forEach((button) => { button.disabled = false; });
    importButton.disabled = !file.files?.length;
  }
}
file.onchange = () => { importButton.disabled = busy || !file.files?.length; };
importButton.onclick = () => run(async () => {
  const chosen = file.files?.[0];
  if (!chosen || chosen.size > MAX_SAVE_FILE_BYTES) { throw new TypeError('64 MiB 이하의 JSON 저장 파일을 선택하세요'); }
  const saved = await decodeSaveFile(await chosen.text(), await context());
  const created = await repository.add(saved);
  await refresh();
  status.textContent = `가져오기 완료. ${created.slot + 1}번 슬롯에 저장했습니다. 현재 게임을 시작하거나 바꾸지 않았습니다.`;
});
document.querySelector('#refresh').onclick = () => run(refresh);
void run(refresh);
