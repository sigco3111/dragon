<script setup>
import { ElButton } from 'element-plus/es/components/button/index.mjs';
defineProps({ model: Object, actions: Object, busy: Boolean });
</script>
<template>
  <section id="deletion-editor" class="module-card">
    <h3>遊戲刪除請求與追蹤</h3>
    <p>創作者僅可刪除自己的自建遊戲；管理員可另讀全局清單，按目標ID、創作者、目前名稱及原修訂確認跨作者刪除，不取得內容編輯或草稿讀取權。已上架須先由管理員下架。此步建立不可逆刪除柵欄，不是物理清理完成。歷史內容、專屬資源及備份的完整清理尚未就緒；不刪玩家本地存檔。</p>
    <ElButton id="deletion-load" :disabled="busy || model.locked" @click="actions.refresh()">明確讀取自己的刪除目標</ElButton>
    <ElButton id="deletion-admin-load" :hidden="!model.admin" :disabled="busy || model.locked || !model.admin" @click="actions.managed()">管理員明確讀取全局刪除目標</ElButton>
    <div id="deletion-games"><div v-for="game in model.games" :key="game.gameId" :data-game-id="game.gameId"><p>{{ game.label }}</p><ElButton :disabled="busy || game.disabled" :title="game.title" @click="actions.start(game.gameId, game.rowRevision)">提出刪除請求</ElButton></div></div>
    <p id="deletion-operation">{{ model.operation }}</p>
    <ElButton id="deletion-query" :disabled="busy || model.queryDisabled" @click="actions.query()">查詢原刪除請求與分發</ElButton>
    <ElButton id="deletion-retry" :disabled="busy || model.retryDisabled" @click="actions.retry()">明確以原鍵原名稱原修訂重試</ElButton>
    <ElButton id="deletion-forget" :disabled="busy || model.forgetDisabled" @click="actions.forget()">只停止本機刪除追蹤</ElButton>
    <p id="deletion-result">{{ model.result }}</p><p id="deletion-message" role="status">{{ model.message }}</p>
    <p>本分頁保留原請求鍵與確認名稱，不保存憑據。刷新不自動查詢或重送；404不表示取消。已知提交後不開放重送；分發確認也不代表物理清理完成。停止追蹤不取消在途請求。</p>
  </section>
</template>
