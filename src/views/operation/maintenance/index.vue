<template>
  <a-result v-if="!allowed" status="403" title="仅管理员可访问维保管理 Mock" />
  <main v-else class="maintenance-page">
    <!-- THESIS: 同一归档分期逐期保留合同。OWN-WORLD: OA蓝白表格与双列表单。
         STORY: 查询分期、查看历史、新增或续签。FIRST VIEWPORT: 提示、搜索、新增、分期折叠列表。
         FORM: 已确认的现有合同页面结构扩展，不引入新视觉体系。 -->
    <header><h1>维保管理 <a-tag color="blue">Mock</a-tag></h1><a-button v-if="!draft" type="primary" @click="openNew">新增维保合同</a-button></header>
    <a-alert show-icon type="info" message="管理员演示版：归档项目和合同均为模拟数据；新增记录及附件只在本页会话保留，刷新或关闭页面后恢复示例，不调用上传或审批接口。" />
    <template v-if="!draft">
      <a-input-search v-model:value="keyword" allow-clear placeholder="搜索归档项目、分期或甲方" class="search" />
      <a-collapse>
        <a-collapse-panel v-for="project in projects" :key="project.id" :header="`${project.name} · ${project.customer}`">
          <a-table :columns="columns" :data-source="contracts.filter(c => c.periodId === project.id)" row-key="id" :pagination="false" :scroll="{ x: 1000 }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'type'">{{ record.type === 'FULL' ? '全包' : '半包' }}</template>
              <template v-else-if="column.key === 'term'">{{ record.start }} ～ {{ record.end }}</template>
              <template v-else-if="column.key === 'amount'">{{ Number(record.amount).toFixed(2) }}</template>
              <template v-else-if="column.key === 'state'"><a-tag :color="contractState(record, today) === '服务中' ? 'green' : 'default'">{{ contractState(record, today) }}</a-tag></template>
              <template v-else-if="column.key === 'action'"><a-space><a-button type="link" @click="view(record)">查看</a-button><a-button type="link" @click="renew(record)">续签</a-button></a-space></template>
            </template>
            <template #emptyText>暂无维保合同，可点击上方“新增维保合同”</template>
          </a-table>
        </a-collapse-panel>
      </a-collapse>
      <a-empty v-if="!projects.length" description="没有匹配的归档分期" />
    </template>
    <section v-else class="editor">
      <header><h2>{{ readonly ? '维保合同详情' : draft.previousId ? '续签维保合同' : '新增维保合同' }}</h2><a-space><a-button @click="leave">{{ readonly ? '返回列表' : '取消' }}</a-button><a-button v-if="!readonly" type="primary" @click="save">保存 Mock 合同</a-button></a-space></header>
      <a-alert v-if="draft.previousId" type="info" :message="`关联上期合同：${contracts.find(c => c.id === draft.previousId)?.name || draft.previousId}；保存不会覆盖上期合同。`" />
      <a-alert v-if="error" type="error" show-icon :message="error" />
      <a-form layout="vertical" :disabled="readonly">
        <h3>项目基本信息</h3>
        <div class="form-grid">
          <a-form-item label="归档分期项目" required><a-select v-model:value="draft.periodId" show-search option-filter-prop="label" :disabled="readonly || !!draft.previousId" :options="archivedPeriods.map(p => ({ value: p.id, label: p.name }))" placeholder="请选择归档分期" /></a-form-item>
          <a-form-item label="甲方名称"><a-input :value="selectedProject?.customer" disabled /></a-form-item>
          <a-form-item label="项目对接人"><a-input :value="selectedProject?.contact" disabled /></a-form-item>
        </div>
        <h3>合同信息</h3>
        <div class="form-grid">
          <a-form-item label="合同名称" required><a-input v-model:value="draft.name" :maxlength="100" /></a-form-item>
          <a-form-item label="合同编号" required><a-input v-model:value="draft.no" :maxlength="60" /></a-form-item>
          <a-form-item label="维保类型" required><a-radio-group v-model:value="draft.type"><a-radio value="FULL">全包</a-radio><a-radio value="HALF">半包</a-radio></a-radio-group></a-form-item>
          <a-form-item label="合同签订日期" required><a-date-picker v-model:value="draft.signed" value-format="YYYY-MM-DD" /></a-form-item>
          <a-form-item label="维保开始日期" required><a-date-picker v-model:value="draft.start" value-format="YYYY-MM-DD" /></a-form-item>
          <a-form-item label="维保结束日期" required><a-date-picker v-model:value="draft.end" value-format="YYYY-MM-DD" /></a-form-item>
          <a-form-item label="维保合同金额（元）" required><a-input-number v-model:value="draft.amount" :min="0.01" :precision="2" /></a-form-item>
          <a-form-item label="销售负责人" required>
            <span v-if="readonly">{{ draft.sales || '—' }}</span>
            <a-select v-else v-model:value="draft.salesUserId" show-search allow-clear option-filter-prop="label" :options="salesOptions" :loading="usersLoading" placeholder="请选择销售负责人" aria-label="销售负责人" @dropdown-visible-change="open => open && loadSalesUsers()" @change="selectSalesUser" />
          </a-form-item>
        </div>
        <a-form-item label="维保范围／服务内容" required><a-textarea v-model:value="draft.scope" :rows="3" :maxlength="2000" /></a-form-item>
        <a-form-item label="备注"><a-textarea v-model:value="draft.remark" :rows="3" :maxlength="2000" show-count /></a-form-item>
      </a-form>
      <h3>合同附件 <span class="required">*</span></h3>
      <a-upload v-if="!readonly" :before-upload="addFile" :show-upload-list="false" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"><a-button :disabled="draft.files.length >= 3">选择合同附件（{{ draft.files.length }}/3）</a-button></a-upload>
      <p class="hint">每次选择一个，最多3个，单个不超过20MB。Mock仅本地读取；续签必须重新选择附件。</p>
      <div v-for="(file, index) in draft.files" :key="index" class="file-row"><span>{{ file.name }}</span><a v-if="file.url" :href="file.url" :download="file.name">下载查看</a><span v-else class="hint">示例占位，无真实文件</span><a-button v-if="!readonly" type="link" danger @click="draft.files.splice(index, 1)">移除</a-button></div>
      <section class="payment-plan" aria-labelledby="maintenance-payment-title">
      <div class="payment-plan__heading">
        <h3 id="maintenance-payment-title">回款计划</h3>
        <a-button v-if="!readonly" type="primary" size="small" preIcon="ant-design:plus-outlined" :disabled="draft.payments.length >= paymentNames.length" @click="draft.payments.push({ name: '', ratio: 0, days: 7 })">添加款项</a-button>
      </div>
      <a-table :columns="paymentColumns" :data-source="draft.payments" :pagination="false" :row-key="(_r, i) => i" :scroll="{ x: 1000 }" size="middle" bordered>
        <template #headerCell="{ column }">
          <span>{{ column.title }}<span v-if="column.required && !readonly" class="required payment-plan__required" aria-hidden="true">*</span></span>
        </template>
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ index + 1 }}</template>
          <template v-else-if="column.key === 'name'"><span v-if="readonly">{{ record.name || '—' }}</span><a-select v-else v-model:value="record.name" :options="paymentNames.filter(n => n === record.name || !draft.payments.some(p => p.name === n)).map(n => ({ value: n, label: n }))" class="payment-plan__input" placeholder="请选择回款项" :aria-label="`第${index + 1}行回款项`" @change="record.name === '一次款' && (record.ratio = 100)" /></template>
          <template v-else-if="column.key === 'ratio'"><span v-if="readonly">{{ record.ratio }}%</span><a-input-number v-else v-model:value="record.ratio" :min="0.01" :max="100" :precision="2" addon-after="%" class="payment-plan__input" placeholder="请输入比例" :aria-label="`第${index + 1}行比例`" /></template>
          <template v-else-if="column.key === 'days'"><span v-if="readonly">{{ record.days }} 天</span><a-input-number v-else v-model:value="record.days" :min="0" :precision="0" addon-after="天" class="payment-plan__input" placeholder="请输入周期" :aria-label="`第${index + 1}行回款周期`" /></template>
          <template v-else-if="column.key === 'amount'"><span class="payment-plan__amount">{{ paymentAmount(draft.amount, record.ratio) }}</span></template>
          <template v-else-if="column.key === 'action'"><a-button v-if="!readonly" type="link" danger @click="draft.payments.splice(index, 1)">移除</a-button></template>
        </template>
        <template #emptyText>暂无回款项，请点击右上方“添加款项”</template>
      </a-table>
      <div class="payment-plan__summary" aria-live="polite">比例合计：<strong>{{ paymentRatioTotal(draft.payments) }}%</strong><span>（须为100%）</span></div>
      <p class="hint">回款金额 = 维保合同金额 × 比例，按每行四舍五入保留两位小数。</p>
      <p v-if="paymentError" class="required" role="alert">{{ paymentError }}</p>
      </section>
    </section>
  </main>
