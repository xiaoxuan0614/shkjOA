<template>
  <div class="ding-ding-container" :class="[`${prefixCls}`]">
    <ThirdAppWeEnterpriseConfigForm />
  </div>
</template>

<script lang="ts">
  import { defineComponent } from 'vue';
  import ThirdAppWeEnterpriseConfigForm from './ThirdAppWeEnterpriseConfigForm.vue';
  import { useDesign } from '/@/hooks/web/useDesign';

  export default defineComponent({
    name: 'ThirdAppConfigList',
    components: {
      ThirdAppWeEnterpriseConfigForm,
    },
    setup() {
      const { prefixCls } = useDesign('j-dd-container');

      return {
        prefixCls,
      };
    },
  });
</script>

<style lang="less" scoped>
  .ding-ding-container {
    border-radius: 4px;
    height: calc(100% - 80px);
    margin: 16px;
  }
</style>

<style lang="less">
  /* update-begin-author:liusq date:20230625 for: [issues/563]暗色主题部分失效*/
  @prefix-cls: ~'@{namespace}-j-dd-container';
  /*begin 兼容暗色模式*/
  .@{prefix-cls} {
    background: @component-background;
  }
  /*end 兼容暗色模式*/
/* update-end-author:liusq date:20230625 for: [issues/563]暗色主题部分失效*/
</style>
