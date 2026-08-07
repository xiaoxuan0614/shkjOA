<template>
  <a-modal :open="open" :title="title" :footer="null" @cancel="handleCancel">
    <div style="text-align: center; padding: 30px 0">
      <a-empty description="知识库新增功能已下线" />
    </div>
  </a-modal>
</template>

<script setup>
  import { computed } from 'vue';
  const props = defineProps({
    open: { type: Boolean, default: false },
    appId: { type: String, default: '' },
  });
  const emit = defineEmits(['update:open', 'success']);
  const title = computed(() => '新增知识库');
  function handleCancel() {
    emit('update:open', false);
  }
</script>