</template>
<script setup lang="ts">
  import { computed, ref, onBeforeUnmount, watch } from 'vue';
  import dayjs from 'dayjs';
  import { Modal, message } from 'ant-design-vue';
  import { useUserStore } from '/@/store/modules/user';
  import { loadUserOptions, type UserOption } from '/@/views/resource/userOptions';
  import { archivedPeriods, seedContracts, renewalDraft, validateContract, contractState, paymentAmount, paymentRatioTotal, validatePayments, type MaintenanceContract } from './maintenance.mock';
  defineOptions({ name: 'MaintenanceMockManagement' });
  const user = useUserStore();
  const allowed = computed(() => !!user.getToken && (user.getUserInfo.username === 'admin' || user.getIdentity.roleCodes.includes('admin')));
  const contracts = ref<MaintenanceContract[]>(seedContracts());
  const draft = ref<MaintenanceContract>();
  const readonly = ref(false), keyword = ref(''), error = ref('');
  const submitAttempted = ref(false);
  const users = ref<UserOption[]>([]);
  const usersLoading = ref(false);
  const usersLoaded = ref(false);
  const salesOptions = computed(() => {
    const selected = draft.value;
    return selected?.salesUserId && !users.value.some(u => u.value === selected.salesUserId)
      ? [{ value: selected.salesUserId, label: selected.sales }, ...users.value] : users.value;
  });
  async function loadSalesUsers() {
    if (!allowed.value || usersLoading.value || usersLoaded.value) return;
    usersLoading.value = true;
    const owner = user.getIdentity.userId;
    try {
      const options = await loadUserOptions(true);
      if (owner !== user.getIdentity.userId || !allowed.value) return;
      users.value = options;
      usersLoaded.value = true;
    } catch {
      message.error('用户列表加载失败，请重新打开下拉框重试');
    } finally { usersLoading.value = false; }
  }
  function selectSalesUser(value?: string) {
    if (!draft.value) return;
    draft.value.salesUserId = value || '';
    draft.value.sales = users.value.find(u => u.value === value)?.label || '';
  }
  const paymentError = computed(() => submitAttempted.value && !readonly.value && draft.value ? validatePayments(draft.value.payments) : '');
  watch(draft, () => { submitAttempted.value = false; });
  const today = dayjs().format('YYYY-MM-DD');
  const projects = computed(() => archivedPeriods.filter(p => `${p.name} ${p.customer}`.includes(keyword.value.trim())));
  const selectedProject = computed(() => archivedPeriods.find(p => p.id === draft.value?.periodId));
  const columns = [{ title: '合同名称', dataIndex: 'name', width: 240 }, { title: '维保类型', key: 'type', width: 90 }, { title: '维保期限', key: 'term', width: 240 }, { title: '合同金额（元）', key: 'amount', width: 140 }, { title: '服务状态', key: 'state', width: 100 }, { title: '操作', key: 'action', width: 160 }];
  const paymentColumns = computed(() => [
    { title: '序号', key: 'index', width: 70 },
    { title: '回款项', key: 'name', width: 260, required: true },
    { title: '比例', key: 'ratio', width: 200, required: true },
    { title: '回款周期', key: 'days', width: 200, required: true },
    { title: '回款金额（元）', key: 'amount', width: 180 },
    ...(!readonly.value ? [{ title: '操作', key: 'action', width: 90 }] : []),
  ]);
  const paymentNames = ['一次款', '预付款', '阶段款', '尾款'];
  const urls = new Set<string>();
  let nextContractId = 0;
  function clearFiles() { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); }
  onBeforeUnmount(clearFiles);
  watch(() => user.getIdentity.userId, () => { clearFiles(); contracts.value = seedContracts(); draft.value = undefined; users.value = []; usersLoaded.value = false; });
  function openNew() {
    if (!allowed.value) return;
    readonly.value = false; error.value = '';
    draft.value = { id: '', periodId: '', name: '', no: '', type: 'FULL', signed: today, start: '', end: '', amount: 0, sales: '', scope: '', remark: '', files: [], payments: [{ name: '一次款', ratio: 100, days: 7 }] };
  }
  function view(c: MaintenanceContract) { if (!allowed.value) return; readonly.value = true; error.value = ''; draft.value = JSON.parse(JSON.stringify(c)); }
  function renew(c: MaintenanceContract) { if (!allowed.value) return; readonly.value = false; error.value = ''; draft.value = renewalDraft(c); }
  function leave() { if (readonly.value) draft.value = undefined; else Modal.confirm({ title: '放弃本次未保存内容？', onOk: () => { draft.value = undefined; } }); }
  function addFile(file: File) {
    if (!allowed.value || readonly.value || !draft.value) return false;
    if (draft.value.files.length >= 3 || file.size > 20 * 1024 * 1024 || !/\.(pdf|docx?|xlsx?|png|jpe?g)$/i.test(file.name)) { message.error('仅支持PDF、Word、Excel及图片，最多3个，每个20MB以内'); return false; }
    const url = URL.createObjectURL(file); urls.add(url); draft.value.files.push({ name: file.name, url }); return false;
  }
  function save() {
    if (!allowed.value || readonly.value || !draft.value) return;
    submitAttempted.value = true;
    error.value = validateContract(draft.value);
    if (error.value) return;
    if (contracts.value.some(c => c.no === draft.value!.no.trim())) { error.value = '合同编号不能重复'; return; }
    if (contracts.value.some(c => c.periodId === draft.value!.periodId && c.start <= draft.value!.end && c.end >= draft.value!.start)) { error.value = '维保期限与已有合同重叠，请调整日期'; return; }
    contracts.value.push({ ...JSON.parse(JSON.stringify(draft.value)), id: `mock-${Date.now()}-${++nextContractId}`, no: draft.value.no.trim() });
    draft.value = undefined; message.success('已保存到当前页面 Mock 会话，未提交后端');
  }
</script>
<style scoped>
  .maintenance-page { padding: 20px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; }
  h1 { font-size: 22px; margin: 0; } h2 { font-size: 18px; margin: 0; } h3 { margin: 24px 0 16px; }
  .search { max-width: 420px; margin: 20px 0; }
  .editor { margin-top: 20px; padding: 24px; background: white; }
  .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px; }
  .form-grid :deep(.ant-picker), .form-grid :deep(.ant-input-number) { width: 100%; }
  .file-row { display: flex; align-items: center; gap: 16px; overflow-wrap: anywhere; padding: 8px 0; }
  .hint { color: #595959; margin: 8px 0; } .required { color: #cf1322; }
  .payment-plan { margin-top: 24px; }
  .payment-plan__heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; }
  .payment-plan__heading h3 { margin: 0; font-size: 16px; font-weight: 600; }
  .payment-plan__required { margin-left: 4px; }
  .payment-plan__input { width: 100%; }
  .payment-plan__summary { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
  .payment-plan__amount, .payment-plan__summary { font-variant-numeric: tabular-nums; }
  @media(max-width: 760px) { .form-grid { grid-template-columns: 1fr; } header { flex-wrap: wrap; } .editor { padding: 16px; } }
</style>
