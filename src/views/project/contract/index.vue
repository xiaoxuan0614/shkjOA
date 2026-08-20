<template>
  <div class="contract-page">
    <!-- 合同信息 -->
    <a-card class="contract-page__card">
      <template #title>合同信息</template>

      <!-- 只读模式: 描述表格 + 回款计划 -->
      <template v-if="readonly && !editing">
        <a-descriptions :column="2" bordered size="middle">
          <a-descriptions-item label="合同类型">{{ info.contractType || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同编号">{{ info.contractNo || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同名称">{{ info.contractName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同签订日期">{{ info.contractSignedDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="计划交付日期">{{ info.plannedDeliveryDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同金额">{{ info.contractAmount != null ? `${info.contractAmount} 元` : '—' }}</a-descriptions-item>
          <a-descriptions-item label="质保期">{{ info.warrantyPeriod != null ? `${info.warrantyPeriod} 月` : '—' }}</a-descriptions-item>
          <a-descriptions-item label="销售负责人">{{ info.salesUserName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同附件" :span="2">
            <a v-if="contractFileId" :href="contractFileId" target="_blank">{{ contractFileName }}</a>
            <span v-else>—</span>
          </a-descriptions-item>
          <a-descriptions-item label="合同物料清单文件" :span="2">
            <a v-if="materialListFileId" :href="materialListFileId" target="_blank">{{ materialFileName }}</a>
            <span v-else>—</span>
          </a-descriptions-item>
          <a-descriptions-item label="备注" :span="2">{{ info.remark || '—' }}</a-descriptions-item>
        </a-descriptions>

        <!-- 只读: 回款计划 -->
        <div v-if="paybackRows.length" class="contract-page__payback">
          <div class="contract-page__payback-title">回款计划</div>
          <a-table
            :columns="paybackColumns"
            :data-source="paybackRows"
            :row-key="(record) => record._key"
            :pagination="false"
            size="middle"
            bordered
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'index'">{{ record._key }}</template>
              <template v-else-if="column.key === 'node'">{{ record.node || '—' }}</template>
              <template v-else-if="column.key === 'ratio'">{{ record.ratio ?? '—' }}%</template>
              <template v-else-if="column.key === 'amount'">{{ record.amount != null ? `${record.amount.toFixed(2)} 元` : '—' }}</template>
            </template>
          </a-table>
        </div>
      </template>

      <!-- 编辑模式: 表单 -->
      <template v-else>
        <BasicForm @register="registerForm" name="ContractForm" />

        <!-- 合同附件 -->
        <div class="contract-page__upload">
          <span class="contract-page__label">合同附件</span>
          <a-upload :show-upload-list="false" :before-upload="(f) => handleUpload(f, 'contract')">
            <a-button preIcon="ant-design:cloud-upload-outlined">{{ contractFileName || '上传合同附件' }}</a-button>
          </a-upload>
        </div>

        <!-- 合同物料清单文件: 上传 或 从项目文件库选择(按名搜索) -->
        <div class="contract-page__upload">
          <span class="contract-page__label">合同物料清单文件</span>
          <a-upload :show-upload-list="false" :before-upload="(f) => handleUpload(f, 'material')">
            <a-button preIcon="ant-design:cloud-upload-outlined">{{ materialFileName || '上传物料清单' }}</a-button>
          </a-upload>
          <a-select
            v-model:value="materialListFileId"
            class="contract-page__file-select"
            show-search
            allow-clear
            placeholder="从项目文件库选择(按名称搜索)"
            option-filter-prop="label"
            :options="fileOptions"
            @change="onMaterialFileChange"
          />
          <span v-if="materialFileName && materialFileIdFromSelect" class="contract-page__file-name">{{ materialFileName }}</span>
        </div>

        <!-- 回款计划(节点 + 比例, 金额 = 合同金额 × 比例) -->
        <div class="contract-page__payback">
          <div class="contract-page__payback-title">
            <span>回款计划</span>
            <a-button type="primary" size="small" preIcon="ant-design:plus-outlined" @click="addPaybackRow">添加节点</a-button>
          </div>
          <a-table
            :columns="paybackColumns"
            :data-source="paybackRows"
            :row-key="(record) => record._key"
            :pagination="false"
            size="middle"
            bordered
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'index'">{{ record._key }}</template>
              <template v-else-if="column.key === 'node'">
                <a-select v-model:value="record.node" placeholder="请选择节点" style="width: 100%" :options="paybackNodeOptions" />
              </template>
              <template v-else-if="column.key === 'ratio'">
                <a-input-number v-model:value="record.ratio" :min="0" :max="100" addon-after="%" style="width: 100%" placeholder="比例%" @change="calcPaybackAmount(record)" />
              </template>
              <template v-else-if="column.key === 'amount'">
                <b>{{ record.amount != null ? record.amount.toFixed(2) : '—' }} 元</b>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button type="link" danger size="small" @click="removePaybackRow(record._key)">删除</a-button>
              </template>
            </template>
          </a-table>
        </div>
      </template>
    </a-card>

    <!-- 底部操作 -->
    <div class="contract-page__footer">
      <template v-if="readonly && !editing">
        <a-button @click="goBack">返 回</a-button>
        <a-button v-auth="'project:contract:edit'" type="primary" ghost @click="editing = true">编 辑</a-button>
      </template>
      <template v-else>
        <a-button @click="goBack">取 消</a-button>
        <a-button type="primary" :loading="submitting" @click="handleSubmit">提 交</a-button>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { useUserStore } from '/@/store/modules/user';
  import { uploadFile } from '/@/api/common/api';
  import { contractList, saveContract, savePayback, paybackList } from '/@/views/payment/Payment.api';
  import { changePeriodStatus } from '../Project.api';
  import { getFiles } from '../detail/ProjectDetail.api';
  import { loadUserOptions } from '/@/views/resource/userOptions';
  import { initDictOptions } from '/@/utils/dict/index';

  const route = useRoute();
  const router = useRouter();
  const { createMessage } = useMessage();
  const userStore = useUserStore();

  const periodId = ref((route.query?.periodId as string) || (route.query?.id as string) || '');
  const projectId = ref((route.query?.projectId as string) || '');

  // 只读模式(已提交合同) / 编辑模式(无合同或点「编辑」)
  const readonly = ref(false);
  const editing = ref(false);
  const submitting = ref(false);
  const info = ref<Recordable>({});
  const contractId = ref('');
  const contractFileId = ref('');
  const contractFileName = ref('');
  const materialListFileId = ref('');
  const materialFileName = ref('');
  // 文件库文件选项
  const fileOptions = ref<{ label: string; value: string }[]>([]);
  let materialFileIdFromSelect = false;

  // 回款计划(节点 + 比例, 金额 = 合同金额 × 比例)
  const paybackColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '回款节点', key: 'node', width: 180 },
    { title: '比例(%)', key: 'ratio', width: 150 },
    { title: '金额(自动)', key: 'amount', width: 170 },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const paybackRows = ref<any[]>([]);
  let paybackSeed = 0;
  const paybackNodeOptions = ref<{ label: string; value: string }[]>([]);

  function addPaybackRow() {
    paybackRows.value.push({ _key: ++paybackSeed, node: undefined, ratio: 0, amount: 0 });
  }
  function removePaybackRow(key: number) {
    paybackRows.value = paybackRows.value.filter((r) => r._key !== key);
  }
  function calcPaybackAmount(record: any) {
    const amount = Number(getFieldsValue().contractAmount) || 0;
    const ratio = Number(record.ratio) || 0;
    record.amount = ratio > 0 ? (amount * ratio) / 100 : 0;
  }

  let userMap: Recordable = {};
  const defaultUser = computed(() => {
    const u: any = userStore.getUserInfo;
    return { id: String(u?.id ?? u?.userId ?? ''), name: u?.realname || u?.username || '' };
  });

  const [registerForm, { resetFields, setFieldsValue, validate, updateSchema, getFieldsValue }] = useForm({
    labelWidth: 110,
    schemas: [
      {
        label: '合同类型',
        field: 'contractType',
        component: 'ApiSelect',
        componentProps: { api: () => initDictOptions('contract_type'), placeholder: '请选择合同类型' },
        dynamicRules: () => [{ required: true, message: '请选择合同类型!' }],
      },
      {
        label: '合同名称',
        field: 'contractName',
        component: 'Input',
        componentProps: { placeholder: '请输入合同名称' },
      },
      {
        label: '合同签订日期',
        field: 'contractSignedDate',
        component: 'DatePicker',
        componentProps: { valueFormat: 'YYYY-MM-DD', placeholder: '请选择合同签订日期', style: { width: '100%' } },
      },
      {
        label: '计划交付日期',
        field: 'plannedDeliveryDate',
        component: 'DatePicker',
        helpMessage: '和客户约定的交付时间',
        componentProps: { valueFormat: 'YYYY-MM-DD', placeholder: '请选择计划交付日期', style: { width: '100%' } },
      },
      {
        label: '合同编号',
        field: 'contractNo',
        component: 'Input',
        componentProps: { placeholder: '请输入合同编号（合同上的编号）' },
      },
      {
        label: '合同金额',
        field: 'contractAmount',
        component: 'InputNumber',
        componentProps: { min: 0, placeholder: '请输入合同金额', addonAfter: '元', style: { width: '100%' } },
      },
      {
        label: '质保期',
        field: 'warrantyPeriod',
        component: 'InputNumber',
        componentProps: { min: 0, placeholder: '请输入质保期', addonAfter: '月', style: { width: '100%' } },
      },
      {
        label: '销售负责人',
        field: 'salesUserId',
        component: 'Select',
        componentProps: {
          showSearch: true,
          optionFilterProp: 'label',
          placeholder: '请选择销售负责人',
          onChange: (v: any) => {
            const u = userMap[v];
            setFieldsValue({ salesUserName: u?.name || '' });
          },
        },
      },
      {
        label: '备注',
        field: 'remark',
        component: 'InputTextArea',
        componentProps: { placeholder: '请输入备注', rows: 2 },
      },
      // 隐藏字段
      { label: '', field: 'id', component: 'Input', show: false },
      { label: '', field: 'periodId', component: 'Input', show: false },
      { label: '', field: 'projectId', component: 'Input', show: false },
      { label: '', field: 'salesUserName', component: 'Input', show: false },
    ],
    showActionButtonGroup: false,
    baseColProps: { span: 12 },
  });

  onMounted(async () => {
    paybackNodeOptions.value = (await initDictOptions('payback_node')) || [];
    await loadUsers();
    await loadFiles();
    await loadContract();
  });

  /** 加载全量用户(销售负责人下拉) */
  async function loadUsers() {
    const users = await loadUserOptions();
    userMap = (users || []).reduce((m, u) => {
      m[u.value] = { name: u.label };
      return m;
    }, {});
    await updateSchema({ field: 'salesUserId', componentProps: { options: users || [] } });
  }

  /** 加载项目文件库(合同物料清单文件选择) */
  async function loadFiles() {
    try {
      const res: any = await getFiles({ periodId: periodId.value, pageNo: 1, pageSize: 200 });
      const list = res?.records || res || [];
      fileOptions.value = (list || []).map((f: any) => ({ label: f.fileName || f.fileId, value: f.fileId }));
    } catch (e) {
      fileOptions.value = [];
    }
  }

  /** 加载已有合同 → 决定只读/编辑 */
  async function loadContract() {
    await resetFields();
    if (!periodId.value) return;
    let contract: any = null;
    try {
      const res: any = await contractList({ periodId: periodId.value, pageNo: 1, pageSize: 1 });
      contract = (res?.records || res || [])[0] || null;
    } catch (e) {
      contract = null;
    }
    if (!contract) {
      readonly.value = false;
      editing.value = true;
      contractId.value = '';
      info.value = {};
      paybackRows.value = [];
      await setFieldsValue({
        periodId: periodId.value,
        projectId: projectId.value,
        salesUserId: defaultUser.value.id,
        salesUserName: defaultUser.value.name,
      });
      return;
    }
    // 已有合同 → 只读
    readonly.value = true;
    editing.value = false;
    contractId.value = contract.id || '';
    info.value = { ...contract };
    contractFileId.value = contract.contractFileId || '';
    contractFileName.value = contractFileId.value ? (contractFileId.value.split('/').pop() || contractFileId.value) : '';
    materialListFileId.value = contract.materialListFileId || '';
    materialFileName.value = materialListFileId.value ? (materialListFileId.value.split('/').pop() || materialListFileId.value) : '';
    // 加载已有回款计划
    await loadPaybackRows();
  }

  /** 加载已有回款计划(contractItem) */
  async function loadPaybackRows() {
    paybackRows.value = [];
    try {
      const res: any = await paybackList({ periodId: periodId.value, pageNo: 1, pageSize: 100 });
      const records = res?.records || res || [];
      paybackSeed = 0;
      paybackRows.value = (records || []).map((r: any) => ({
        _key: ++paybackSeed,
        id: r.id,
        node: r.node,
        ratio: Number(r.ratio) || 0,
        amount: Number(r.amount) || 0,
      }));
    } catch {
      paybackRows.value = [];
    }
  }

  /** 上传文件(contract=合同附件 / material=物料清单) */
  async function handleUpload(file: any, kind: 'contract' | 'material'): Promise<boolean> {
    if (!file) return false;
    try {
      const res: any = await uploadFile({ file }, undefined);
      const path = res?.url || res?.result || res?.filename || file.name;
      if (kind === 'contract') {
        contractFileId.value = path;
        contractFileName.value = file.name;
      } else {
        materialListFileId.value = path;
        materialFileName.value = file.name;
        materialFileIdFromSelect = false;
      }
      createMessage.success(`文件「${file.name}」上传成功`);
    } catch (err) {
      createMessage.warning('上传失败，请重试');
    }
    return false;
  }

  /** 从文件库选择物料清单文件 */
  function onMaterialFileChange(v: any) {
    if (!v) {
      materialFileName.value = '';
      materialFileIdFromSelect = false;
      return;
    }
    const opt = fileOptions.value.find((o) => o.value === v);
    materialFileName.value = opt?.label || '';
    materialFileIdFromSelect = true;
  }

  /** 提交: 保存合同 → 项目进入筹备中 → 返回列表 */
  async function handleSubmit() {
    try {
      const values = await validate();
      const payload = {
        ...values,
        id: contractId.value || undefined,
        periodId: periodId.value,
        projectId: projectId.value,
        contractFileId: contractFileId.value,
        materialListFileId: materialListFileId.value,
      };
      submitting.value = true;
      await saveContract(payload);
      // 保存回款计划(节点 + 比例)
      for (const p of paybackRows.value) {
        if (!p.node) continue;
        await savePayback({
          id: p.id || undefined,
          periodId: periodId.value,
          node: p.node,
          ratio: p.ratio,
          amount: p.amount,
        });
      }
      // 合同提交 → 项目进入筹备中
      await changePeriodStatus({ periodId: periodId.value, status: 'PREPARING' });
      createMessage.success(contractId.value ? '合同信息已更新' : '合同提交成功，项目进入筹备中');
      router.push('/project/list');
    } catch (error: any) {
      if (error?.errorFields) return Promise.reject(error.errorFields);
    } finally {
      submitting.value = false;
    }
  }

  function goBack() {
    router.push('/project/list');
  }
</script>

<style lang="less" scoped>
  .contract-page {
    padding: 16px;

    &__card {
      background: #fff;
      border-radius: 4px;

      &-title {
        font-weight: 600;
        font-size: 15px;
      }
    }

    &__upload {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;

      &-label {
        width: 110px;
        text-align: right;
        color: #333;
        font-size: 14px;
        flex-shrink: 0;
      }

      &-file-name {
        color: #999;
        font-size: 13px;
      }

      &-file-select {
        width: 260px;
      }
    }

    &__payback {
      margin-top: 8px;

      &-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin: 12px 0;
      }
    }

    &__footer {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 16px 0 24px;
    }
  }
</style>
