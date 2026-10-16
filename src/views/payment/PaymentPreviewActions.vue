<template>
  <a-drawer :visible="!!mode" :title="title" width="min(760px, 96vw)" @close="close">
    <a-alert type="warning" show-icon message="模拟录入：仅保留在当前预览中，刷新或离开预览后重置；附件不会上传。" />
    <p class="project-name">{{ row?.projectLabel }}</p>
    <a-form layout="vertical" :model="form" ref="formRef">
      <template v-if="mode === 'payment'">
        <a-form-item label="回款类型" name="planId" :rules="[{ required: true, message: '请选择回款类型' }]">
          <a-select v-model:value="form.planId" placeholder="请选择该分期合同回款项" :options="plans" />
        </a-form-item>
        <div class="fields">
          <a-form-item label="计划应回款金额"><a-input :value="plan?.planAmount ?? '—'" disabled /></a-form-item>
          <a-form-item label="累计已回款金额"><a-input :value="plan?.paidAmount ?? '—'" disabled /></a-form-item>
          <a-form-item label="剩余应回款金额"><a-input :value="plan?.unpaidAmount ?? '—'" disabled /></a-form-item>
          <a-form-item label="本次回款金额" name="amount" :rules="amountRules"><a-input-number v-model:value="form.amount" :min="0.01" :precision="2" /></a-form-item>
          <a-form-item label="回款日期" name="date" :rules="dateRules"><a-date-picker v-model:value="form.date" value-format="YYYY-MM-DD" /></a-form-item>
        </div>
      </template>
      <template v-else>
        <a-form-item label="发票类型（模拟选项）" name="type" :rules="[{ required: true, message: '请选择发票类型' }]">
          <a-select v-model:value="form.type" placeholder="请选择发票类型" :options="[{label:'专票',value:'专票'},{label:'普票',value:'普票'}]" />
        </a-form-item>
        <div class="fields">
          <a-form-item label="累计已开票金额"><a-input :value="invoiced" disabled /></a-form-item>
          <a-form-item label="本次开票金额" name="amount" :rules="amountRules"><a-input-number v-model:value="form.amount" :min="0.01" :precision="2" /></a-form-item>
          <a-form-item label="发票号" name="number" :rules="[{ required: true, whitespace: true, message: '请输入发票号' }]"><a-input v-model:value="form.number" :maxlength="80" /></a-form-item>
          <a-form-item label="开票日期" name="date" :rules="dateRules"><a-date-picker v-model:value="form.date" value-format="YYYY-MM-DD" /></a-form-item>
        </div>
      </template>
      <a-form-item :label="mode === 'payment' ? '回款说明' : '备注'"><a-textarea v-model:value="form.remark" :rows="4" :maxlength="500" show-count /></a-form-item>
      <a-form-item v-if="mode === 'invoice'" label="附件（仅本地选择）">
        <input :key="fileKey" type="file" aria-label="发票附件" @change="chooseFile" />
        <div v-if="file">{{ file.name }} <a-button type="link" @click="clearFile">移除</a-button></div>
      </a-form-item>
      <a-alert v-if="error" type="error" show-icon :message="error" />
    </a-form>
    <template #footer><a-space><a-button type="primary" @click="save">确定（模拟保存）</a-button><a-button @click="close">取消</a-button></a-space></template>
  </a-drawer>
</template>
<script setup lang="ts">
  import { computed, nextTick, reactive, ref } from 'vue';
  import { recordPreviewPayment, type PaymentPreviewRecord } from './paymentPreview';
  const emit = defineEmits(['saved']);
  const row = ref<PaymentPreviewRecord | null>(null);
  const mode = ref<'payment' | 'invoice' | ''>('');
  const title = computed(() => mode.value === 'payment' ? '添加回款' : '添加发票');
  const form = reactive({ planId: undefined as string | undefined, type: undefined as string | undefined, amount: undefined as number | undefined, date: '', number: '', remark: '' });
  const formRef = ref();
  const error = ref('');
  const file = ref<File | null>(null);
  const fileKey = ref(0);
  const plans = computed(() => row.value?.records.map((item) => ({ label: item.type, value: item.id })) || []);
  const plan = computed(() => row.value?.records.find((item) => item.id === form.planId));
  const invoiced = computed(() => (row.value?.invoices.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) || 0) / 100);
  const amountRules = [{ required: true, message: '请输入金额' }];
  const dateRules = [{ required: true, message: '请选择日期' }];
  function clearFile() { file.value = null; fileKey.value++; }
  function chooseFile(event: Event) { file.value = (event.target as HTMLInputElement).files?.[0] || null; }
  async function open(record: PaymentPreviewRecord, action: 'payment' | 'invoice') {
    row.value = record;
    Object.assign(form, { planId: undefined, type: undefined, amount: undefined, date: '', number: '', remark: '' });
    error.value = ''; clearFile(); mode.value = action;
    await nextTick(); formRef.value?.clearValidate();
  }
  function close() { mode.value = ''; row.value = null; clearFile(); }
  async function save() {
    error.value = '';
    try { await formRef.value?.validate(); } catch { return; }
    if (!row.value) return;
    try {
      const amount = Number(form.amount);
      if (mode.value === 'payment') recordPreviewPayment(row.value, form.planId || '', amount, form.date, form.remark.trim());
      else {
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('开票金额必须大于0');
        if (row.value.invoices.some((item) => item.number === form.number.trim())) throw new Error('该分期已存在相同发票号');
        row.value.invoices.push({ id: `invoice-${row.value.invoices.length}`, type: form.type!, number: form.number.trim(), amount: Math.round(amount * 100) / 100, date: form.date, remark: form.remark.trim(), files: file.value ? [file.value] : [] });
      }
      emit('saved'); close();
    } catch (e: any) { error.value = e.message; }
  }
  defineExpose({ open });
</script>
<style scoped>
  .project-name { margin: 16px 0; font-weight: 600; }
  .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
  .fields :deep(.ant-input-number), .fields :deep(.ant-picker) { width: 100%; }
  @media (max-width: 600px) { .fields { grid-template-columns: 1fr; } }
</style>
