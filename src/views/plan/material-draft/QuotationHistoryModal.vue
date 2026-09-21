<template>
  <a-modal :open="open" title="报价操作记录" :width="1000" :footer="null" @cancel="emit('update:open', false)">
    <a-space style="margin-bottom: 12px"
      ><a-checkbox
        v-model:checked="wholePeriod"
        :disabled="loading"
        @change="
          pageNo = 1;
          load();
        "
        >查看本分期全部记录（含授权）</a-checkbox
      ><a-button :disabled="loading" @click="load">刷新</a-button></a-space
    >
    <a-alert v-if="error" :message="error" type="error" show-icon />
    <a-table :columns="columns" :data-source="rows" row-key="id" :loading="loading" :pagination="false" :scroll="{ y: 400, x: 900 }" size="small" />
    <a-space style="margin-top: 16px"
      ><a-button
        :disabled="loading || pageNo === 1"
        @click="
          pageNo--;
          load();
        "
        >上一页</a-button
      ><span>第 {{ pageNo }} 页</span
      ><a-button
        :disabled="loading || !!error || rows.length < pageSize"
        @click="
          pageNo++;
          load();
        "
        >下一页</a-button
      ></a-space
    >
  </a-modal>
</template>
<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { getQuotationHistory } from '../Plan.api';
  const props = defineProps<{ open: boolean; periodId: string; candidateId?: string }>();
  const emit = defineEmits(['update:open']);
  const rows = ref<Recordable[]>([]),
    loading = ref(false),
    error = ref(''),
    pageNo = ref(1),
    wholePeriod = ref(false);
  const pageSize = 20;
  const columns = [
    { title: '时间', dataIndex: 'createTime', width: 170 },
    { title: '操作人', dataIndex: 'actorName', width: 110 },
    { title: '动作', dataIndex: 'action', width: 150 },
    { title: '结果', dataIndex: 'result', width: 110 },
    { title: '原因', dataIndex: 'reason' },
  ];
  let sequence = 0;
  async function load() {
    const request = ++sequence;
    loading.value = true;
    error.value = '';
    rows.value = [];
    try {
      const result = await getQuotationHistory({
        periodId: props.periodId,
        ...(!wholePeriod.value && props.candidateId ? { candidateId: props.candidateId } : {}),
        pageNo: pageNo.value,
        pageSize,
      });
      if (!Array.isArray(result)) throw new Error('操作记录返回格式不正确');
      if (request === sequence) rows.value = result;
    } catch (e: any) {
      if (request === sequence) error.value = e?.message || '记录加载失败';
    } finally {
      if (request === sequence) loading.value = false;
    }
  }
  watch(
    () => [props.open, props.periodId, props.candidateId],
    () => {
      if (props.open) {
        pageNo.value = 1;
        wholePeriod.value = false;
        load();
      } else sequence++;
    }
  );
</script>
