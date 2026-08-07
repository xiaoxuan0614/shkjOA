<template>
  <a-modal :open="open" :title="title" :footer="null" @cancel="handleCancel">
    <div style="text-align: center; padding: 30px 0">
      <a-empty description="AI生成提示词功能已下线" />
    </div>
  </a-modal>
</template>

<script setup>
  import { computed } from 'vue';
  const props = defineProps({
    open: { type: Boolean, default: false },
  });
  const emit = defineEmits(['update:open', 'success']);
  const title = computed(() => 'AI生成提示词');
  function handleCancel() {
    emit('update:open', false);
  }
</script>
