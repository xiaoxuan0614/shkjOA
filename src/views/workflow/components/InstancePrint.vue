<template>
  <a-modal :open="open" title="打印审批单" width="800px" @cancel="emit('close')">
    <div ref="paper" class="print-paper" v-if="data">
      <h1>{{ data.instance.title || processName(data.instance) }}</h1>
      <p>流程：{{ processName(data.instance) }}</p
      ><p>申请轮次：第 {{ data.instance.roundNo }} 轮 · {{ roundLabel(data.instance.latestRound) }}</p>
      <p>申请编号：{{ data.instance.businessId }} · 版本：{{ data.instance.version }} · 轮次：{{ data.instance.roundNo }}</p>
      <dl
        ><template v-for="field in visibleFields" :key="field.key"
          ><dt>{{ field.name }}</dt
          ><dd>{{ displayValue(field.key) }}</dd></template
        ></dl
      >
      <h2>审批记录</h2>
      <p v-for="(item, index) in data.instance.history" :key="index"
        >{{ item.actor_name || item.actor_id }} · {{ item.action }} · {{ item.comment_text }} · {{ item.created_at }}</p
      >
    </div>
    <template #footer
      ><a-button @click="emit('close')">关闭</a-button><a-button type="primary" :disabled="!data" @click="print">打印</a-button></template
    >
  </a-modal>
</template>
<script setup lang="ts">
  import { processName, roundLabel } from '../instancePresentation';
  import { computed, ref } from 'vue';
  import type { printInstance } from '../Workflow.api';
  const props = defineProps<{ open: boolean; data?: Awaited<ReturnType<typeof printInstance>> }>();
  const emit = defineEmits(['close']);
  const paper = ref<HTMLElement>();
  const visibleFields = computed(() => props.data?.form.fields.filter((f) => props.data?.form.fieldPermissions?.[f.key] !== 'HIDDEN') || []);
  function displayValue(key: string) {
    const value = key.split('.').reduce((data: any, part) => data?.[part], props.data?.instance.snapshot);
    return value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  function print() {
    if (!paper.value) return;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) {
      frame.remove();
      return;
    }
    doc.open();
    doc.write(
      '<!doctype html><html><head><title>审批单</title><style>body{font:14px sans-serif;padding:24px}h1{font-size:22px}dt{font-weight:bold;margin-top:16px}dd{margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body></body></html>'
    );
    doc.close();
    doc.body.appendChild(paper.value.cloneNode(true));
    frame.contentWindow?.addEventListener('afterprint', () => frame.remove(), { once: true });
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60000);
  }
</script>
<style scoped>
  .print-paper {
    padding: 24px;
  }
  dt {
    font-weight: 600;
    margin-top: 16px;
  }
  dd {
    margin: 6px 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
