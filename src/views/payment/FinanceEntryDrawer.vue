<template>
  <a-drawer :visible="visible" :title="kind === 'receipt' ? '添加回款' : '添加发票'" width="min(760px, 96vw)" :closable="!saving" :mask-closable="!saving" :keyboard="!saving" @close="close">
    <p>{{ projectName }}</p>
    <a-spin :spinning="loading">
      <a-alert v-if="loadError" type="error" show-icon :message="loadError"><template #action><a-button @click="load">重试</a-button></template></a-alert>
      <a-form v-else-if="summary" ref="formRef" :model="form" layout="vertical" :disabled="saving || attempted">
        <template v-if="kind === 'receipt'">
          <a-form-item label="回款类型" name="paymentRecordId" :rules="[{ required: true, message: '请选择回款项' }]">
            <a-select v-model:value="form.paymentRecordId" :options="planOptions" placeholder="请选择本分期合同回款项" />
          </a-form-item>
          <a-empty v-if="!summary.plans.length" description="该分期暂无回款计划，不能录入回款" />
          <div class="fields">
            <a-form-item label="计划应回款金额"><a-input :value="plan?.plannedAmount ?? '—'" disabled /></a-form-item>
            <a-form-item label="累计已回款金额"><a-input :value="plan?.actualAmount ?? '—'" disabled /></a-form-item>
          </div>
          <a-alert v-if="plan && Number(form.amount) > Number(plan.plannedAmount) - Number(plan.actualAmount)" type="warning" show-icon message="本次金额超过剩余应回款金额，确认后将按实际金额登记。" />
        </template>
        <template v-else>
          <a-form-item label="合同总价"><a-input :value="contractAmount ?? '—'" disabled /></a-form-item>
          <a-form-item label="累计已开票金额"><a-input :value="summary.invoicedAmount" disabled /></a-form-item>
          <a-form-item label="发票号" name="invoiceNo" :rules="[{ required: true, whitespace: true, message: '请输入发票号' }]"><a-input v-model:value="form.invoiceNo" :maxlength="100" /></a-form-item>
          <a-form-item label="开票类型" name="invoiceType"><a-select v-model:value="form.invoiceType" :options="invoiceTypeOptions" allow-clear placeholder="请选择开票类型" /></a-form-item>
        </template>
        <div class="fields">
          <a-form-item :label="kind === 'receipt' ? '本次回款金额' : '本次开票金额'" name="amount" :rules="[{ required: true, message: '请输入金额' }, { validator: validateAmount }]"><a-input-number v-model:value="form.amount" :min="0.01" :precision="2" /></a-form-item>
          <a-form-item :label="kind === 'receipt' ? '回款日期' : '开票日期'" name="date" :rules="[{ required: true, message: '请选择日期' }]"><a-date-picker v-model:value="form.date" value-format="YYYY-MM-DD" /></a-form-item>
        </div>
        <a-form-item :label="kind === 'receipt' ? '回款说明' : '备注'"><a-textarea v-model:value="form.remark" :rows="4" :maxlength="2000" show-count /></a-form-item>
        <a-form-item v-if="kind === 'invoice'" label="发票附件（最多1个，确认时上传）">
          <input :key="fileKey" type="file" aria-label="发票附件" :disabled="saving || attempted" @change="chooseFiles" />
          <div v-for="(file, index) in files" :key="index"><a-button type="link" class="file-preview" @click="previewFileInModal(file)">{{ file.name }}（预览）</a-button></div>
        </a-form-item>
      </a-form>
      <a-alert v-if="error" type="error" show-icon :message="error" />
      <a-alert v-if="attempted && !saving" type="warning" show-icon message="已发送过此笔登记。重试保留原请求编号和内容；若提示重复，请关闭后刷新记录核对，勿重新登记。" />
    </a-spin>
    <template #footer><a-space><a-button type="primary" :loading="saving" :disabled="loading || !!loadError || !summary || !allowed || (kind === 'receipt' && !summary.plans.length)" @click="save">{{ attempted ? '重试原提交' : '确认保存' }}</a-button><a-button :disabled="saving" @click="close">取消</a-button></a-space></template>
  </a-drawer>
