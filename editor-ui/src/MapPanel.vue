<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { ElButton } from 'element-plus/es/components/button/index.mjs';
const props = defineProps({model:Object,actions:Object,busy:Boolean});
const canvas = ref(null);
onMounted(() => props.actions.attachCanvas(canvas.value));
onBeforeUnmount(() => props.actions.attachCanvas(null));
function choose(event) { props.actions.select(event.target.value); event.target.value = props.model.selected ?? ''; }
</script>
<template>
  <section id="mapview-editor" class="module-card">
    <h2>地圖（唯讀示意）</h2>
    <p>放置192鎖定、道路拓撲章節釘死、圖塊語義未審計，編輯尚未開放；下圖僅顯示放置與道路幾何。拓撲意向是獨立查詢，不代表執行遷移、保存或發布准入。</p>
    <div class="module-toolbar">
      <ElButton id="mapview-refresh" :disabled="busy || model.locked" @click="actions.refresh()">讀取遊戲清單</ElButton>
      <label>遊戲<select id="mapview-games" :value="model.selected ?? ''" :disabled="busy || model.locked" @change="choose"><option v-for="game in model.games" :key="game.gameId" :value="game.gameId">{{ game.label }}</option></select></label>
      <ElButton id="mapview-inspect" :disabled="busy || model.locked || !model.selected" @click="actions.inspect()">讀取地圖</ElButton>
    </div>
    <p>{{ model.context }}</p>
    <!-- Vue owns the element lifetime only; native code owns every pixel. -->
    <canvas ref="canvas" id="mapview-canvas" width="384" height="256" aria-label="唯讀據點與道路示意圖"></canvas>
    <p id="mapview-message" role="status">{{ model.message }}</p>
    <div id="mapview-roads" class="entity-table-wrap" tabindex="0" aria-label="道路唯讀描述"><p v-for="(line,index) in model.lines" :key="index">{{ line }}</p></div>
  </section>
</template>
