<template>
  <a-modal
    :open="open"
    title="本分期报价导出授权"
    :width="800"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: loading || failed || !userId }"
    :mask-closable="!saving"
    :closable="!saving"
    @cancel="close"
    @ok="save"
  >
    <a-alert v-if="failed" type="error" :message="failed" show-icon />
    <a-alert type="info" message="仅授予导出权限，不授予查看或修改价格权限。关闭导出即撤销该用户授权；保存将清除该用户原有价格授权。" show-icon />
    <a-table :data-source="grants" :columns="columns" row-key="userId" :loading="loading" :pagination="false" :scroll="{ y: 240 }" size="small">
      <template #bodyCell="{ column, record }"
        ><a-button v-if="column.key === 'edit'" type="link" :disabled="saving" @click="selectGrant(record)">维护</a-button
        ><template v-else-if="column.key?.startsWith('can')">{{ Number(record[column.key]) === 1 ? '允许' : '不允许' }}</template></template
      >
    </a-table>
    <a-form layout="vertical" style="margin-top: 16px">
      <a-form-item label="授权用户" required
        ><JSelectUser v-model:value="userId" row-key="id" :multiple="false" :disabled="loading || saving || !!failed"
      /></a-form-item>
      <a-space>
        <a-checkbox v-model:checked="form.canExport" :disabled="saving">导出报价</a-checkbox>
      </a-space>
    </a-form>
  </a-modal>
</template>
<script setup lang="ts">
  import { reactive, ref, watch } from 'vue';
  import JSelectUser from '/@/components/Form/src/jeecg/components/JSelectUser.vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getQuotationAccess, getQuotationGrants, saveQuotationGrant } from '../Plan.api';
  import { quotationVersion } from '../quotationGovernance';
  import { usePermission } from '/@/hooks/web/usePermission';
  const { hasPermission } = usePermission();
  const props = defineProps<{ open: boolean; periodId: string }>();
  const emit = defineEmits(['update:open', 'success']);
  const { createMessage } = useMessage();
  const loading = ref(false),
    saving = ref(false),
    failed = ref(''),
    userId = ref('');
  const grants = ref<Recordable[]>([]);
  const version = ref(0);
  const form = reactive({ canViewPrice: false, canEditPrice: false, canExport: false });
  const columns = [
    { title: '用户', dataIndex: 'userName' },
    { title: '查看价格', key: 'canViewPrice' },
    { title: '修改价格', key: 'canEditPrice' },
    { title: '导出', key: 'canExport' },
    { title: '操作', key: 'edit' },
  ];
  let sequence = 0;
  function close() {
    if (!saving.value) emit('update:open', false);
  }
  function applySelection() {
    const item = grants.value.find((row) => String(row.userId) === String(userId.value));
    version.value = item ? quotationVersion(item.version) : 0;
    Object.assign(form, {
      canViewPrice: Number(item?.canViewPrice) === 1,
      canEditPrice: Number(item?.canEditPrice) === 1,
      canExport: Number(item?.canExport) === 1,
    });
  }
  function selectGrant(item: Recordable) {
    userId.value = String(item.userId);
    applySelection();
  }
  watch(userId, applySelection);
  watch(
    () => [props.open, props.periodId],
    async () => {
      const request = ++sequence;
      if (!props.open) return;
      loading.value = true;
      failed.value = '';
      userId.value = '';
      grants.value = [];
      try {
        const access = await getQuotationAccess(props.periodId);
        if (!access.canManage || !hasPermission('plan:quotation:grant')) throw new Error('当前无报价授权管理权限');
        const rows = await getQuotationGrants(props.periodId);
        if (!Array.isArray(rows)) throw new Error('授权列表格式不正确');
        rows.forEach((row) => quotationVersion(row.version));
        if (request === sequence) grants.value = rows;
      } catch (e: any) {
        if (request === sequence) failed.value = e?.message || '授权加载失败';
      } finally {
        if (request === sequence) loading.value = false;
      }
    },
    { immediate: true }
  );
  async function save() {
    if (saving.value || loading.value || failed.value || !userId.value) return;
    const target = String(userId.value);
    if (target.includes(',')) return createMessage.warning('每次请选择一个用户');
    const payload = { periodId: props.periodId, userId: target, version: version.value, canViewPrice: false, canEditPrice: false, canExport: form.canExport };
    saving.value = true;
    try {
      if (!hasPermission('plan:quotation:grant') || !(await getQuotationAccess(props.periodId)).canManage) throw new Error('当前无报价授权管理权限');
      // grant 版本独立于报价版本；新用户只在完整授权列表中确认不存在后使用 0。
      const latest = await getQuotationGrants(props.periodId);
      if (!Array.isArray(latest)) throw new Error('授权列表加载失败');
      const current = latest.find((row) => String(row.userId) === target);
      if ((current ? quotationVersion(current.version) : 0) !== payload.version) throw new Error('授权已变化，请关闭后重新打开核对');
      await saveQuotationGrant(payload);
      createMessage.success('本分期报价授权已保存');
      emit('success');
      emit('update:open', false);
    } catch (e: any) {
      createMessage.error(e?.message || '授权保存失败');
    } finally {
      saving.value = false;
    }
  }
</script>
