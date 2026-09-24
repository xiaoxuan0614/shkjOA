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
          <a-descriptions-item label="项目金额">{{ info.contractAmount != null ? `${info.contractAmount} 元` : '—' }}</a-descriptions-item>
          <a-descriptions-item label="质保期">{{ info.warrantyPeriod != null ? `${info.warrantyPeriod} 月` : '—' }}</a-descriptions-item>
          <a-descriptions-item label="销售负责人">{{ salesUserName }}</a-descriptions-item>
          <a-descriptions-item label="项目经理">{{ projectManagerName }}</a-descriptions-item>
          <a-descriptions-item v-if="isApprovalRejected(info.status)" label="驳回原因" :span="2">
            <span class="contract-page__reject-reason">{{ info.approvalReason || '未填写驳回原因' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="合同附件" :span="2">
            <a-space v-if="contractAttachments.length" direction="vertical" size="small">
              <a-button
                v-for="file in contractAttachments"
                :key="file.uid"
                size="small"
                preIcon="ant-design:eye-outlined"
                @click="previewFileInModal(file.fileId, file.fileName)"
              >
                预览：{{ file.fileName }}
              </a-button>
            </a-space>
            <span v-else>—</span>
          </a-descriptions-item>
          <a-descriptions-item label="关联报价单" :span="2">
            <a-button v-if="materialCandidateId" @click="openQuotation(false)">{{ selectedCandidate?.candidateName || '查看报价详情' }}</a-button>
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
              <template v-else-if="column.key === 'node'">{{ record.paymentNode_dictText || record.node_dictText || getOptionLabel(paybackNodeOptions, record.node) }}</template>
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
          <template #quotation>
            <a-space wrap>
              <a-select
                :value="materialCandidateId"
                @change="handleQuotationSelection"
                @dropdown-visible-change="(open) => { if (open && !candidatesLoading && !contractCandidates.length) loadContractCandidates(); }"
                :options="contractCandidateOptions"
                :loading="candidatesLoading"
                :disabled="submitting || quotationSaving || candidatesLoading"
                show-search
                :filter-option="filterQuotationByName"
                allow-clear
                placeholder="可选：请选择已通过的报价单"
                style="min-width: 240px"
              />
              <a-button
                v-if="materialCandidateId"
                :disabled="submitting || quotationSaving || candidatesLoading"
                @click="handleQuotationSelection(undefined)"
                >取消选择</a-button
              >
              <a-button :disabled="!canAdjustQuotation || submitting" @click="openQuotation(true)">修改调整</a-button>
              <a-popconfirm v-if="canReleaseQuotation" title="解除采用后可调整同一张报价单，确认解锁？" @confirm="releaseQuotation">
                <a-button :loading="quotationSaving">解锁报价</a-button>
              </a-popconfirm>
            </a-space>
          </template>
          <template #contractAttachment>
            <div class="contract-page__attachment-upload">
              <input
                ref="contractAttachmentInput"
                type="file"
                hidden
                :accept="DOCUMENT_UPLOAD_ACCEPT"
                :disabled="submitting || attachmentUploading || contractAttachments.length >= CONTRACT_ATTACHMENT_LIMIT"
                @change="handleContractAttachmentSelection"
              />
                <a-button
                  :loading="attachmentUploading"
                  :disabled="submitting || attachmentUploading || contractAttachments.length >= CONTRACT_ATTACHMENT_LIMIT"
                  @click="openContractAttachmentPicker"
                >
                  <Icon icon="ant-design:cloud-upload-outlined" />
                  上传合同附件（{{ contractAttachments.length }}/{{ CONTRACT_ATTACHMENT_LIMIT }}）
                </a-button>
              <div class="contract-page__attachment-hint">请逐个上传，至少 1 个、最多 3 个；上传成功后可立即预览。</div>
              <div v-if="contractAttachments.length" class="contract-page__attachment-list">
                <div v-for="file in contractAttachments" :key="file.uid" class="contract-page__attachment-item">
                  <span class="contract-page__attachment-name" :title="file.fileName">{{ file.fileName }}</span>
                  <a-space size="small">
                    <a-button type="link" size="small" @click="previewFileInModal(file.fileId, file.fileName)">预览</a-button>
                    <a-button
                      type="link"
                      danger
                      size="small"
                      :disabled="submitting || attachmentUploading"
                      @click="removeContractAttachment(file.uid)"
                    >
                      删除
                    </a-button>
                  </a-space>
                </div>
              </div>
            </div>
          </template>
        </BasicForm>

        <!-- 回款计划(节点 + 比例, 金额 = 项目金额 × 比例) -->
        <div class="contract-page__payback">
          <div class="contract-page__payback-title">
            <span>回款计划</span>
            <a-button
              type="primary"
              size="small"
              preIcon="ant-design:plus-outlined"
              :disabled="!canAddPayback"
              :title="canAddPayback ? '添加款项' : '所有可用回款项均已添加'"
              @click="addPaybackRow"
            >
              添加款项
            </a-button>
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
                  <span v-if="column.required" class="contract-page__required" aria-hidden="true">*</span>
                  <a-tooltip title="阶段任务完成后回款的周期">
                    <Icon icon="ant-design:question-circle-outlined" size="14" />
                  </a-tooltip>
                </span>
              </template>
              <template v-else>
                <span>
                  {{ column.title }}
                  <span v-if="column.required" class="contract-page__required" aria-hidden="true">*</span>
                </span>
              </template>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'index'">{{ record._key }}</template>
              <template v-else-if="column.key === 'node'">
                <UniqueRowSelect
                  v-model="record.node"
                  :rows="paybackRows"
                  :row="record"
                  :options="paybackNodeOptions"
                  field="node"
                  placeholder="请选择回款项"
                  :error="getPaybackError(record, 'node')"
                  @change="() => clearPaybackError(record, 'node')"
                />
              </template>
              <template v-else-if="column.key === 'ratio'">
                <div class="contract-page__cell-field">
                  <a-input-number
                    v-model:value="record.ratio"
                    :min="0"
                    :max="100"
                    :precision="2"
                    addon-after="%"
                    style="width: 100%"
                    placeholder="请输入比例"
                    :status="getPaybackError(record, 'ratio') ? 'error' : undefined"
                    @change="() => handlePaybackRatioChange(record)"
                  />
                  <div v-if="getPaybackError(record, 'ratio')" class="contract-page__cell-error" role="alert">
                    {{ getPaybackError(record, 'ratio') }}
                  </div>
                </div>
              </template>
              <template v-else-if="column.key === 'rollbackTime'">
                <div class="contract-page__cell-field">
                  <a-input-number
                    v-model:value="record.rollbackTime"
                    :min="0"
                    :precision="0"
                    addon-after="天"
                    style="width: 100%"
                    placeholder="请输入周期"
                    :status="getPaybackError(record, 'rollbackTime') ? 'error' : undefined"
                    @change="() => clearPaybackError(record, 'rollbackTime')"
                  />
                  <div v-if="getPaybackError(record, 'rollbackTime')" class="contract-page__cell-error" role="alert">
                    {{ getPaybackError(record, 'rollbackTime') }}
                  </div>
                </div>
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
          @dropdown-visible-change="(open) => { if (open && !usersLoaded && !userOptionsLoading) loadUsers(); }"
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
  <a-modal
    v-model:open="quotationOpen"
    :title="quotationEditing ? '关联报价单修改调整' : '关联报价单详情'"
    :width="1100"
    :mask-closable="false"
    :closable="!quotationSaving"
    :keyboard="!quotationSaving"
    :confirm-loading="quotationSaving"
    :ok-text="quotationEditing ? '保存调整' : '关闭'"
    :cancel-button-props="{ disabled: quotationSaving }"
    @ok="saveQuotation"
  >
    <MaterialPlanTable
      v-if="quotationOpen"
      :key="materialCandidateId"
      ref="quotationTable"
      :candidate-id="materialCandidateId"
      mode="quotation"
      paginated
      :editable="quotationEditing && !quotationSaving"
      :combined-material-identity="!quotationEditing"
    />
  </a-modal>
</template>

<script lang="ts" setup>
  import { ref, computed, nextTick, onMounted } from 'vue';
  import Big from 'big.js';
  import { useRoute, useRouter } from 'vue-router';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { UniqueRowSelect, useUniqueRowOptions, validateEditableRows } from '/@/components/EditableTable';
  import { Icon } from '/@/components/Icon';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { useUserStore } from '/@/store/modules/user';
  import { useSessionDraft } from '/@/hooks/web/useSessionDraft';
  import { DOCUMENT_UPLOAD_ACCEPT, isAllowedDocumentFile, uploadProjectDocument } from '/@/utils/documentUpload';
  import { previewFileInModal } from '/@/utils/filePreview';
  import {
    addContractWithPaymentRecords,
    contractDetailByPeriodId,
    editContractWithPaymentRecords,
    changeContractStatus,
  } from '/@/views/payment/Payment.api';
  import { projectDetail } from '../Project.api';
  import { loadDictOptions } from '../Project.data';
  import PlanProjectInfo from '../plan/PlanProjectInfo.vue';
  import { expandContractAttachments } from './contractAttachments';
  import MaterialPlanTable from '/@/views/plan/components/MaterialPlanTable.vue';
  import {
    getAllMaterialCandidates,
    reviseMaterialCandidate,
    getQuotationAccess,
    updateMaterialCandidateAdoption,
    QUOTATION_STATUS_APPROVED,
    isQuotationAdopted,
  } from '/@/views/plan/Plan.api';
  import { assertQuotationVersion, noQuotationAccess, quotationCapabilities } from '/@/views/plan/quotationGovernance';
  import { loadUserOptions, type UserOption } from '/@/views/resource/userOptions';
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
  const CONTRACT_ATTACHMENT_LIMIT = 3;
  type ContractAttachment = {
    uid: string;
    id?: string;
    fileId: string;
    fileName: string;
  };
  const contractAttachments = ref<ContractAttachment[]>([]);
  const attachmentUploading = ref(false);
  const contractAttachmentInput = ref<HTMLInputElement | null>(null);
  const materialCandidateId = ref<string>();
  const contractCandidates = ref<Recordable[]>([]);
  const candidatesLoading = ref(false);
  const candidatesFailed = ref(false);
  const quotationOpen = ref(false);
  const quotationEditing = ref(false);
  const quotationSaving = ref(false);
  const quotationTable = ref();
  const quotationAccess = ref({ ...noQuotationAccess });
  const quotationSnapshot = ref<Recordable>({});
  const canReleaseQuotation = computed(
    () =>
      canEditContract.value &&
      quotationCapabilities(selectedCandidate.value, quotationAccess.value, userStore.getUserInfo, hasPermission).edit &&
      (isApprovalRejected(info.value.status) || isApprovalWithdrawn(info.value.status)) &&
      isQuotationAdopted(selectedCandidate.value)
  );
  async function releaseQuotation() {
    if (!canReleaseQuotation.value || quotationSaving.value) return;
    quotationSaving.value = true;
    try {
      const seen = { ...selectedCandidate.value };
      await loadContractCandidates();
      assertQuotationVersion(seen, selectedCandidate.value);
      if (candidatesFailed.value || !canReleaseQuotation.value) throw new Error('报价状态已变化，请刷新');
      await updateMaterialCandidateAdoption(selectedCandidate.value!, 0, false);
      await loadContractCandidates();
      createMessage.success('报价已解除采用，可按报价授权修改');
    } catch (error: any) {
      createMessage.error(error?.message || '解锁失败');
    } finally {
      quotationSaving.value = false;
    }
  }
  const selectedCandidate = computed(() => contractCandidates.value.find((item) => String(item.id) === materialCandidateId.value));
  const contractCandidateOptions = computed(() =>
    contractCandidates.value
      .filter((item) => String(item.status) === QUOTATION_STATUS_APPROVED)
      .map((item) => ({ value: String(item.id), label: item.candidateName }))
  );
  const canAdjustQuotation = computed(
    () =>
      !!selectedCandidate.value &&
      quotationCapabilities(selectedCandidate.value, quotationAccess.value, userStore.getUserInfo, hasPermission).structure &&
      String(selectedCandidate.value.status) === QUOTATION_STATUS_APPROVED &&
      !isQuotationAdopted(selectedCandidate.value) &&
      (!readonly.value || editing.value)
  );

  function filterQuotationByName(input: string, option: { label?: unknown }) {
    return String(option?.label || '')
      .toLocaleLowerCase()
      .includes(input.trim().toLocaleLowerCase());
  }

  async function handleQuotationSelection(value?: string) {
    if (submitting.value || quotationSaving.value || candidatesLoading.value) return;
    if (value === materialCandidateId.value) return;
    if (isQuotationAdopted(selectedCandidate.value)) {
      if (!canReleaseQuotation.value) {
        createMessage.warning('已采用报价须在合同驳回或撤回后解除采用，才能取消或更换');
        return;
      }
      quotationSaving.value = true;
      try {
        await updateMaterialCandidateAdoption(selectedCandidate.value!, 0, false);
        await loadContractCandidates();
        if (candidatesFailed.value) return;
      } catch (error: any) {
        createMessage.error(error?.message || '解除报价采用失败，原选择已保留');
        return;
      } finally {
        quotationSaving.value = false;
      }
    }
    materialCandidateId.value = value || undefined;
  }

  async function loadContractCandidates(restoreSelection = false) {
    candidatesLoading.value = true;
    candidatesFailed.value = false;
    try {
      quotationAccess.value = { ...noQuotationAccess };
      const [candidates, access] = await Promise.all([getAllMaterialCandidates(periodId.value), getQuotationAccess(periodId.value)]);
      contractCandidates.value = candidates;
      quotationAccess.value = access;
      const adopted = contractCandidates.value.filter((item) => isQuotationAdopted(item));
      if (adopted.length > 1) throw new Error('当前分期存在多张已采用报价，请联系管理员核对');
      if (restoreSelection && adopted.length) materialCandidateId.value = String(adopted[0].id);
    } catch (error: any) {
      candidatesFailed.value = true;
      createMessage.error(error?.message || '关联报价加载失败');
    } finally {
      candidatesLoading.value = false;
    }
  }

  async function openQuotation(edit: boolean) {
    await loadContractCandidates();
    if (candidatesFailed.value || !selectedCandidate.value) return;
    if (edit && !canAdjustQuotation.value) return createMessage.warning('当前报价不可修改');
    quotationSnapshot.value = { ...selectedCandidate.value };
    quotationEditing.value = edit;
    quotationOpen.value = true;
  }

  async function saveQuotation() {
    if (!quotationEditing.value) {
      quotationOpen.value = false;
      return;
    }
    if (quotationSaving.value) return;
    quotationSaving.value = true;
    try {
      const records = quotationTable.value?.getData();
      if (!records?.length) throw new Error('报价至少需要一条物料');
      await loadContractCandidates();
      if (candidatesFailed.value || !canAdjustQuotation.value) throw new Error('报价状态已变化，请重新打开');
      assertQuotationVersion(quotationSnapshot.value, selectedCandidate.value);
      await reviseMaterialCandidate({ candidateId: materialCandidateId.value, candidateName: quotationSnapshot.value.candidateName, version: quotationSnapshot.value.version, records });
      await loadContractCandidates();
      quotationOpen.value = false;
      createMessage.success('报价调整已保存；计价基础变更需重新审批后才能用于合同');
    } catch (error: any) {
      createMessage.error(error?.message || '报价调整保存失败');
    } finally {
      quotationSaving.value = false;
    }
  }
  const userOptions = ref<UserOption[]>([]);
  const userOptionsLoading = ref(false);
  const approvalResult = ref<'approve' | 'reject'>();
  const projectManagerUserId = ref<string>();
  const approvalReason = ref('');

  // 回款计划(节点 + 比例, 金额 = 项目金额 × 比例)
  const paybackColumns = computed(() => {
    const required = !readonly.value || editing.value;
    const columns: any[] = [
      { title: '序号', key: 'index', width: 60 },
      { title: '回款项', key: 'node', width: 180, required },
      { title: '比例(%)', key: 'ratio', width: 150, required },
      { title: '回款周期', key: 'rollbackTime', width: 150, required },
      { title: '回款金额(自动)', key: 'amount', width: 170 },
    ];
    if (!readonly.value || editing.value) columns.push({ title: '操作', key: 'action', width: 80, align: 'center' });
    return columns;
  });
  const paybackRows = ref<any[]>([]);
  let paybackSeed = 0;
  const contractTypeOptions = ref<{ label: string; value: string }[]>([]);
  const paybackNodeOptions = ref<{ label: string; value: string }[]>([]);
  const { canAdd: canAddPayback } = useUniqueRowOptions(paybackRows, paybackNodeOptions, { field: 'node' });
  const paybackErrors = ref<Record<string, string>>({});

  function getPaybackError(record: Recordable, field: string) {
    return paybackErrors.value[`${record._key}:${field}`] || '';
  }

  function clearPaybackError(record: Recordable, field: string) {
    const key = `${record._key}:${field}`;
    if (!paybackErrors.value[key]) return;
    const next = { ...paybackErrors.value };
    delete next[key];
    paybackErrors.value = next;
  }

  function getOptionLabel(options: { label: string; value: string }[], value: unknown) {
    if (value == null || value === '') return '—';
    return options.find((item) => String(item.value) === String(value))?.label || String(value);
  }

  const contractTypeText = computed(() => info.value.contractType_dictText || getOptionLabel(contractTypeOptions.value, info.value.contractType));
  const salesUserName = computed(() => {
    const salesUser = info.value.salesUser || info.value.saleUser || {};
    const isValidName = (value: unknown) => {
      const text = String(value || '').trim();
      return !!text && text !== '-' && text !== '—';
    };
    const snapshot = [
      info.value.salesUserName,
      info.value.saleUserName,
      info.value.salesUserRealName,
      info.value.salesName,
      projectRecord.value.salesUserName,
      projectRecord.value.saleUserName,
      projectRecord.value.salesName,
      salesUser.realname,
      salesUser.realName,
      salesUser.name,
      salesUser.username,
    ].find(isValidName);
    if (snapshot) return String(snapshot).trim();

    const salesUserId =
      info.value.salesUserId ??
      info.value.saleUserId ??
      projectRecord.value.salesUserId ??
      projectRecord.value.saleUserId ??
      salesUser.id ??
      salesUser.userId;
    if (salesUserId != null && salesUserId !== '') {
      const matched = userOptions.value.find(
        (item) => String(item.value) === String(salesUserId) || String(item.username || '') === String(salesUserId)
      );
      if (matched?.label) return matched.label;
    }

    const creator = info.value.createBy ?? info.value.createUser ?? info.value.creator;
    if (isValidName(creator)) {
      const matched = userOptions.value.find((item) => String(item.username || '') === String(creator) || String(item.value) === String(creator));
      if (matched?.label) return matched.label;
      return String(creator).trim();
    }
    return '—';
  });
  const projectManagerName = computed(() => {
    const snapshot = String(info.value.projectManagerUserName || '').trim();
    if (snapshot && snapshot !== '—') return snapshot;
    const managerId = info.value.projectManagerUserId;
    const matchedName = userOptions.value.find((item) => String(item.value) === String(managerId ?? ''))?.label;
    if (matchedName) return matchedName;
    return isApprovalPending(info.value.status) ? '待指定' : '—';
  });

  function addPaybackRow() {
    if (!canAddPayback.value) {
      createMessage.info('所有可用回款项均已添加');
      return;
    }
    paybackRows.value.push({ _key: ++paybackSeed, node: undefined, ratio: undefined, rollbackTime: 7, amount: 0 });
  }
  function removePaybackRow(key: number) {
    paybackRows.value = paybackRows.value.filter((r) => r._key !== key);
    paybackErrors.value = Object.fromEntries(Object.entries(paybackErrors.value).filter(([errorKey]) => !errorKey.startsWith(`${key}:`)));
  }
  /** 金额 = 项目金额 × 比例%，统一保留两位小数 */
  function calculatePaybackAmount(contractAmount: unknown, ratio: unknown) {
    const amount = Number(contractAmount) || 0;
    const percent = Number(ratio) || 0;
    if (amount <= 0 || percent <= 0) return 0;
    return Number(new Big(amount).times(percent).div(100).round(2, Big.roundHalfUp).toString());
  }

  function calcPaybackAmount(record: any, contractAmount = getFieldsValue().contractAmount) {
    record.amount = calculatePaybackAmount(contractAmount, record.ratio);
  }

  function handlePaybackRatioChange(record: Recordable) {
    clearPaybackError(record, 'ratio');
    calcPaybackAmount(record);
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
  // 合同提交人可撤回待审批合同，并修改待提交、驳回或已撤回合同；审批人仅处理待审批合同。
  const canEditContract = computed(() => isCurrentContractSubmitter.value && isContractRevisable.value);
  const canWithdrawContract = computed(() => isCurrentContractSubmitter.value && isApprovalPending(info.value.status));
  const canAuditContract = computed(() => isApprovalPending(info.value.status) && hasPermission('project:contract:approve'));
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
        dynamicRules: () => [{ required: true, message: '请选择计划交付日期!' }],
      },
      {
        label: '合同编号',
        field: 'contractNo',
        component: 'Input',
        componentProps: { placeholder: '请输入合同编号（合同上的编号）' },
      },
      {
        label: '项目金额',
        field: 'contractAmount',
        component: 'InputNumber',
        componentProps: {
          min: 0,
          precision: 2,
          placeholder: '请输入项目金额',
          addonAfter: '元',
          style: { width: '100%' },
          onChange: (value: number | null) => recalculateAllPaybackAmounts(value),
        },
        dynamicRules: () => [{ required: true, message: '请输入项目金额!' }],
      },
      {
        label: '质保期',
        field: 'warrantyPeriod',
        component: 'InputNumber',
        componentProps: { min: 0, precision: 0, placeholder: '请输入质保期', addonAfter: '月', style: { width: '100%' } },
        dynamicRules: () => [{ required: true, message: '请输入质保期!' }],
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
          onDropdownVisibleChange: (open: boolean) => { if (open && !userOptionsLoading.value && !usersLoaded) void loadUsers(); },
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
        colProps: { span: 24 },
      },
      { label: '关联报价单', field: 'quotation', component: 'Input', slot: 'quotation', colProps: { span: 24 } },
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
    const entryPermission = pageMode.value === 'create' ? 'project:contract' : 'project:contract:view';
    const approvalEntry = pageMode.value === 'view' && hasPermission('project:contract:approve');
    if (!hasPermission(entryPermission) && !approvalEntry) {
      createMessage.warning('无合同信息访问权限');
      await router.replace('/project/list');
      return;
    }
    if (pageMode.value !== 'create' && !periodId.value) {
      createMessage.error('查看或编辑合同必须提供项目分期 ID');
      await router.replace('/project/list');
      return;
    }

    const auxiliaryDataPromise = pageMode.value === 'view'
      ? Promise.resolve([[], []])
      : Promise.all([loadDictOptions('contract_type'), loadDictOptions('payback_node')]);

    if (pageMode.value === 'create') {
      const [contractTypes, nodes] = await auxiliaryDataPromise;
      contractTypeOptions.value = contractTypes || [];
      paybackNodeOptions.value = nodes || [];
      await loadProjectRecord();
      await initializeCreateMode();
      await restoreContractDraft();
      return;
    }

    // 详情接口一次返回合同、两个文件记录与回款计划。
    await loadExistingContract();
    // 审批权限仅为待审批合同提供入口，不替代普通合同查看权限。
    if (!contractLoadFailed.value && !hasPermission('project:contract:view') && !canAuditContract.value) {
      info.value = {};
      createMessage.warning('合同已不在待审批状态，无法通过审批入口查看');
      await router.replace('/project/list');
      return;
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
    await restoreContractDraft();
  });

  /** 加载全量用户(销售负责人下拉) */
  let usersLoaded = false;
  async function loadUsers() {
    if (userOptionsLoading.value || usersLoaded) return;
    userOptionsLoading.value = true;
    try {
      const users = await loadUserOptions();
      userOptions.value = users || [];
      usersLoaded = true;
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
    contractAttachments.value = [];
    paybackRows.value = [];
    paybackErrors.value = {};
    if (defaultUser.value.id && defaultUser.value.name) {
      userOptions.value = [{ value: String(defaultUser.value.id), label: defaultUser.value.name }];
      userMap[String(defaultUser.value.id)] = { name: defaultUser.value.name };
      await updateSchema({ field: 'salesUserId', componentProps: { options: userOptions.value } });
    }
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
      materialCandidateId.value = contract.materialCandidateId || undefined;
      if (contract.salesUserId && contract.salesUserName && !usersLoaded) {
        userOptions.value = [{ value: String(contract.salesUserId), label: contract.salesUserName }];
        userMap[String(contract.salesUserId)] = { name: contract.salesUserName };
      }
      originalContract.value = { ...contract };
      approvalResult.value = undefined;
      approvalReason.value = '';
      projectManagerUserId.value = contract.projectManagerUserId || undefined;
      projectRecord.value = { ...contract, periodId: periodId.value, projectId: projectId.value };
      await loadContractAttachments({ contract, contractFile, materialFile });
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
    await updateSchema({ field: 'salesUserId', componentProps: { options: userOptions.value } });
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
    paybackErrors.value = {};
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

  function attachmentFromRecord(record: Recordable, index: number): ContractAttachment | undefined {
    const fileId = String(record?.fileId || record?.url || '').trim();
    if (!fileId) return undefined;
    return {
      uid: `contract-attachment-${record?.id || index}-${fileId}`,
      ...(record?.id ? { id: String(record.id) } : {}),
      fileId,
      fileName: String(record?.fileName || fileId.split('/').pop() || `合同附件${index + 1}`),
    };
  }

  /** 回显仅使用合同组合详情，不额外查询项目附件列表。 */
  async function loadContractAttachments(detail: { contract?: Recordable; contractFile?: Recordable; materialFile?: Recordable }) {
    const contract = detail.contract || {};
    const legacyRecords = expandContractAttachments([
      {
        fileId: contract.contractFileId || detail.contractFile?.fileId || contract.contractFilePath,
        fileName: detail.contractFile?.fileName || contract.contractFileName,
      },
      {
        fileId: contract.materialFileId || detail.materialFile?.fileId || contract.materialListFileId || contract.materialListFilePath,
        fileName: detail.materialFile?.fileName || contract.materialFileName || contract.materialListFileName,
      },
    ])
      .map(attachmentFromRecord)
      .filter(Boolean) as ContractAttachment[];

    contractAttachments.value = legacyRecords.map((item) => ({ ...item }));
  }

  function openContractAttachmentPicker() {
    if (submitting.value || attachmentUploading.value || contractAttachments.value.length >= CONTRACT_ATTACHMENT_LIMIT) return;
    contractAttachmentInput.value?.click();
  }

  async function handleContractAttachmentSelection(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // 清空选择值，取消或上传失败后可重新选择同一个文件。
    input.value = '';
    if (!file || submitting.value) return;
    await handleContractAttachmentUpload(file);
  }

  async function handleContractAttachmentUpload(file: File) {
    if (!isAllowedDocumentFile(file)) {
      createMessage.warning('仅支持 PDF、Word、Excel、PPT 文件');
      return;
    }
    if (attachmentUploading.value) return;
    if (contractAttachments.value.length >= CONTRACT_ATTACHMENT_LIMIT) {
      createMessage.warning(`合同附件最多上传 ${CONTRACT_ATTACHMENT_LIMIT} 个`);
      return;
    }
    attachmentUploading.value = true;
    try {
      const { path } = await uploadProjectDocument(file, periodId.value);
      contractAttachments.value.push({
        uid: `uploaded-${Date.now()}-${file.name}`,
        fileId: path,
        fileName: file.name,
      });
      createMessage.success(`“${file.name}”上传成功`);
    } catch (error: any) {
      createMessage.error(error?.message || `“${file.name}”上传失败，请重试`);
    } finally {
      attachmentUploading.value = false;
    }
  }

  function removeContractAttachment(uid: string) {
    contractAttachments.value = contractAttachments.value.filter((item) => item.uid !== uid);
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
    const [contractTypes, nodes] = await Promise.all([
      loadDictOptions('contract_type'), loadDictOptions('payback_node'),
    ]);
    contractTypeOptions.value = contractTypes || [];
    paybackNodeOptions.value = nodes || [];
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
    if (!info.value.plannedDeliveryDate) {
      createMessage.warning('合同缺少计划交付日期，请先驳回并补充后重新提交');
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
          ...buildSalesFields(info.value),
        },
        records: buildPaybackRecords(true, info.value.contractAmount),
      });
      await changeContractStatus({ periodId: periodId.value, status: '1', approvalReason: '' });
      info.value = {
        ...info.value,
        status: '1',
        approvalReason: '',
        projectManagerUserId: projectManagerUserId.value,
        projectManagerUserName: selected?.label || '',
      };
      createMessage.success('合同审批通过，请由项目经理完善并提交分期计划');
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

  /** 待审批合同仅允许原提交人撤回，撤回后留在当前页继续修改。 */
  async function handleWithdraw() {
    if (actionSubmitting.value) return;
    if (!canWithdrawContract.value) {
      createMessage.warning('仅合同提交人可以撤回待审批合同');
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
    const issues = validateEditableRows(paybackRows.value, {
      selectorField: 'node',
      selectorLabel: '回款项',
      optionLabel: (value) => getOptionLabel(paybackNodeOptions.value, value),
      rules: [
        {
          field: 'ratio',
          label: '回款比例',
          required: true,
          validate: (value) => {
            const ratio = Number(value);
            return (Number.isFinite(ratio) && ratio > 0 && ratio <= 100) || '回款比例必须大于 0 且不超过 100%';
          },
        },
        {
          field: 'rollbackTime',
          label: '回款周期',
          required: true,
          validate: (value) => {
            const rollbackTime = Number(value);
            return (Number.isInteger(rollbackTime) && rollbackTime >= 0) || '回款周期必须是大于等于 0 的整数';
          },
        },
      ],
    });
    paybackErrors.value = Object.fromEntries(issues.map((issue) => [`${issue.row._key}:${issue.field}`, issue.message]));
    if (issues.length) {
      createMessage.warning(issues[0].message);
      return false;
    }
    const totalRatio = paybackRows.value.reduce((total, row) => total.plus(Number(row.ratio)), new Big(0));
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
  const contractDraft = useSessionDraft<any>(`contract:${periodId.value}:${contractId.value || 'new'}`, () => {
    if (!editing.value || submitting.value || contractLoadFailed.value || paybackLoadFailed.value) return undefined;
    const form = getFieldsValue();
    return {
      baseline: JSON.stringify(originalContract.value),
      form: Object.fromEntries(editableContractFields.map((field) => [field, form[field]])),
      attachments: contractAttachments.value,
      candidateId: materialCandidateId.value,
      payments: paybackRows.value.map((row) => ({ id: row.id, node: row.node, ratio: row.ratio, remark: row.remark, plannedDate: row.plannedDate, rollbackTime: row.rollbackTime })),
    };
  });
  async function restoreContractDraft() {
    if (!contractDraft.isAlive() || !editing.value) return;
    const saved = contractDraft.read();
    if (saved?.form && saved.baseline === JSON.stringify(originalContract.value)) {
      await setFieldsValue(Object.fromEntries(editableContractFields.map((field) => [field, saved.form[field]])));
      if (Array.isArray(saved.attachments)) contractAttachments.value = saved.attachments;
      materialCandidateId.value = saved.candidateId || undefined;
      if (Array.isArray(saved.payments)) paybackRows.value = saved.payments.map((row: any) => ({ ...paybackRows.value.find((item) => row.id && item.id === row.id), ...row, _key: ++paybackSeed }));
      recalculateAllPaybackAmounts(saved.form.contractAmount);
    } else if (saved) {
      contractDraft.clear();
      createMessage.warning('合同服务端内容已变化，未覆盖旧草稿，请核对最新合同');
    }
    contractDraft.enable();
  }

  function normalizeContractField(field: string, value: unknown) {
    if (field === 'contractAmount' || field === 'warrantyPeriod') {
      return value == null || value === '' ? '' : Number(value);
    }
    return value == null ? '' : String(value);
  }

  /** 姓名按所选负责人解析，不依赖隐藏字段的 change 回调是否触发。 */
  function buildSalesFields(values: Recordable) {
    const salesUserId = values.salesUserId;
    const selected = userOptions.value.find((item) => String(item.value) === String(salesUserId));
    const sameUser = String(salesUserId) === String(originalContract.value.salesUserId);
    const name = selected?.label || values.salesUserName || (sameUser ? originalContract.value.salesUserName : '');
    const salesUserName = String(name || '').trim();
    if (!salesUserId || !salesUserName || ['-', '—'].includes(salesUserName)) {
      throw new Error('销售负责人姓名缺失，请重新选择销售负责人');
    }
    return { salesUserId, salesUserName };
  }

  /** 销售负责人 ID/姓名始终成对传递，其余合同字段差量提交。 */
  function buildChangedContract(values: Recordable) {
    const changed: Recordable = { periodId: periodId.value };
    editableContractFields.forEach((field) => {
      if (normalizeContractField(field, values[field]) !== normalizeContractField(field, originalContract.value[field])) {
        changed[field] = values[field];
      }
    });
    return { ...changed, ...buildSalesFields(values) };
  }

  /** 新增和编辑均以 JSON 提交已上传路径，由业务接口关联附件。 */
  async function handleSubmit() {
    if (submitting.value) return;
    submitting.value = true;
    try {
      const values = await validate();
      delete values.quotation;
      if (quotationOpen.value || quotationSaving.value) throw new Error('请先完成报价调整');
      if (attachmentUploading.value) throw new Error('合同附件正在上传，请等待上传完成');
      if (contractAttachments.value.length < 1 || contractAttachments.value.length > CONTRACT_ATTACHMENT_LIMIT) {
        throw new Error(`合同附件至少上传 1 个、最多 ${CONTRACT_ATTACHMENT_LIMIT} 个`);
      }
      const requestedCandidateId = materialCandidateId.value;
      if (requestedCandidateId) {
        if (candidatesLoading.value) throw new Error('请等待报价加载完成');
        await loadContractCandidates();
        if (
          candidatesFailed.value ||
          requestedCandidateId !== materialCandidateId.value ||
          !selectedCandidate.value ||
          String(selectedCandidate.value.status) !== QUOTATION_STATUS_APPROVED
        ) {
          throw new Error('报价状态已变化，请重新确认关联报价');
        }
      }
      if (!validatePaybackPlan()) return;

      recalculateAllPaybackAmounts(values.contractAmount);
      const wasNewContract = !contractId.value;
      submitting.value = true;
      if (wasNewContract) {
        const payload = {
          ...values,
          ...buildSalesFields(values),
          periodId: periodId.value,
          projectId: projectId.value,
        };
        const result: any = await addContractWithPaymentRecords({
          ...(requestedCandidateId ? { materialCandidateId: requestedCandidateId } : {}),
          contract: {
            ...payload,
            contractFileId: contractAttachments.value.map((file) => file.fileId).join(','),
            // 通用数值审批约定：-1 待提交、0 驳回、1 审核通过、2 待审批、3 已撤回。
            status: '2',
            approvalReason: '',
          },
          contractFile: { fileName: contractAttachments.value.map((file) => file.fileName).join(',') },
          records: buildPaybackRecords(false, values.contractAmount),
        });
        const savedContract = result?.contract;
        if (!savedContract?.id) throw new Error('合同与回款计划已提交，但接口未返回合同 ID，请刷新列表确认');
        contractId.value = String(savedContract.id);
        info.value = { ...info.value, ...savedContract };
      } else {
        const result: any = await editContractWithPaymentRecords({
          ...(requestedCandidateId ? { materialCandidateId: requestedCandidateId } : {}),
          contract: { ...buildChangedContract(values), contractFileId: contractAttachments.value.map((file) => file.fileId).join(',') },
          records: buildPaybackRecords(true, values.contractAmount),
        });
        info.value = { ...info.value, ...(result?.contract || buildChangedContract(values)), status: '2', approvalReason: '' };
      }

      info.value.status = '2';
      createMessage.success(wasNewContract ? '合同已提交，等待审批' : '合同与回款计划已修改并重新提交审批');
      contractDraft.clear();
      readonly.value = true;
      editing.value = false;
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

      :deep(.ant-upload) {
        display: inline-block;
      }
    }

    &__attachment-hint {
      margin-top: 6px;
      color: #8c8c8c;
      font-size: 12px;
      line-height: 20px;
    }

    &__attachment-list {
      width: 100%;
      margin-top: 8px;
    }

    &__attachment-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 36px;
      padding: 4px 8px;
      border-radius: 4px;

      &:hover {
        background: #fafafa;
      }
    }

    &__attachment-name {
      min-width: 0;
      overflow: hidden;
      color: #262626;
      text-overflow: ellipsis;
      white-space: nowrap;
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

    &__cell-field {
      width: 100%;
    }

    &__cell-error {
      margin-top: 4px;
      color: @error-color;
      font-size: 12px;
      line-height: 1.4;
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
