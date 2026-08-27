<template>
  <div class="contract-page">
    <!-- 项目基本信息 -->
    <a-card class="contract-page__card contract-page__project" title="项目基本信息">
      <PlanProjectInfo :record="projectRecord" period-name-label="项目名称" :show-plan-fields="false" />
    </a-card>

    <!-- 合同信息 -->
    <a-card class="contract-page__card">
      <template #title>合同信息</template>

      <!-- 只读模式: 描述表格 + 回款计划 -->
      <template v-if="readonly && !editing">
        <a-descriptions :column="{ xs: 1, sm: 1, md: 2 }" bordered size="middle">
          <a-descriptions-item label="审批状态">
            <a-tag :color="getApprovalStatusMeta(info.status).color">
              {{ getApprovalStatusMeta(info.status).text }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="合同类型">{{ contractTypeText }}</a-descriptions-item>
          <a-descriptions-item label="合同编号">{{ info.contractNo || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同名称">{{ info.contractName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同签订日期">{{ info.contractSignedDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="计划交付日期">{{ info.plannedDeliveryDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同金额">{{ info.contractAmount != null ? `${info.contractAmount} 元` : '—' }}</a-descriptions-item>
          <a-descriptions-item label="质保期">{{ info.warrantyPeriod != null ? `${info.warrantyPeriod} 月` : '—' }}</a-descriptions-item>
          <a-descriptions-item label="销售负责人">{{ info.salesUserName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="项目经理">{{ projectManagerName }}</a-descriptions-item>
          <a-descriptions-item v-if="isApprovalRejected(info.status)" label="驳回原因" :span="2">
            <span class="contract-page__reject-reason">{{ info.approvalReason || '未填写驳回原因' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="合同附件" :span="2">
            <a-button
              v-if="contractFileId"
              size="small"
              preIcon="ant-design:eye-outlined"
              @click="previewFileInModal(contractFileId, contractFileName)"
            >
              预览：{{ contractFileName }}
            </a-button>
            <span v-else>—</span>
          </a-descriptions-item>
          <a-descriptions-item label="合同物料清单文件" :span="2">
            <a-button
              v-if="materialListFileId"
              size="small"
              preIcon="ant-design:eye-outlined"
              @click="previewFileInModal(materialListFileId, materialFileName)"
            >
              预览：{{ materialFileName }}
            </a-button>
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
            :scroll="{ x: 700 }"
            size="middle"
            bordered
          >
            <template #headerCell="{ column }">
              <template v-if="column.key === 'rollbackTime'">
                <span class="contract-page__payback-cycle-title">
                  回款周期
                  <a-tooltip title="阶段任务完成后回款的周期">
                    <Icon icon="ant-design:question-circle-outlined" size="14" />
                  </a-tooltip>
                </span>
              </template>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'index'">{{ record._key }}</template>
              <template v-else-if="column.key === 'node'">{{ getOptionLabel(paybackNodeOptions, record.node) }}</template>
              <template v-else-if="column.key === 'ratio'">{{ record.ratio ?? '—' }}%</template>
              <template v-else-if="column.key === 'rollbackTime'">{{ record.rollbackTime ?? 7 }} 天</template>
              <template v-else-if="column.key === 'amount'">{{ record.amount != null ? `${record.amount.toFixed(2)} 元` : '—' }}</template>
            </template>
          </a-table>
        </div>
      </template>

      <!-- 编辑模式: 表单 -->
      <template v-else>
        <a-alert
          v-if="isApprovalRejected(info.status)"
          class="contract-page__reject-alert"
          type="error"
          show-icon
          message="合同已驳回"
          :description="info.approvalReason || '未填写驳回原因'"
        />
        <BasicForm @register="registerForm" name="ContractForm" :colon="false">
          <template #contractAttachment>
            <a-upload
              class="contract-page__attachment-upload"
              :accept="DOCUMENT_UPLOAD_ACCEPT"
              :before-upload="(file) => handleBeforeUpload(file, 'contract')"
              :file-list="contractUploadFileList"
              :max-count="1"
              @change="(info) => handleUploadChange(info, 'contract')"
              @preview="(file) => previewFileInModal(file, contractFileName || file.name)"
              @remove="() => handleRemoveUpload('contract')"
            >
              <a-button v-if="!contractUploadFileList.length" :loading="submitting" preIcon="ant-design:cloud-upload-outlined">
                选择合同附件
              </a-button>
            </a-upload>
          </template>
          <template #materialAttachment>
            <a-upload
              class="contract-page__attachment-upload"
              :accept="DOCUMENT_UPLOAD_ACCEPT"
              :before-upload="(file) => handleBeforeUpload(file, 'material')"
              :file-list="materialUploadFileList"
              :max-count="1"
              @change="(info) => handleUploadChange(info, 'material')"
              @preview="(file) => previewFileInModal(file, materialFileName || file.name)"
              @remove="() => handleRemoveUpload('material')"
            >
              <a-button v-if="!materialUploadFileList.length" :loading="submitting" preIcon="ant-design:cloud-upload-outlined">
                选择物料清单
              </a-button>
            </a-upload>
          </template>
        </BasicForm>

        <!-- 回款计划(节点 + 比例, 金额 = 合同金额 × 比例) -->
        <div class="contract-page__payback">
          <div class="contract-page__payback-title">
            <span>回款计划</span>
            <a-button type="primary" size="small" preIcon="ant-design:plus-outlined" @click="addPaybackRow">添加款项</a-button>
          </div>
          <a-table
            :columns="paybackColumns"
            :data-source="paybackRows"
            :row-key="(record) => record._key"
            :pagination="false"
            :scroll="{ x: 780 }"
            size="middle"
            bordered
          >
            <template #headerCell="{ column }">
              <template v-if="column.key === 'rollbackTime'">
                <span class="contract-page__payback-cycle-title">
                  回款周期
                  <a-tooltip title="阶段任务完成后回款的周期">
                    <Icon icon="ant-design:question-circle-outlined" size="14" />
                  </a-tooltip>
                </span>
              </template>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'index'">{{ record._key }}</template>
              <template v-else-if="column.key === 'node'">
                <a-select v-model:value="record.node" placeholder="请选择节点" style="width: 100%" :options="paybackNodeOptions" />
              </template>
              <template v-else-if="column.key === 'ratio'">
                <a-input-number
                  v-model:value="record.ratio"
                  :min="0"
                  :max="100"
                  :precision="2"
                  addon-after="%"
                  style="width: 100%"
                  placeholder="比例%"
                  @change="calcPaybackAmount(record)"
                />
              </template>
              <template v-else-if="column.key === 'rollbackTime'">
                <a-input-number
                  v-model:value="record.rollbackTime"
                  :min="0"
                  :precision="0"
                  addon-after="天"
                  style="width: 100%"
                  placeholder="回款周期"
                />
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

    <a-card v-if="showAuditPanel" class="contract-page__card contract-page__audit" title="合同审批">
      <div class="contract-page__audit-decision">
        <span class="contract-page__audit-label"><span class="contract-page__required">*</span>审批结果</span>
        <div class="contract-page__audit-content">
          <a-radio-group v-model:value="approvalResult" button-style="solid">
            <a-radio-button value="approve">通 过</a-radio-button>
            <a-radio-button value="reject">驳 回</a-radio-button>
          </a-radio-group>
          <p class="contract-page__audit-hint">通过后指定负责后续项目计划的项目经理；驳回时需填写原因。</p>
        </div>
      </div>

      <div v-if="approvalResult === 'approve'" class="contract-page__audit-field">
        <span class="contract-page__audit-label"><span class="contract-page__required">*</span>项目经理</span>
        <a-select
          v-model:value="projectManagerUserId"
          show-search
          option-filter-prop="label"
          placeholder="请选择项目经理"
          :loading="userOptionsLoading"
          :options="userOptions"
          style="flex: 1"
        />
      </div>

      <div v-else-if="approvalResult === 'reject'" class="contract-page__audit-field">
        <span class="contract-page__audit-label"><span class="contract-page__required">*</span>驳回原因</span>
        <a-textarea v-model:value="approvalReason" :rows="3" :maxlength="500" show-count placeholder="请填写驳回原因" style="flex: 1" />
      </div>

      <div class="contract-page__audit-actions">
        <a-button
          type="primary"
          :danger="approvalResult === 'reject'"
          :disabled="!approvalResult || (approvalResult === 'approve' && userOptionsLoading)"
          :loading="actionSubmitting"
          @click="handleAuditSubmit"
        >
          {{ approvalResult === 'approve' ? '确认通过' : approvalResult === 'reject' ? '确认驳回' : '请先选择审批结果' }}
        </a-button>
      </div>
    </a-card>

    <!-- 底部操作 -->
    <div class="contract-page__footer">
      <template v-if="readonly && !editing">
        <a-button @click="goBack">返 回</a-button>
        <a-popconfirm v-if="canWithdrawContract" title="撤回后可修改合同并重新提交，确认撤回？" @confirm="handleWithdraw">
          <a-button danger :loading="actionSubmitting">撤 回</a-button>
        </a-popconfirm>
        <a-button v-if="canEditContract" type="primary" ghost @click="startEdit">修改并重新提交</a-button>
      </template>
      <template v-else>
        <a-button @click="goBack">取 消</a-button>
        <a-button type="primary" :loading="submitting" @click="handleSubmit">提 交</a-button>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, computed, nextTick, onMounted } from 'vue';
  import { Upload } from 'ant-design-vue';
  import Big from 'big.js';
  import { useRoute, useRouter } from 'vue-router';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { Icon } from '/@/components/Icon';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { useUserStore } from '/@/store/modules/user';
  import { DOCUMENT_UPLOAD_ACCEPT, isAllowedDocumentFile } from '/@/utils/documentUpload';
  import { getFileAccessHttpUrl } from '/@/utils/common/compUtils';
  import { previewFileInModal } from '/@/utils/filePreview';
  import {
    addContractWithPaymentRecords,
    contractDetailByPeriodId,
    editContractWithPaymentRecords,
    changeContractStatus,
  } from '/@/views/payment/Payment.api';
  import { changePeriodStatus, projectDetail } from '../Project.api';
  import { loadDictOptions } from '../Project.data';
  import PlanProjectInfo from '../plan/PlanProjectInfo.vue';
  import { loadUserOptions } from '/@/views/resource/userOptions';
  import {
    getApprovalStatusMeta,
    isApprovalPending,
    isApprovalPendingSubmit,
    isApprovalRejected,
    isApprovalWithdrawn,
  } from '/@/utils/approvalStatus';

  defineOptions({ name: 'ProjectContractInformation' });

  const route = useRoute();
  const router = useRouter();
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();
  const userStore = useUserStore();

  type ContractPageMode = 'create' | 'view' | 'edit';

  const routeMode = String(route.query?.mode || 'create');
  const pageMode = ref<ContractPageMode>(routeMode === 'view' || routeMode === 'edit' ? routeMode : 'create');
  const periodId = ref((route.query?.periodId as string) || '');
  const projectId = ref((route.query?.projectId as string) || '');
  const projectRecord = ref<Recordable>({ periodId: periodId.value, projectId: projectId.value });

  // 页面状态由入口 mode 显式决定，不再通过合同列表猜测新增或查看。
  const readonly = ref(pageMode.value !== 'create');
  const editing = ref(pageMode.value !== 'view');
  const submitting = ref(false);
  const actionSubmitting = ref(false);
  const contractLoadFailed = ref(false);
  const paybackLoadFailed = ref(false);
  const info = ref<Recordable>({});
  const originalContract = ref<Recordable>({});
  const contractId = ref((route.query?.contractId as string) || '');
  const contractFileId = ref('');
  const contractFileName = ref('');
  const materialListFileId = ref('');
  const materialFileName = ref('');
  const contractUploadFileList = ref<any[]>([]);
  const materialUploadFileList = ref<any[]>([]);
  const pendingContractFile = ref<File>();
  const pendingMaterialFile = ref<File>();
  const contractReplacementRequired = ref(false);
  const materialReplacementRequired = ref(false);
  const userOptions = ref<{ label: string; value: string }[]>([]);
  const userOptionsLoading = ref(false);
  const approvalResult = ref<'approve' | 'reject'>();
  const projectManagerUserId = ref<string>();
  const approvalReason = ref('');

  // 回款计划(节点 + 比例, 金额 = 合同金额 × 比例)
  const paybackColumns = computed(() => {
    const columns: any[] = [
      { title: '序号', key: 'index', width: 60 },
      { title: '回款项', key: 'node', width: 180 },
      { title: '比例(%)', key: 'ratio', width: 150 },
      { title: '回款周期', key: 'rollbackTime', width: 150 },
      { title: '回款金额(自动)', key: 'amount', width: 170 },
    ];
    if (!readonly.value || editing.value) columns.push({ title: '操作', key: 'action', width: 80, align: 'center' });
    return columns;
  });
  const paybackRows = ref<any[]>([]);
  let paybackSeed = 0;
  const contractTypeOptions = ref<{ label: string; value: string }[]>([]);
  const paybackNodeOptions = ref<{ label: string; value: string }[]>([]);

  function getOptionLabel(options: { label: string; value: string }[], value: unknown) {
    if (value == null || value === '') return '—';
    return options.find((item) => String(item.value) === String(value))?.label || String(value);
  }

  const contractTypeText = computed(() => getOptionLabel(contractTypeOptions.value, info.value.contractType));
  const projectManagerName = computed(() => {
    const snapshot = String(info.value.projectManagerUserName || '').trim();
    if (snapshot && snapshot !== '—') return snapshot;
    const managerId = info.value.projectManagerUserId;
    const matchedName = userOptions.value.find((item) => String(item.value) === String(managerId ?? ''))?.label;
    if (matchedName) return matchedName;
    return isApprovalPending(info.value.status) ? '待指定' : '—';
  });

  function addPaybackRow() {
    paybackRows.value.push({ _key: ++paybackSeed, node: undefined, ratio: 0, rollbackTime: 7, amount: 0 });
  }
  function removePaybackRow(key: number) {
    paybackRows.value = paybackRows.value.filter((r) => r._key !== key);
  }
  /** 金额 = 合同金额 × 比例%，统一保留两位小数 */
  function calculatePaybackAmount(contractAmount: unknown, ratio: unknown) {
    const amount = Number(contractAmount) || 0;
    const percent = Number(ratio) || 0;
    if (amount <= 0 || percent <= 0) return 0;
    return Number(new Big(amount).times(percent).div(100).round(2, Big.roundHalfUp).toString());
  }

  function calcPaybackAmount(record: any, contractAmount = getFieldsValue().contractAmount) {
    record.amount = calculatePaybackAmount(contractAmount, record.ratio);
  }

  function recalculateAllPaybackAmounts(contractAmount = getFieldsValue().contractAmount) {
    paybackRows.value.forEach((record) => calcPaybackAmount(record, contractAmount));
  }

  let userMap: Recordable = {};
  const defaultUser = computed(() => {
    const u: any = userStore.getUserInfo;
    return { id: String(u?.id ?? u?.userId ?? ''), username: String(u?.username || ''), name: u?.realname || u?.username || '' };
  });
  const isCurrentContractSubmitter = computed(() => {
    const creator = String(info.value.createBy || '');
    if (creator && defaultUser.value.username) return creator === defaultUser.value.username;
    return !!defaultUser.value.id && String(info.value.salesUserId ?? '') === defaultUser.value.id;
  });
  const isContractRevisable = computed(
    () => isApprovalRejected(info.value.status) || isApprovalWithdrawn(info.value.status) || isApprovalPendingSubmit(info.value.status)
  );
  // 合同提交人可撤回待审核合同，并修改待提交、驳回或已撤回合同；审批人仅处理待审核合同。
  const canEditContract = computed(() => isCurrentContractSubmitter.value && isContractRevisable.value);
  const canWithdrawContract = computed(() => isCurrentContractSubmitter.value && isApprovalPending(info.value.status));
  const canAuditContract = computed(() => isApprovalPending(info.value.status) && hasPermission('project:contract:audit'));
  const showAuditPanel = computed(() => readonly.value && !editing.value && canAuditContract.value && !contractLoadFailed.value);
  const isContractFormRendered = computed(() => !readonly.value || editing.value);

  const [registerForm, { resetFields, setFieldsValue, validate, updateSchema, getFieldsValue }] = useForm({
    labelWidth: 110,
    schemas: [
      {
        label: '合同类型',
        field: 'contractType',
        component: 'ApiSelect',
        componentProps: { api: () => loadDictOptions('contract_type'), placeholder: '请选择合同类型' },
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
        componentProps: {
          min: 0,
          precision: 2,
          placeholder: '请输入合同金额',
          addonAfter: '元',
          style: { width: '100%' },
          onChange: (value: number | null) => recalculateAllPaybackAmounts(value),
        },
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
        helpMessage: '合同签订的销售负责人',
        dynamicRules: () => [{ required: true, message: '请选择销售负责人!' }],
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
        label: '合同附件',
        field: 'contractAttachment',
        component: 'Input',
        slot: 'contractAttachment',
      },
      {
        label: '合同物料清单文件',
        field: 'materialAttachment',
        component: 'Input',
        slot: 'materialAttachment',
      },
      {
        label: '备注',
        field: 'remark',
        component: 'InputTextArea',
        componentProps: { placeholder: '请输入备注', rows: 2 },
        colProps: { span: 24 },
      },
      // 隐藏字段
      { label: '', field: 'id', component: 'Input', show: false },
      { label: '', field: 'periodId', component: 'Input', show: false },
      { label: '', field: 'projectId', component: 'Input', show: false },
      { label: '', field: 'salesUserName', component: 'Input', show: false },
    ],
    showActionButtonGroup: false,
    baseColProps: { xs: 24, sm: 24, md: 12 },
    rowProps: { gutter: 24 },
  });

  onMounted(async () => {
    if (pageMode.value !== 'create' && !periodId.value) {
      createMessage.error('查看或编辑合同必须提供项目分期 ID');
      await router.replace('/project/list');
      return;
    }

    const auxiliaryDataPromise = Promise.all([loadDictOptions('contract_type'), loadDictOptions('payback_node'), loadUsers()]);

    if (pageMode.value === 'create') {
      const [contractTypes, nodes] = await auxiliaryDataPromise;
      contractTypeOptions.value = contractTypes || [];
      paybackNodeOptions.value = nodes || [];
      await loadProjectRecord();
      await initializeCreateMode();
      return;
    }

    // 详情接口一次返回合同、两个文件记录与回款计划。
    await loadExistingContract();
    if (!contractLoadFailed.value) {
      await loadProjectRecord();
    }

    const [contractTypes, nodes] = await auxiliaryDataPromise;
    contractTypeOptions.value = contractTypes || [];
    paybackNodeOptions.value = nodes || [];
    if (pageMode.value === 'edit' && !contractLoadFailed.value && !paybackLoadFailed.value) {
      if (!canEditContract.value) {
        createMessage.warning('仅合同提交人可以修改待提交、已驳回或已撤回的合同');
        pageMode.value = 'view';
        readonly.value = true;
        editing.value = false;
        await router.replace({
          path: '/project/contract',
          query: { ...route.query, mode: 'view' },
        });
        return;
      }
      await fillContractForm();
    }
  });

  /** 加载全量用户(销售负责人下拉) */
  async function loadUsers() {
    userOptionsLoading.value = true;
    try {
      const users = await loadUserOptions();
      userOptions.value = users || [];
      userMap = (users || []).reduce((m, u) => {
        m[u.value] = { name: u.label };
        return m;
      }, {});
      // 查看模式不会渲染 BasicForm，不能在表单注册前调用表单实例方法。
      if (isContractFormRendered.value) {
        await updateSchema({ field: 'salesUserId', componentProps: { options: users || [] } });
      }
    } catch (error: any) {
      userOptions.value = [];
      userMap = {};
      createMessage.error(error?.message || '人员列表加载失败，请刷新后重试');
    } finally {
      userOptionsLoading.value = false;
    }
  }

  /** 项目基本信息始终按分期详情读取，新增合同页也需要完整回显。 */
  async function loadProjectRecord() {
    if (!periodId.value) {
      projectRecord.value = {};
      return;
    }
    try {
      const record: any = await projectDetail({ periodId: periodId.value });
      projectRecord.value = record || {};
      projectId.value = projectId.value || record?.projectId || '';
    } catch (error: any) {
      projectRecord.value = {};
      createMessage.error(error?.message || '项目基本信息加载失败，请稍后重试');
    }
  }

  /** 新增模式在已回显项目基本信息的前提下，初始化空合同表单，不读取已有合同或回款计划。 */
  async function initializeCreateMode() {
    await resetFields();
    readonly.value = false;
    editing.value = true;
    contractLoadFailed.value = false;
    paybackLoadFailed.value = false;
    contractId.value = '';
    info.value = {};
    paybackRows.value = [];
    await setFieldsValue({
      periodId: periodId.value,
      projectId: projectId.value,
      salesUserId: defaultUser.value.id,
      salesUserName: defaultUser.value.name,
    });
  }

  /** 查看/编辑模式按 Apifox 最新约定，仅使用 periodId 读取该分期唯一合同。 */
  async function loadExistingContract() {
    try {
      const detail: any = await contractDetailByPeriodId(periodId.value);
      const { contractFile, materialFile, records, ...contract } = detail || {};
      if (!contract?.id) throw new Error('合同详情不存在');

      contractLoadFailed.value = false;
      paybackLoadFailed.value = false;
      contractId.value = String(contract.id);
      periodId.value = periodId.value || contract.periodId || '';
      projectId.value = projectId.value || contract.projectId || '';
      info.value = { ...contract, contractFile, materialFile, records: records || [] };
      originalContract.value = { ...contract };
      approvalResult.value = undefined;
      approvalReason.value = '';
      projectManagerUserId.value = contract.projectManagerUserId || undefined;
      projectRecord.value = { ...contract, periodId: periodId.value, projectId: projectId.value };
      contractFileId.value = contract.contractFileId || contractFile?.fileId || contract.contractFilePath || '';
      contractFileName.value =
        contractFile?.fileName ||
        contract.contractFileName ||
        (contractFileId.value ? contractFileId.value.split('/').pop() || contractFileId.value : '');
      materialListFileId.value =
        contract.materialFileId || materialFile?.fileId || contract.materialListFileId || contract.materialListFilePath || '';
      materialFileName.value =
        materialFile?.fileName ||
        contract.materialFileName ||
        contract.materialListFileName ||
        (materialListFileId.value ? materialListFileId.value.split('/').pop() || materialListFileId.value : '');
      syncUploadFileList('contract');
      syncUploadFileList('material');
      setPaybackRows(records || []);
    } catch (error: any) {
      contractLoadFailed.value = true;
      readonly.value = true;
      editing.value = false;
      createMessage.error(error?.message || '合同信息加载失败，请稍后重试');
    }
  }

  async function fillContractForm() {
    await nextTick();
    await setFieldsValue({
      ...info.value,
      id: contractId.value,
      periodId: periodId.value,
      projectId: projectId.value,
    });
    recalculateAllPaybackAmounts(info.value.contractAmount);
  }

  function setPaybackRows(records: any[]) {
    paybackSeed = 0;
    paybackRows.value = (records || []).map((record: any) => ({
      ...record,
      _key: ++paybackSeed,
      id: record.id,
      node: record.paymentNode ?? record.node,
      ratio: Number(record.ratio) || 0,
      rollbackTime: record.rollbackTime == null ? 7 : Number(record.rollbackTime),
      amount: Number(record.plannedAmount ?? record.amount) || 0,
    }));
    paybackLoadFailed.value = false;
    recalculateAllPaybackAmounts(info.value.contractAmount);
  }

  type ContractUploadKind = 'contract' | 'material';

  function getUploadState(kind: ContractUploadKind) {
    return kind === 'contract'
      ? {
          fileId: contractFileId,
          fileName: contractFileName,
          fileList: contractUploadFileList,
          pendingFile: pendingContractFile,
          replacementRequired: contractReplacementRequired,
        }
      : {
          fileId: materialListFileId,
          fileName: materialFileName,
          fileList: materialUploadFileList,
          pendingFile: pendingMaterialFile,
          replacementRequired: materialReplacementRequired,
        };
  }

  function syncUploadFileList(kind: ContractUploadKind) {
    const { fileId, fileName, fileList, pendingFile, replacementRequired } = getUploadState(kind);
    pendingFile.value = undefined;
    replacementRequired.value = false;
    fileList.value = fileId.value
      ? [
          {
            uid: `${kind}-${contractId.value || periodId.value}`,
            name: fileName.value || fileId.value.split('/').pop() || '已上传文件',
            status: 'done',
            url: getFileAccessHttpUrl(fileId.value),
          },
        ]
      : [];
  }

  function handleBeforeUpload(file: File, kind: ContractUploadKind) {
    if (!isAllowedDocumentFile(file)) {
      createMessage.warning('仅支持 PDF、Word、Excel、PPT 文件');
      return Upload.LIST_IGNORE;
    }
    const state = getUploadState(kind);
    state.pendingFile.value = file;
    state.replacementRequired.value = false;
    // 仅本地选择并回显，保存时作为组合接口的文件 part 一并提交。
    return false;
  }

  function handleUploadChange(info: any, kind: ContractUploadKind) {
    const state = getUploadState(kind);
    state.fileList.value = (info?.fileList || []).slice(-1).map((item: any) => ({
      ...item,
      ...(item.status === 'done' && state.fileId.value ? { url: getFileAccessHttpUrl(state.fileId.value) } : {}),
    }));
  }

  function handleRemoveUpload(kind: ContractUploadKind) {
    const state = getUploadState(kind);
    state.pendingFile.value = undefined;
    state.fileList.value = [];
    state.replacementRequired.value = !!state.fileId.value;
    return true;
  }

  /** 从查看模式进入编辑，按最新接口约定仅保留分期与项目入口参数。 */
  async function startEdit() {
    if (!canEditContract.value) {
      createMessage.warning('仅合同提交人可以修改待提交、已驳回或已撤回的合同');
      return;
    }
    if (contractLoadFailed.value) {
      await loadExistingContract();
      if (contractLoadFailed.value) return;
    }
    if (paybackLoadFailed.value) {
      await loadExistingContract();
      if (paybackLoadFailed.value) return;
    }
    pageMode.value = 'edit';
    readonly.value = true;
    editing.value = true;
    await router.replace({
      path: '/project/contract',
      query: {
        ...route.query,
        mode: 'edit',
        contractId: undefined,
        periodId: periodId.value,
        projectId: projectId.value,
      },
    });
    await nextTick();
    await updateSchema({ field: 'salesUserId', componentProps: { options: userOptions.value } });
    await fillContractForm();
  }

  function handleAuditSubmit() {
    if (approvalResult.value === 'approve') return handleApprove();
    if (approvalResult.value === 'reject') return handleReject();
    createMessage.warning('请先选择审批结果');
  }

  /** 审批通过前写入项目经理，再更新合同和项目状态。 */
  async function handleApprove() {
    if (actionSubmitting.value) return;
    if (!canAuditContract.value) {
      createMessage.warning('当前合同不可审批或您没有审批权限');
      return;
    }
    if (!projectManagerUserId.value) {
      createMessage.warning('请选择项目经理');
      return;
    }
    const selected = userOptions.value.find((item) => String(item.value) === String(projectManagerUserId.value));
    actionSubmitting.value = true;
    try {
      await editContractWithPaymentRecords({
        contract: {
          periodId: periodId.value,
          projectManagerUserId: projectManagerUserId.value,
          projectManagerUserName: selected?.label || '',
        },
        records: buildPaybackRecords(true, info.value.contractAmount),
      });
      await changeContractStatus({ periodId: periodId.value, status: '1', approvalReason: '' });
      await changePeriodStatus({ periodId: periodId.value, status: 'PREPARING' });
      info.value = {
        ...info.value,
        status: '1',
        approvalReason: '',
        projectManagerUserId: projectManagerUserId.value,
        projectManagerUserName: selected?.label || '',
      };
      createMessage.success('合同审批通过，项目已进入筹备中');
      await router.push('/project/list');
    } catch (error: any) {
      createMessage.error(error?.message || '合同审批失败，请刷新后确认当前状态');
    } finally {
      actionSubmitting.value = false;
    }
  }

  async function handleReject() {
    if (actionSubmitting.value) return;
    if (!canAuditContract.value) {
      createMessage.warning('当前合同不可审批或您没有审批权限');
      return;
    }
    const reason = approvalReason.value.trim();
    if (!reason) {
      createMessage.warning('请填写驳回原因');
      return;
    }
    actionSubmitting.value = true;
    try {
      await changeContractStatus({ periodId: periodId.value, status: '0', approvalReason: reason });
      info.value = { ...info.value, status: '0', approvalReason: reason };
      createMessage.success('合同已驳回');
      await router.push('/project/list');
    } catch (error: any) {
      createMessage.error(error?.message || '合同驳回失败');
    } finally {
      actionSubmitting.value = false;
    }
  }

  /** 待审核合同仅允许原提交人撤回，撤回后留在当前页继续修改。 */
  async function handleWithdraw() {
    if (actionSubmitting.value) return;
    if (!canWithdrawContract.value) {
      createMessage.warning('仅合同提交人可以撤回待审核合同');
      return;
    }
    actionSubmitting.value = true;
    try {
      await changeContractStatus({ periodId: periodId.value, status: '3', approvalReason: '' });
      info.value = { ...info.value, status: '3', approvalReason: '' };
      approvalResult.value = undefined;
      createMessage.success('合同已撤回，可修改后重新提交');
    } catch (error: any) {
      createMessage.error(error?.message || '合同撤回失败，请刷新后重试');
    } finally {
      actionSubmitting.value = false;
    }
  }

  /** 校验回款项完整性及比例合计 */
  function validatePaybackPlan() {
    if (contractLoadFailed.value || paybackLoadFailed.value) {
      createMessage.warning('合同或回款计划尚未成功加载，请刷新后重试');
      return false;
    }
    if (!paybackRows.value.length) {
      createMessage.warning('请至少添加一个回款项');
      return false;
    }
    let totalRatio = new Big(0);
    for (const row of paybackRows.value) {
      if (!row.node) {
        createMessage.warning('请选择每一条回款项');
        return false;
      }
      const ratio = Number(row.ratio);
      if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 100) {
        createMessage.warning(`回款项「${row.node}」的比例必须大于 0 且不超过 100%`);
        return false;
      }
      const rollbackTime = Number(row.rollbackTime);
      if (!Number.isInteger(rollbackTime) || rollbackTime < 0) {
        createMessage.warning(`回款项「${row.node}」的回款周期必须是大于等于 0 的整数`);
        return false;
      }
      totalRatio = totalRatio.plus(ratio);
    }
    if (!totalRatio.eq(100)) {
      createMessage.warning(`当前回款比例合计为 ${totalRatio.toString()}%，必须等于 100%`);
      return false;
    }
    return true;
  }

  /** 按组合新增/全量同步接口生成回款计划明细。 */
  function buildPaybackRecords(includeIds: boolean, contractAmount?: unknown) {
    recalculateAllPaybackAmounts(contractAmount);
    const optionalFields = ['actualAmount', 'remark', 'plannedDate', 'paymentDate', 'invoiceStatus', 'payStatus', 'payMethod', 'rollbackTime'];
    return paybackRows.value.map((row) => {
      const record: Recordable = {
        ...(row.id && includeIds ? { id: String(row.id) } : {}),
        paymentNode: row.node,
        ratio: Number(row.ratio),
        plannedAmount: Number(row.amount),
      };
      optionalFields.forEach((field) => {
        if (row[field] !== undefined) record[field] = row[field];
      });
      return record;
    });
  }

  const editableContractFields = [
    'contractType',
    'contractNo',
    'contractName',
    'contractSignedDate',
    'plannedDeliveryDate',
    'contractAmount',
    'warrantyPeriod',
    'salesUserId',
    'salesUserName',
    'remark',
  ];

  function normalizeContractField(field: string, value: unknown) {
    if (field === 'contractAmount' || field === 'warrantyPeriod') {
      return value == null || value === '' ? '' : Number(value);
    }
    return value == null ? '' : String(value);
  }

  /** 修改接口仅传 periodId 与实际发生变化的合同字段。 */
  function buildChangedContract(values: Recordable) {
    const changed: Recordable = { periodId: periodId.value };
    editableContractFields.forEach((field) => {
      if (normalizeContractField(field, values[field]) !== normalizeContractField(field, originalContract.value[field])) {
        changed[field] = values[field];
      }
    });
    return changed;
  }

  /**
   * 新增/编辑均使用 multipart 组合接口；编辑合同字段差量提交，回款计划按接口约定全量同步。
   */
  async function handleSubmit() {
    try {
      const values = await validate();
      if (contractReplacementRequired.value && !pendingContractFile.value) {
        createMessage.warning('已移除原合同附件，请先选择新文件后再提交');
        return;
      }
      if (materialReplacementRequired.value && !pendingMaterialFile.value) {
        createMessage.warning('已移除原物料清单，请先选择新文件后再提交');
        return;
      }
      if (!validatePaybackPlan()) return;

      recalculateAllPaybackAmounts(values.contractAmount);
      const wasNewContract = !contractId.value;
      submitting.value = true;
      if (wasNewContract) {
        const payload = {
          ...values,
          periodId: periodId.value,
          projectId: projectId.value,
        };
        const result: any = await addContractWithPaymentRecords(
          {
            contract: {
              ...payload,
              // 合同审批约定：0 驳回、1 通过、2 待审核、3 已撤回、其他待提交。
              status: '2',
              approvalReason: '',
            },
            ...(pendingContractFile.value ? { contractFile: { fileName: pendingContractFile.value.name } } : {}),
            ...(pendingMaterialFile.value ? { materialFile: { fileName: pendingMaterialFile.value.name } } : {}),
            records: buildPaybackRecords(false, values.contractAmount),
          },
          pendingContractFile.value,
          pendingMaterialFile.value
        );
        const savedContract = result?.contract;
        if (!savedContract?.id) throw new Error('合同与回款计划已提交，但接口未返回合同 ID，请刷新列表确认');
        contractId.value = String(savedContract.id);
        info.value = { ...info.value, ...savedContract };
      } else {
        const result: any = await editContractWithPaymentRecords(
          {
            contract: buildChangedContract(values),
            ...(pendingContractFile.value ? { contractFile: { fileName: pendingContractFile.value.name } } : {}),
            ...(pendingMaterialFile.value ? { materialFile: { fileName: pendingMaterialFile.value.name } } : {}),
            records: buildPaybackRecords(true, values.contractAmount),
          },
          pendingContractFile.value,
          pendingMaterialFile.value
        );
        info.value = { ...info.value, ...(result?.contract || buildChangedContract(values)), status: '2', approvalReason: '' };
      }

      info.value.status = '2';
      createMessage.success(wasNewContract ? '合同已提交，等待审核' : '合同与回款计划已修改并重新提交审核');
      router.push('/project/list');
    } catch (error: any) {
      if (error?.errorFields) return Promise.reject(error.errorFields);
      createMessage.error(error?.message || '合同提交失败，请确认当前保存状态后重试');
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

    &__project {
      margin-bottom: 16px;
    }

    &__attachment-upload {
      width: 100%;

      :deep(.ant-upload-list) {
        margin-top: 4px;
      }

      :deep(.ant-upload-list-item-name) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &__payback {
      margin-top: 16px;

      &-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin: 12px 0;
      }

      &-cycle-title {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
    }

    &__reject-alert {
      margin-bottom: 16px;
    }

    &__reject-reason {
      color: #cf1322;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    &__audit {
      margin-top: 12px;

      &-decision,
      &-field {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      &-field {
        margin-top: 16px;
      }

      &-label {
        width: 110px;
        flex-shrink: 0;
        line-height: 32px;
        text-align: right;
      }

      &-content {
        min-width: 0;
        flex: 1;
      }

      &-hint {
        margin: 7px 0 0;
        color: #595959;
        font-size: 13px;
        line-height: 20px;
      }

      &-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 20px;
      }

      :deep(.ant-radio-button-wrapper) {
        min-width: 96px;
        text-align: center;
      }
    }

    &__required {
      margin-right: 4px;
      color: #cf1322;
    }

    &__footer {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 16px 0 24px;
    }
  }

  @media (max-width: 768px) {
    .contract-page {
      padding: 12px;

      &__audit-decision,
      &__audit-field {
        display: block;
      }

      &__audit-label {
        display: block;
        width: auto;
        margin-bottom: 6px;
        text-align: left;
      }
    }
  }
</style>
