<script setup>
import { computed, ref, watch } from 'vue';
import { ElButton } from 'element-plus/es/components/button/index.mjs';
const props = defineProps({ model: Object, actions: Object, busy: Boolean });
const filter = ref('');
watch(() => props.model.serial, () => { filter.value = ''; }, { flush: 'sync' });
const visible = computed(() => props.model.assets.filter(asset => asset.logicalURL.includes(filter.value.trim())));
</script>

<template>
  <section id="library-editor" class="module-card">
    <h3>精確修訂的只讀素材庫</h3>
    <p>只供管理員本人固定完整副本，固定庫須先由操作員裝配並經已有API驗證登記。可用資源不等於完整運行依賴；20個255引用仍未閉合。未保存資料不參與，不自動保存或讀latest，亦不播放、執行、上傳或補圖。</p>
    <p id="library-context">{{ model.context }}</p>
    <ElButton id="library-load" :disabled="busy || model.loadDisabled" @click="actions.load()">明確讀取已保存修訂素材庫</ElButton>
    <label>本目錄篩選<input id="library-filter" v-model="filter" maxlength="128" :disabled="busy || model.filterDisabled"></label>
    <p id="library-status" role="status">{{ model.message }}</p>
    <h4>可用bytes（核驗後下載，固定檔名）</h4>
    <div id="library-assets"><p v-for="asset in visible" :key="asset.assetId"><span>{{ asset.logicalURL }}／{{ asset.byteLength }} bytes／{{ asset.mime }} </span><ElButton :data-asset-id="asset.assetId" :disabled="busy || model.downloadDisabled" @click="actions.download(model.serial, asset.assetId)">核驗並下載bytes</ElButton></p></div>
    <p v-if="model.assets.length && !visible.length">沒有符合篩選的素材。</p>
    <h4>未閉合引用（無下載／補圖）</h4>
    <div id="library-missing"><p v-for="(item, index) in model.missing" :key="index">{{ item }}</p></div>
  </section>
</template>
