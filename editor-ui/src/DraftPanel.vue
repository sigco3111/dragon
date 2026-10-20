<script setup>
import { ElButton } from 'element-plus/es/components/button/index.mjs';
import { ElTag } from 'element-plus/es/components/tag/index.mjs';
defineProps({ model: Object, actions: Object, busy: Boolean });
function choose(event, actions, model) {
  actions.chooseGame(event.target.value);
  // A cancelled dirty switch must restore the native select immediately.
  event.target.value = model.fields.gameId;
}
</script>

<template>
  <section id="draft-editor" class="module-card">
    <h2>遊戲與章節草稿</h2>
    <p>先選遊戲並載入明確已保存修訂；清單刷新不會替換正在編輯的資料。</p>
    <div class="module-toolbar">
      <ElButton id="draft-games-refresh" :disabled="busy || model.locked" @click="actions.refresh()">查看自己的遊戲</ElButton>
      <label>遊戲<select id="draft-game" :value="model.fields.gameId" :disabled="busy || model.gameLocked" @change="choose($event, actions, model)"><option v-for="game in model.games" :key="game.gameId" :value="game.gameId">{{ game.name }}／清單修訂 {{ game.draftRevision }}</option></select></label>
      <label>明確已保存修訂<input id="draft-revision" inputmode="numeric" maxlength="64" :value="model.fields.revision" :disabled="busy || model.loadLocked" @input="actions.setField('revision', $event.target.value)"></label>
      <ElButton id="draft-load" :disabled="busy || model.loadLocked" @click="actions.load()">載入／放棄未保存資料</ElButton>
    </div>
    <p id="draft-context">{{ model.context ? `${model.context.gameId}／已保存修訂 ${model.context.draftRevision}${model.context.dirty ? '／有未保存修改' : ''}` : '未載入私有草稿' }}</p>
    <p id="draft-status" class="module-notice" role="status">{{ model.message }}</p>
    <form id="draft-save" class="module-form" @submit.prevent="actions.save()">
      <label>名稱<input id="draft-name" required maxlength="16" :value="model.fields.name" :disabled="busy || model.editLocked" @input="actions.setField('name', $event.target.value)"></label>
      <label>簡介<input id="draft-introduction" maxlength="40" :value="model.fields.introduction" :disabled="busy || model.editLocked" @input="actions.setField('introduction', $event.target.value)"></label>
      <p>名稱最多8字元、簡介20字元；保存時trim／NFC。只編輯資料，不改四資源或其他原生欄位。</p>
      <ElButton id="draft-save-button" type="primary" native-type="submit" :disabled="busy || model.editLocked">保存名稱／簡介</ElButton>
    </form>
    <div class="module-toolbar">
      <ElButton id="draft-operation-query" :disabled="busy || model.queryLocked" @click="actions.query()">查詢原保存操作</ElButton>
      <ElButton id="draft-operation-retry" :disabled="busy || model.retryLocked" @click="actions.retry()">明確重試原請求</ElButton>
    </div>
    <p>保存回應失去時不另起鍵或自動重試。重新載入只記操作鍵與目標修訂，不保留作者輸入；沒有原請求內容時不能重造同鍵保存。</p>
    <div class="module-toolbar">
      <label>試運行章<select id="draft-trial-chapter" :value="model.fields.chapterId" :disabled="busy || model.locked || !model.chapters.length" @change="actions.setField('chapterId', $event.target.value)"><option v-for="chapter in model.chapters" :key="chapter.chapterId" :value="chapter.chapterId">{{ chapter.name }}</option></select></label>
      <ElButton id="draft-trial-start" :disabled="busy || model.trialLocked" @click="actions.trial()">測試運行本章</ElButton>
    </div>
    <p>草稿試運行僅記憶體、不寫正式存檔；須已載入明確修訂且無未確認操作。</p>
    <h3>章節管理</h3>
    <p>新增空白／複製本遊戲章節（地圖共用，不產生獨立地圖）；刪除僅影響草稿；草稿可暫無章節，但屆時禁止發布。保存缺口擋保存，發布缺口擋發布／試運行。</p>
    <div id="draft-chapters">
      <div v-for="chapter in model.chapters" :key="chapter.chapterId" class="chapter-row" :data-chapter-id="chapter.chapterId">
        <div><strong>{{ chapter.name }}</strong><p>{{ chapter.chapterId }}</p><ElTag effect="plain">保存缺口 {{ chapter.gaps.saveGaps }}／發布缺口 {{ chapter.gaps.activeGaps }}</ElTag></div>
        <div class="module-toolbar">
          <ElButton :disabled="busy || model.editLocked" @click="actions.chapter('copy', chapter.chapterId)">複製本章</ElButton>
          <ElButton :disabled="busy || model.editLocked" @click="actions.chapter('rename', chapter.chapterId)">改名</ElButton>
          <ElButton :disabled="busy || model.editLocked" @click="actions.chapter('delete', chapter.chapterId)">刪除本章</ElButton>
        </div>
      </div>
      <p v-if="!model.chapters.length" class="empty-state">尚未載入章節，或此修訂沒有章節。</p>
      <ElButton :disabled="busy || model.editLocked" @click="actions.chapter('add-blank')">新增空白章節</ElButton>
    </div>
    <h3>章與四資源（只讀）</h3>
    <p>數值表示安全不代表可玩範圍；此處沒有資源編輯控件。</p>
    <div id="draft-resources"><details v-for="chapter in model.resources" :key="chapter.chapterId"><summary>{{ chapter.name }}</summary><p v-for="(faction, index) in chapter.factions" :key="index">槽 {{ faction.slot }}：資金 {{ faction.money }}／騎兵 {{ faction.reserve_cav }}／弓兵 {{ faction.reserve_arc }}／步兵 {{ faction.reserve_inf }}</p></details></div>
  </section>
</template>
