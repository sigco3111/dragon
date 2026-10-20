<script setup>
import { ElButton } from 'element-plus/es/components/button/index.mjs';
const props = defineProps({ model: Object, actions: Object, busy: Boolean });
function chooseGame(event) { props.actions.selectGame(event.target.value); event.target.value = props.model.selected ?? ''; }
function chooseChapter(event) { props.actions.selectChapter(event.target.value); event.target.value = props.model.chapterId ?? ''; }
</script>

<template>
  <section id="stronghold-editor" class="module-card">
    <h3>據點（192 座鎖定；章節城 troops／prod 可寫）</h3>
    <p>基礎據點鎖定192座、槽位與座標凍結，不開放新增／改圖／刪除；章節城 troops／prod 在同記錄上限內可寫，其它字段不開放。刪除檢查只列出阻止項，不會刪除據點。</p>
    <div class="module-toolbar">
    <ElButton id="stronghold-refresh" :disabled="busy || model.locked" @click="actions.refresh()">讀取遊戲清單</ElButton>
    <label>遊戲<select id="stronghold-games" :value="model.selected ?? ''" :disabled="busy || model.locked" @change="chooseGame"><option v-for="game in model.games" :key="game.gameId" :value="game.gameId">{{ game.label }}</option></select></label>
    <ElButton id="stronghold-inspect" :disabled="busy || model.locked || !model.selected" @click="actions.inspect()">讀取據點表</ElButton>
    <label>章節<select id="stronghold-chapters" :value="model.chapterId ?? ''" :disabled="busy || model.locked" @change="chooseChapter"><option v-for="chapter in model.chapters" :key="chapter.chapterId" :value="chapter.chapterId">{{ chapter.name }}</option></select></label>
    </div>
    <p>{{ model.context }}<strong v-if="model.dirty">／有未保存數值</strong></p>
    <p id="stronghold-message" role="status">{{ model.message }}</p>
    <div id="stronghold-cities" class="entity-table-wrap" tabindex="0" aria-label="據點數值表"><table class="entity-table"><thead><tr><th>據點／引用</th><th>troops</th><th>prod</th><th>操作</th></tr></thead><tbody>
      <tr v-for="city in model.cities" :key="city.idx" :data-city-idx="city.idx">
        <td>#{{ city.idx }} {{ city.name }}／勢力 {{ city.faction }}<br>道路 {{ city.roadCount }}／章節 {{ city.chapterCount }}</td>
        <td><label>上限 {{ city.troopsCap ?? '?' }}<input type="number" min="0" :max="city.troopsCap" :value="city.troops" :data-city-idx="city.idx" data-field="troops" :disabled="busy || model.saveDisabled" @input="actions.edit(city.idx, 'troops', $event.target.value)"></label></td>
        <td><label>上限 {{ city.maxProd ?? '?' }}<input type="number" min="0" :max="city.maxProd" :value="city.prod" :data-city-idx="city.idx" data-field="prod" :disabled="busy || model.saveDisabled" @input="actions.edit(city.idx, 'prod', $event.target.value)"></label></td>
        <td><div class="account-row-actions"><ElButton :disabled="busy || model.saveDisabled" @click="actions.save(city.idx)">保存據點數值</ElButton><ElButton :disabled="busy || model.locked" @click="actions.blockers(city.idx)">刪除檢查</ElButton></div></td>
      </tr>
    </tbody></table></div>
  </section>
</template>
