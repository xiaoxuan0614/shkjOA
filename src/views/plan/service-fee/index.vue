<template>
  <div class="service-fee-page" :class="{ 'service-fee-page--embedded': embedded }">
    <div class="service-fee-page__toolbar">
      <h2 v-if="!embedded">服务费维护</h2>
      <a-input-search v-model:value="keyword" placeholder="搜索费用名称" aria-label="搜索费用名称" allow-clear :loading="loading" @search="search" />
      <a-button v-if="hasPermission('mtl:serviceFee:add')" type="primary" :disabled="saving" @click="openForm()">新增服务费</a-button>
    </div>
    <a-alert v-if="error" type="error" :message="error" show-icon><template #action><a-button size="small" @click="load">重试</a-button></template></a-alert>
    <a-table
row-key="id" bordered :columns="columns" :data-source="rows" :loading="loading" :scroll="{ x: 800 }"
      :pagination="{ current: page, pageSize: 10, total, showSizeChanger: false, showTotal: n => `共 ${n} 条` }" @change="changePage">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'markupRate'">{{ record.markupRate ?? '—' }}%</template>
        <template v-else-if="column.key === 'costPrice'">{{ record.costPrice == null ? '—' : Number(record.costPrice).toFixed(2) }}</template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" :disabled="saving || formLoading" @click="openForm(record.id, true)">详情</a-button>
            <a-button v-if="hasPermission('mtl:serviceFee:edit')" type="link" :disabled="saving || formLoading" @click="openForm(record.id)">编辑</a-button>
            <a-popconfirm v-if="hasPermission('mtl:serviceFee:delete')" title="删除公共服务费？已保存的报价不受影响。" @confirm="remove(record.id)"><a-button type="link" danger :disabled="saving">删除</a-button></a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
    <a-modal
v-model:open="formOpen" :title="formReadonly ? '服务费详情' : form.id ? '编辑服务费' : '新增服务费'" :confirm-loading="saving"
      :footer="formReadonly ? null : undefined" :ok-button-props="{ disabled: formLoading || !!formLoadError }" :mask-closable="!saving" :closable="!saving" @ok="save">
      <a-spin :spinning="formLoading">
        <a-alert v-if="formLoadError" type="error" :message="formLoadError" show-icon />
        <a-alert v-if="formError" type="error" :message="formError" show-icon />
        <a-form layout="vertical" :disabled="formReadonly || saving || formLoading || !!formLoadError">
          <a-form-item label="费用名称" required><a-input v-model:value="form.name" :maxlength="100" placeholder="请输入费用名称" /></a-form-item>
          <a-form-item label="税率" required><a-input-number v-model:value="form.markupRate" :precision="4" :min="0" :max="9999999999" addon-after="%" /></a-form-item>
          <a-form-item label="成本价（元）" required><a-input-number v-model:value="form.costPrice" :precision="2" :min="0" :max="9999999999" /></a-form-item>
          <a-form-item label="描述"><a-textarea v-model:value="form.description" :rows="3" :maxlength="1000" show-count /></a-form-item>
        </a-form>
      </a-spin>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { serviceFeeList, serviceFeeDetail, saveServiceFee, deleteServiceFee } from './ServiceFee.api';
  import { serviceFeePayload, serviceFeePrice } from '../serviceFee';
  defineOptions({ name: 'ServiceFeeMaintenance' });
  defineProps<{ embedded?: boolean }>();
  const emit = defineEmits<{ busy: [value: boolean] }>();
  const { hasPermission } = usePermission();
  const { createMessage } = useMessage();
  const keyword = ref(''), page = ref(1), total = ref(0), loading = ref(false), saving = ref(false), error = ref('');
  const rows = ref<Recordable[]>([]), form = ref<Recordable>({});
  const formOpen = ref(false), formReadonly = ref(false), formLoading = ref(false), formLoadError = ref(''), formError = ref('');
  watch([saving, formOpen], ([pending, editing]) => emit('busy', pending || editing), { immediate: true });
  let sequence = 0, formSequence = 0;
  const columns = [
    { title: '费用名称', dataIndex: 'name', width: 220 }, { title: '税率', key: 'markupRate', width: 130 },
    { title: '成本价（元）', key: 'costPrice', width: 160 }, { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '操作', key: 'action', width: 230 },
  ];
  async function load() {
    const request = ++sequence;
    loading.value = true; error.value = '';
    try {
      const result = await serviceFeeList({ name: keyword.value, pageNo: page.value, pageSize: 10 });
      if (request !== sequence) return;
      if (!Array.isArray(result?.records)) throw new Error('服务费列表格式异常');
      rows.value = result.records; total.value = Number(result.total || 0);
    } catch (e: any) { if (request === sequence) { error.value = e?.message || '服务费加载失败'; rows.value = []; } }
    finally { if (request === sequence) loading.value = false; }
  }
  function search() { page.value = 1; void load(); }
  function changePage(pagination: any) { page.value = pagination.current; void load(); }
  async function openForm(id?: string, readonly = false) {
    if (saving.value || (!readonly && !hasPermission(id ? 'mtl:serviceFee:edit' : 'mtl:serviceFee:add'))) return;
    const request = ++formSequence;
    formReadonly.value = readonly; formError.value = ''; formLoadError.value = '';
    form.value = { name: '', markupRate: 0, costPrice: 0, description: '', unit: '项', quantity: 1, remark: '' };
    formOpen.value = true;
    if (!id) return;
    formLoading.value = true;
    try {
      const result = await serviceFeeDetail(id);
      if (request !== formSequence) return;
      if (!result?.id) throw new Error('服务费详情不存在');
      form.value = { ...result };
    } catch (e: any) { if (request === formSequence) formLoadError.value = e?.message || '详情加载失败，请关闭后重试'; }
    finally { if (request === formSequence) formLoading.value = false; }
  }
  async function save() {
    if (saving.value || formLoading.value || formReadonly.value || formLoadError.value) return;
    if (!hasPermission(form.value.id ? 'mtl:serviceFee:edit' : 'mtl:serviceFee:add')) return;
    formError.value = '';
    try {
      const payload = serviceFeePayload({ ...form.value, guidePrice: serviceFeePrice(form.value.costPrice, form.value.markupRate) });
      saving.value = true;
      await saveServiceFee(payload);
      formOpen.value = false; createMessage.success('服务费已保存'); await load();
    } catch (e: any) { formError.value = e?.message || '保存失败，请重试'; }
    finally { saving.value = false; }
  }
  async function remove(id: string) {
    if (saving.value || !hasPermission('mtl:serviceFee:delete')) return;
    saving.value = true;
    try { await deleteServiceFee(id); createMessage.success('已删除'); if (rows.value.length === 1 && page.value > 1) page.value--; await load(); }
    catch (e: any) { createMessage.error(e?.message || '删除失败'); }
    finally { saving.value = false; }
  }
  onMounted(load);
  onBeforeUnmount(() => { sequence++; formSequence++; });
</script>
<style scoped>
  .service-fee-page { margin: 16px; padding: 20px; background: #fff; border-radius: 8px; }
  .service-fee-page.service-fee-page--embedded { margin: 0; padding: 0; border-radius: 0; }
  .service-fee-page__toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  .service-fee-page__toolbar h2 { margin: 0; font-size: 18px; }
  .service-fee-page__toolbar :deep(.ant-input-search) { width: 300px; max-width: 100%; }
  :deep(.ant-form-item .ant-input-number), :deep(.ant-form-item .ant-input-number-group-wrapper) { width: 100%; }
  @media (max-width: 600px) { .service-fee-page { margin: 8px; padding: 12px; } }
</style>
