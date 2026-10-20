<script setup>
import { ElButton } from 'element-plus/es/components/button/index.mjs';
const props = defineProps({model:Object,actions:Object,busy:Boolean});
function choose(event, action, field) { props.actions[action](event.target.value); event.target.value = props.model[field] ?? ''; }
</script>
<template>
  <section id="generals-editor" class="module-card">
    <h2>武將（128 密排鎖定）</h2>
    <p>武將增刪鎖定 128 密排；改名／字與頭像綁定經草稿保存寫入。頭像取自共用庫（唯讀；武將一對一），不開放上傳或刪除。</p>
    <div class="module-toolbar">
      <ElButton id="generals-refresh" :disabled="busy || model.locked" @click="actions.refresh()">讀取遊戲清單</ElButton>
      <label>遊戲<select id="generals-games" :value="model.selected ?? ''" :disabled="busy || model.locked" @change="choose($event,'selectGame','selected')"><option v-for="g in model.games" :key="g.gameId" :value="g.gameId">{{ g.label }}</option></select></label>
      <ElButton id="generals-inspect" :disabled="busy || model.locked || !model.selected" @click="actions.inspect()">讀取武將表</ElButton>
      <label>章節<select id="generals-chapter" :value="model.chapterId ?? ''" :disabled="busy || model.locked" @change="choose($event,'selectChapter','chapterId')"><option v-for="c in model.chapters" :key="c.chapterId" :value="c.chapterId">{{ c.name }}</option></select></label>
    </div>
    <p id="generals-context">{{ model.context }}</p><p id="generals-message" role="status">{{ model.message }}</p>
    <h3>頭像資源庫（共用，唯讀）</h3>
    <div class="module-toolbar"><ElButton id="portrait-list" :disabled="busy || model.locked || !model.selected" @click="actions.listPortraits()">讀取資源庫</ElButton><label>選擇頭像<select id="portrait-pick" :value="model.portraitId ?? ''" :disabled="busy || model.locked || !model.library.length" @change="choose($event,'selectPortrait','portraitId')"><option v-for="p in model.library" :key="p.assetId" :value="p.assetId">{{ p.assetId }}</option></select></label></div>
    <details><summary>資源清單（{{ model.library.length }}）</summary><div id="portrait-library"><p v-for="p in model.library" :key="p.assetId">{{ p.assetId }}／{{ p.mime }}／{{ p.byteLength }}B／{{ p.inUse ? '使用中' : '未使用' }}</p></div></details>
    <div id="generals-chapters">
      <h3>勢力</h3><div class="entity-table-wrap"><table class="entity-table"><thead><tr><th>槽</th><th>君主</th><th>軍師</th><th>首都槽</th><th>操作</th></tr></thead><tbody>
        <tr v-for="f in model.factions" :key="model.chapterId + ':' + f.idx" :data-faction-idx="f.idx"><td>{{ f.idx }}</td><td>#{{ f.monarch }}</td><td>{{ f.advisor ?? '無' }}</td><td>{{ f.capital }}</td><td>
          <ElButton :disabled="busy || model.saveDisabled" @click="actions.faction('set-monarch',model.chapterId,f.idx)">立君主（須自由武將）</ElButton>
          <ElButton :disabled="busy || model.saveDisabled" @click="actions.faction('set-strategist',model.chapterId,f.idx)">設軍師／辭退</ElButton>
          <ElButton :disabled="busy || model.saveDisabled" @click="actions.faction('remove-monarch',model.chapterId,f.idx)">免君主（須繼任或解散）</ElButton>
          <ElButton :disabled="busy || model.saveDisabled" @click="actions.faction('disband-faction',model.chapterId,f.idx)">解散勢力</ElButton>
        </td></tr></tbody></table></div>
      <h3>武將</h3><div class="entity-table-wrap"><table class="entity-table"><thead><tr><th>槽</th><th>名</th><th>字</th><th>頭像</th><th>操作</th></tr></thead><tbody>
        <tr v-for="g in model.generals" :key="model.chapterId + ':' + g.idx" :data-general-idx="g.idx"><td>{{ g.idx }}</td><td>{{ g.name }}</td><td>{{ g.hao || '無' }}</td><td>{{ g.portraitKey ?? '原圖' }}</td><td>
          <ElButton :disabled="busy || model.saveDisabled" @click="actions.rename(model.chapterId,g.idx)">改名／字</ElButton>
          <ElButton :disabled="busy || model.saveDisabled" @click="actions.portrait(model.chapterId,g.idx)">{{ g.portraitKey ? '清除頭像綁定' : '綁定頭像' }}</ElButton>
          <ElButton :disabled="busy || model.saveDisabled" @click="actions.blockers(model.chapterId,g.idx)">刪除檢查</ElButton>
        </td></tr></tbody></table></div>
    </div>
  </section>
</template>
