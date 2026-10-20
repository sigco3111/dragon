<script setup>
import { ElButton } from 'element-plus/es/components/button/index.mjs';
defineProps({ state: Object, ready: Boolean });
</script>

<template>
  <div class="account-card" :hidden="!state.mustChange && state.view !== 'password'">
    <h1 v-if="state.mustChange">設定你的新密碼</h1>
    <p v-if="state.mustChange" class="muted">首次登入或管理員重設後，須先變更密碼才能進入工作台。</p>
    <form id="password">
      <p>至少9個字元（最多128個），須包含大寫字母、小寫字母、數字及符號；空白不算符號。</p>
      <label>目前密碼<input name="oldPassword" type="password" autocomplete="current-password" required maxlength="128"></label>
      <label>新密碼<input name="newPassword" type="password" autocomplete="new-password" minlength="9" maxlength="128" required></label>
      <label>確認新密碼<input name="confirmPassword" type="password" autocomplete="new-password" required maxlength="128"></label>
      <ElButton type="primary" native-type="submit" :loading="state.busy">變更密碼</ElButton>
    </form>
  </div>
  <div class="account-card" :hidden="!ready || state.view !== 'profile'">
    <form id="profile"><p>選填，不向玩家公開；帳戶名稱不可變更。</p>
      <label>姓名<input name="displayName" maxlength="128" autocomplete="name"></label>
      <label>郵箱<input name="email" maxlength="128" autocomplete="email"></label>
      <label>電話<input name="phone" maxlength="128" autocomplete="tel"></label>
      <label>備註<input name="note" maxlength="128"></label>
      <ElButton type="primary" native-type="submit" :loading="state.busy">保存資料</ElButton>
    </form><p id="profile-status" role="status"></p>
  </div>
</template>