</template>
<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
  import { useUserStore } from '/@/store/modules/user';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { loadDictOptions } from '/@/views/project/Project.data';
  import { addFinanceEntry, receiptSummary, uploadFinanceFile, type ReceiptSummary } from './Receipt.api';
  import { canRequestFinance, financePayload, financeRequestId, validateInvoiceContractAmount } from './receiptModel';
  import { contractDetail } from './Payment.api';
  import { previewFileInModal } from '/@/utils/filePreview';
  const emit = defineEmits(['saved']);
  const user = useUserStore();
  const allowed = computed(() => !!user.getIdentity.userId && canRequestFinance(user.getIdentity.roleCodes));
  const { createMessage } = useMessage();
  const visible = ref(false), loading = ref(false), saving = ref(false), attempted = ref(false);
  const kind = ref<'receipt' | 'invoice'>('receipt');
  const periodId = ref(''), projectName = ref(''), error = ref(''), loadError = ref('');
  const summary = ref<ReceiptSummary | null>(null), options = ref<any[]>([]), formRef = ref();
  const contractAmount = ref<number | null>(null);
  async function validateAmount(_rule: unknown, value: unknown) {
    if (kind.value === 'invoice' && value != null && value !== '') validateInvoiceContractAmount(value, contractAmount.value);
  }
  const files = ref<File[]>([]), fileKey = ref(0);
  const invoiceTypeOptions = ['普通发票', '专用发票'].map(value => ({ label: value, value }));
  const form = reactive({ paymentRecordId: undefined as string | undefined, invoiceType: undefined as string | undefined, invoiceNo: '', amount: undefined as number | undefined, date: '', remark: '' });
  let sequence = 0, requestId = '', submitted: Record<string, any> | null = null;
  const uploaded = new Map<File, string>();
  const plan = computed(() => summary.value?.plans.find(p => p.id === form.paymentRecordId));
  const planOptions = computed(() => summary.value?.plans.map(p => ({ value: p.id, label: options.value.find(o => String(o.value) === String(p.paymentNode))?.label || p.paymentNode })) || []);
  async function load() {
    const seq = ++sequence;
    loading.value = true; loadError.value = ''; summary.value = null; contractAmount.value = null;
    try {
      const [data, dict, contract] = await Promise.all([receiptSummary(periodId.value), loadDictOptions('payback_node'), kind.value === 'invoice' ? contractDetail({ periodId: periodId.value }, true) : Promise.resolve(null)]);
      if (seq !== sequence) return;
      if (kind.value === 'invoice') {
        validateInvoiceContractAmount(0, contract?.contractAmount);
        contractAmount.value = Number(contract.contractAmount);
      }
      summary.value = data; options.value = dict;
    } catch (e: any) { if (seq === sequence) loadError.value = e.message || '加载失败'; }
    finally { if (seq === sequence) loading.value = false; }
  }
  async function open(record: any, action: 'receipt' | 'invoice') {
    if (!allowed.value || saving.value) return;
    periodId.value = record.periodId; projectName.value = [record.projectName, record.periodName].filter(Boolean).join('-'); kind.value = action;
    Object.assign(form, { paymentRecordId: undefined, invoiceType: undefined, invoiceNo: '', amount: undefined, date: '', remark: '' });
    files.value = []; fileKey.value++; uploaded.clear(); submitted = null; requestId = financeRequestId();
    error.value = ''; attempted.value = false; visible.value = true;
    await nextTick(); formRef.value?.clearValidate(); await load();
  }
  function close() { if (saving.value) return; visible.value = false; sequence++; files.value = []; uploaded.clear(); }
  function chooseFiles(e: Event) {
    if (kind.value !== 'invoice' || saving.value || attempted.value) return;
    const chosen = Array.from((e.target as HTMLInputElement).files || []);
    if (chosen.length > 1 || chosen.some(f => f.size >= 419430400)) { error.value = '发票最多上传1个附件，文件须小于400MB'; files.value = []; fileKey.value++; return; }
    error.value = ''; files.value = chosen;
  }
  async function save() {
    if (saving.value || loading.value || !allowed.value || !summary.value) return;
    saving.value = true;
    try { await formRef.value?.validate(); } catch { saving.value = false; return; }
    error.value = '';
    const seq = sequence;
    try {
      if (!submitted) {
        if (kind.value === 'receipt' && !plan.value) throw new Error('请选择本分期回款项');
        financePayload(kind.value, periodId.value, form, requestId, []);
        if (kind.value === 'invoice') validateInvoiceContractAmount(form.amount, contractAmount.value);
        const paths: string[] = [];
        if (kind.value === 'invoice' && files.value.length > 1) throw new Error('发票最多上传1个附件');
        for (const file of kind.value === 'invoice' ? files.value : []) {
          if (!uploaded.has(file)) uploaded.set(file, await uploadFinanceFile(file));
          if (seq !== sequence || !allowed.value) return;
          paths.push(uploaded.get(file)!);
        }
        submitted = financePayload(kind.value, periodId.value, form, requestId, [...new Set(paths)]);
      }
      attempted.value = true;
      await addFinanceEntry(kind.value, submitted);
      if (seq !== sequence) return;
      createMessage.success('保存成功'); visible.value = false;
      emit('saved', { periodId: periodId.value, kind: kind.value });
    } catch (e: any) { if (seq === sequence) error.value = e.message || '保存失败'; }
    finally { saving.value = false; }
  }
  watch(() => user.getIdentity.userId, () => { sequence++; visible.value = false; summary.value = null; });
  onBeforeUnmount(() => { sequence++; });
  defineExpose({ open });
</script>
<style scoped>
  .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; margin-top: 16px; }
  .fields :deep(.ant-input-number), .fields :deep(.ant-picker) { width: 100%; }
  .file-preview { max-width: 100%; height: auto; white-space: normal; overflow-wrap: anywhere; text-align: left; }
  @media (max-width: 600px) { .fields { grid-template-columns: 1fr; } }
</style>
