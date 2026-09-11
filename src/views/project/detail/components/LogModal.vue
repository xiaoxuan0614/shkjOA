<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    destroyOnClose
    title="实施记录详情"
    :width="1000"
    :footer="null"
    @visible-change="handleVisibleChange"
  >
    <ImplementLogDetailContent v-if="context" :key="context.key" :period-id="context.periodId" :log-id="context.logId" embedded />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import ImplementLogDetailContent from '/@/views/implement/components/ImplementLogDetailContent.vue';
  const context = ref<{ key: number; periodId: string; logId: string }>();
  let key = 0;
  const [register] = useModalInner((data) => {
    context.value = { key: ++key, periodId: String(data?.periodId || ''), logId: String(data?.logId || '') };
  });
  function handleVisibleChange(visible: boolean) {
    if (!visible) context.value = undefined;
  }
</script>
