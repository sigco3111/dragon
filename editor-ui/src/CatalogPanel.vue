<script setup>
import { ElButton } from 'element-plus/es/components/button/index.mjs';
defineProps({model:Object,actions:Object,busy:Boolean});
</script>
<template>
  <section id="catalog-editor" class="module-card">
    <h2>固定素材庫運維登記</h2>
    <p>操作員須先以 --stage-library 裝配固定可用庫；這不是來源完整複製、作者上傳或運行准入。驗證登記重讀全部實際R2物件，只記庫事實，20個未閉合引用保持未知。非Q69／Trial／發布。</p>
    <div class="module-toolbar">
      <ElButton id="catalog-read" :disabled="busy || model.readDisabled" @click="actions.read()">明確查看庫事實／原關聯</ElButton>
      <ElButton id="catalog-install" :disabled="busy || model.installDisabled" @click="actions.install()">建立本次驗證登記請求</ElButton>
      <ElButton id="catalog-replay" :disabled="busy || model.replayDisabled" @click="actions.replay()">明確同鍵重放驗證</ElButton>
      <ElButton id="catalog-forget" :disabled="busy || model.forgetDisabled" @click="actions.forget()">只放棄本機原鍵關聯</ElButton>
    </div>
    <p id="catalog-state">{{ model.state }}</p>
    <p id="catalog-operation">{{ model.operation }}</p>
    <p id="catalog-message" role="status">{{ model.message }}</p>
    <p>未知回應先查事實，再用原鍵與固定空body明確重放；registered不證明原鍵曾執行。重載不自動請求，放棄本機關聯不取消SQL操作或回滾。目錄／帳戶版本變動禁止重放；真正epoch與權限仍由服務判定。</p>
  </section>
</template>
