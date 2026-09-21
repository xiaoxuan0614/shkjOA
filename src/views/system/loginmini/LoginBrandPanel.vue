<template>
  <section class="login-brand-panel" aria-label="首汇科技管理系统">
    <div class="brand-heading">
      <img class="brand-symbol" :src="logoUrl" alt="首汇科技 Logo" />
      <div><h1>首汇科技管理系统</h1><p>SHOUHUI TECHNOLOGY MANAGEMENT SYSTEM</p></div>
    </div>
    <img :src="officeIllustration" alt="蓝色安全盾牌与钥匙插画" width="500" height="500" />
  </section>
</template>

<script lang="ts" setup>
  import officeIllustration from '/@/assets/loginmini/security-shield.webp';
  const logoUrl = `${import.meta.env.BASE_URL}logo.png?v=20260916`;
</script>

<style lang="less" scoped>
  .login-brand-panel {
    padding: 12px 0;
    .brand-heading {
      display: flex;
      align-items: center;
      gap: 14px;
      margin: 0 0 35px 25px;
    }
    img.brand-symbol {
      flex: 0 0 46px;
      width: 46px;
      height: 46px;
      object-fit: contain;
    }
    h1 {
      margin: 0;
      color: #303747;
      font-size: clamp(24px, 2.2vw, 30px);
      font-weight: 600;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    p {
      margin: 4px 0 0;
      color: #627889;
      font-size: 10px;
      letter-spacing: 0.08em;
    }
    img {
      display: block;
      width: 100%;
      max-width: 410px;
      height: auto;
      margin-left: 0;
    }
  }
</style>
