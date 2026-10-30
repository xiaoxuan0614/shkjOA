<template>
  <ContractApproval v-if="CONTRACT_WORKFLOW_ENABLED && approvalInstanceId" :key="approvalInstanceId" :instance-id="approvalInstanceId" :contract-id="approvalContractId" :period-id="periodId" @resubmit="editWorkflowContract" />
  <a-result v-else-if="approvalResolveError" status="error" title="无法读取合同审批" :sub-title="approvalResolveError"><template #extra><a-button @click="initializeContract">重试</a-button></template></a-result>
  <a-spin v-else-if="approvalResolving" tip="正在定位合同审批" />
  <div v-else class="contract-page">
    <a-alert v-if="isWorkflowContract" type="info" show-icon :message="workflowContractHint" />
    <a-alert v-if="workflowIdentityError" type="warning" :message="workflowIdentityError">
      <template #action><a-button @click="loadExistingContract">重新读取</a-button></template>
    </a-alert>
    <!-- 项目基本信息 -->
    <a-card class="contract-page__card contract-page__project" title="项目基本信息">
      <PlanProjectInfo :record="projectRecord" combine-project-name :show-plan-fields="false" />
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
          <a-descriptions-item label="合同类型"><DictValue :value="info.contractType" :options="contractTypeOptions" :fallback="contractTypeText" /></a-descriptions-item>
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
          <a-descriptions-item label="合同清单" :span="2">
            <a-button @click="openQuotationPreview">查看报价单预览</a-button>
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
              <template v-else-if="column.key === 'node'"><DictValue :value="record.node" :options="paybackNodeOptions" :fallback="record.paymentNode_dictText || record.node_dictText || getOptionLabel(paybackNodeOptions, record.node)" /></template>
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
            <a-alert v-if="candidatesFailed" type="warning" message="关联报价读取失败，请重试后确认关联关系。"><template #action><a-button @click="loadContractCandidates(true)">重试</a-button></template></a-alert>
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
                placeholder="请选择已定价的原报价单（必填）"
                style="min-width: 240px"
              />
              <a-button :disabled="!materialCandidateId || candidatesLoading || candidatesFailed || submitting || quotationSaving" :loading="quotationPreviewLoading" @click="openQuotationPreview">查看报价预览</a-button>
              <a-tooltip v-if="selectedQuotationAccess.canRevise" :title="quotationAdjustDisabledReason">
                <span><a-button :disabled="!!quotationAdjustDisabledReason" @click="openQuotation(true)">{{ quotationDraft ? '继续调整' : '基于此单调整' }}</a-button></span>
              </a-tooltip>
            </a-space>
            <div v-if="quotationDraft" style="margin-top: 12px">
              <a-space wrap>
                <span>本次合同使用：</span>
                <a-radio-group v-model:value="quotationVersionChoice" :disabled="submitting || quotationSaving" @change="closeQuotationPreview">
                  <a-radio value="original">原报价</a-radio>
                  <a-radio value="draft">调整稿（仅本次合同使用）</a-radio>
                </a-radio-group>
                <a-popconfirm title="放弃调整稿并使用原报价？" @confirm="discardQuotationDraft"><a-button :disabled="submitting || quotationSaving" danger type="link">放弃调整</a-button></a-popconfirm>
              </a-space>
              <a-alert type="warning" show-icon message="调整稿未修改原报价，仅当前页面有效；刷新或离开后丢弃，最长保留30分钟。" />
            </div>
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
                <a-tooltip :title="DOCUMENT_UPLOAD_HINT"><a-button
                  :loading="attachmentUploading"
                  :disabled="submitting || attachmentUploading || contractAttachments.length >= CONTRACT_ATTACHMENT_LIMIT"
                  @click="openContractAttachmentPicker"
                >
                  <Icon icon="ant-design:cloud-upload-outlined" />
                  上传合同附件（{{ contractAttachments.length }}/{{ CONTRACT_ATTACHMENT_LIMIT }}）
                </a-button></a-tooltip>
              <div class="contract-page__attachment-hint">无合同类型可不上传，其他类型至少上传 1 个；最多 3 个，上传成功后可立即预览。</div>
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

        <PaymentPlanEditor
          :rows="paybackRows" :node-options="paybackNodeOptions" :row-key="record => record._key"
          :can-add="canAddPayback" :error="getPaybackError"
          @add="addPaybackRow" @remove="record => removePaybackRow(record._key)"
          @change="handlePaymentPlanChange"
        />
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
          :loading="managerOptionsLoading"
          :options="managerOptions"
          @dropdown-visible-change="(open) => { if (open) loadManagers(); }"
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
          :disabled="!approvalResult || (approvalResult === 'approve' && managerOptionsLoading)"
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
        <a-button v-if="isWorkflowContract" @click="openWorkflowRecord">查看审批记录</a-button>
        <a-button v-if="isWorkflowContract" @click="workflowRoundsOpen = true">历史审批轮次</a-button>
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
  <InstanceDrawer v-if="CONTRACT_WORKFLOW_ENABLED" :open="workflowOpen" :instance-id="workflowRecordId" @close="workflowOpen = false" @processed="loadExistingContract" />
  <a-drawer :open="quotationPreviewOpen" :title="readonly && !editing ? '合同清单预览（合同快照）' : quotationVersionChoice === 'draft' ? '合同清单预览（调整稿）' : '合同清单预览（原报价）'" width="min(1400px, 96vw)" @close="closeQuotationPreview">
    <a-spin :spinning="quotationPreviewLoading">
      <a-alert v-if="quotationPreviewError" type="error" show-icon :message="quotationPreviewError"><template #action><a-button @click="openQuotationPreview">重试</a-button></template></a-alert>
      <QuotationSnapshotPreview v-else-if="readonly && !editing" :quotation="quotationPreviewData" material-only />
      <QuotationSnapshotPreview v-else-if="quotationPreviewData" :quotation="quotationPreviewData" live hide-amounts />
    </a-spin>
  </a-drawer>
  <InstanceRounds v-if="CONTRACT_WORKFLOW_ENABLED" :open="workflowRoundsOpen" :instance-id="workflowInstanceId" @close="workflowRoundsOpen = false" @select="openWorkflowRound" />
  <a-modal
    v-model:open="quotationOpen"
    :title="quotationEditing ? '合同清单修改调整' : '合同清单详情'"
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
      @loaded="restoreQuotationAdjustment"
      include-service-fees
      :service-fee-rows="quotationServiceFees"
      @service-fees="receiveQuotationServiceFees"
      mode="quotation"
      paginated
      :editable="quotationEditing && !quotationSaving"
      :structure-editable="quotationEditing"
      snapshot-only
      :quote-pricing="false"
      :cost-visible="false"
      :price-visible="false"
      :base-price-editable="false"
      :pricing-editable="false"
      :busy="quotationSaving"
      combined-material-identity
    >
      <template #toolbar-after-select>
        <a-button type="primary" preIcon="ant-design:plus-outlined" :disabled="!quotationEditing || quotationSaving || !quotationFeesReady" @click="quotationFeePicker?.openPicker()">选择服务费</a-button>
      </template>
      <template #service-fee-cell="{ column, record: fee }">
        <QuotationServiceFeeCell
          :record="fee" :column-key="column.key" :editable="quotationEditing" :structure-editable="quotationEditing"
          :cost-editable="false" :price-visible="false" :price-editable="false" :busy="quotationSaving"
          @change="updateQuotationServiceFee" @remove="removeQuotationServiceFee" />
      </template>
    </MaterialPlanTable>
    <ServiceFeeTable
      v-if="quotationOpen" ref="quotationFeePicker" picker-only :model-value="quotationServiceFees" :ready="quotationFeesReady"
      :editable="quotationEditing" :structure-editable="quotationEditing" :busy="quotationSaving" :cost-editable="false" :cost-visible="false"
      :price-visible="false" :price-editable="false" @update:model-value="selectQuotationServiceFees" />
  </a-modal>
</template>

<script lang="ts" setup>
  import { ref, computed, nextTick, onMounted, onActivated, onDeactivated, onBeforeUnmount, watch } from 'vue';
  import ContractApproval from './ContractApproval.vue';
  import QuotationSnapshotPreview from './QuotationSnapshotPreview.vue';
  import ServiceFeeTable from '/@/views/plan/components/ServiceFeeTable.vue';
  import QuotationServiceFeeCell from '/@/views/plan/components/QuotationServiceFeeCell.vue';
  import { contractServiceFeePayload, contractServiceFeeRows } from './quotationServiceFees';
  import { CONTRACT_WORKFLOW_ENABLED, currentContractApproval, contractApprovalActions, type ContractApprovalActions } from './approval.api';
  import { readContractProjectContext } from './projectContext';
  import Big from 'big.js';
  import PaymentPlanEditor from '/@/components/PaymentPlan/PaymentPlanEditor.vue';
  import { useRoute, useRouter } from 'vue-router';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useUniqueRowOptions, validateEditableRows } from '/@/components/EditableTable';
  import { Icon } from '/@/components/Icon';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { useUserStore } from '/@/store/modules/user';
  import { useSessionDraft } from '/@/hooks/web/useSessionDraft';
  import { DOCUMENT_UPLOAD_ACCEPT, DOCUMENT_UPLOAD_HINT, isAllowedDocumentFile, uploadProjectDocument } from '/@/utils/documentUpload';
  import { previewFileInModal } from '/@/utils/filePreview';
  import InstanceDrawer from '/@/views/workflow/components/InstanceDrawer.vue';
  import InstanceRounds from '/@/views/workflow/components/InstanceRounds.vue';
  import {
    addContractWithPaymentRecords,
    contractDetailByPeriodId,
    editContractWithPaymentRecords,
    changeContractStatus,
  } from '/@/views/payment/Payment.api';
  import { projectDetail } from '../Project.api';
  import { loadDictOptions } from '../Project.data';
  import DictValue from '/@/components/DictValue.vue';
  import PlanProjectInfo from '../plan/PlanProjectInfo.vue';
  import { expandContractAttachments } from './contractAttachments';
  import MaterialPlanTable from '/@/views/plan/components/MaterialPlanTable.vue';
  import {
    getAllMaterialCandidates,
    getAllMaterialCandidateItems,
    reviseMaterialCandidate,
    getQuotationAccess,
    updateMaterialCandidateAdoption,
    QUOTATION_STATUS_APPROVED,
    isQuotationAdopted,
  } from '/@/views/plan/Plan.api';
  import { assertQuotationVersion, noQuotationAccess, quotationCapabilities } from '/@/views/plan/quotationGovernance';
  import { loadUserOptions, type UserOption } from '/@/views/resource/userOptions';
  import { loadProjectManagerOptions } from '/@/views/resource/projectManagerOptions';
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
  const { createMessage, createConfirm } = useMessage();
  const { hasPermission } = usePermission();
  const userStore = useUserStore();

  type ContractPageMode = 'create' | 'view' | 'edit';

  const routeMode = String(route.query?.mode || 'create');
  const pageMode = ref<ContractPageMode>(routeMode === 'view' || routeMode === 'edit' ? routeMode : 'create');
  const periodId = ref((route.query?.periodId as string) || '');
  const projectId = ref((route.query?.projectId as string) || '');
  const approvalInstanceId = ref(CONTRACT_WORKFLOW_ENABLED ? String(route.query.instanceId || '') : '');
  const approvalContractId = ref(String(route.query.contractId || ''));
  const approvalResolving = ref(pageMode.value === 'view' && !!approvalContractId.value && !approvalInstanceId.value);
  const approvalResolveError = ref('');
  async function resolveApproval() {
    if (!CONTRACT_WORKFLOW_ENABLED) return;
    if (approvalInstanceId.value || pageMode.value !== 'view' || !approvalContractId.value) return;
    approvalResolving.value = true; approvalResolveError.value = '';
    try {
      const id = await currentContractApproval(approvalContractId.value);
      if (id !== null && (typeof id !== 'string' || !id)) throw new Error('审批定位响应无效');
      approvalInstanceId.value = id || '';
    } catch (error: any) { approvalResolveError.value = error?.message || '合同审批读取失败'; }
    finally { approvalResolving.value = false; }
  }

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
  const quotationSnapshot = ref<Recordable>({});
  const quotationFeePicker = ref<InstanceType<typeof ServiceFeeTable>>();
  const quotationServiceFees = ref<Recordable[]>([]);
  const quotationFeesReady = ref(false);
  function receiveQuotationServiceFees(rows: Recordable[]) {
    quotationServiceFees.value = contractServiceFeeRows(JSON.parse(JSON.stringify(quotationDraft.value?.serviceFees || rows)));
    quotationFeesReady.value = true;
  }
  function selectQuotationServiceFees(rows: Recordable[]) {
    if (!quotationEditing.value || quotationSaving.value || !quotationFeesReady.value) return;
    quotationServiceFees.value = contractServiceFeeRows(rows);
  }
  function updateQuotationServiceFee(row: Recordable, patch: Recordable) {
    if (!quotationEditing.value || quotationSaving.value || !quotationFeesReady.value) return;
    // 组件事件也只允许内容字段，价格权限保持原边界。
    for (const key of ['unit', 'quantity', 'remark']) if (key in patch) row[key] = patch[key];
    row.guideAmount = null;
  }
  function removeQuotationServiceFee(row: Recordable) {
    if (!quotationEditing.value || quotationSaving.value || !quotationFeesReady.value) return;
    quotationServiceFees.value = quotationServiceFees.value.filter(item => item !== row);
  }
  const quotationDraft = ref<{ token: string; candidateId: string; version: number; expiresAt: number; rows: Recordable[]; items: Recordable[]; serviceFees: Recordable[] }>();
  const quotationVersionChoice = ref<'original' | 'draft'>('original');
  let restoreAdjustmentPending = false;
  let quotationLifecycle = 0;
  function discardQuotationDraft() {
    quotationDraft.value = undefined;
    quotationVersionChoice.value = 'original';
    closeQuotationPreview();
  }
  onDeactivated(() => { quotationLifecycle++; quotationOpen.value = false; discardQuotationDraft(); resetQuotationAccess(); });
  onBeforeUnmount(() => { quotationLifecycle++; discardQuotationDraft(); resetQuotationAccess(); });
  function requireQuotationDraft() {
    const draft = quotationDraft.value;
    if (!draft || draft.candidateId !== materialCandidateId.value || Date.now() >= draft.expiresAt) throw new Error('调整稿已失效，请放弃后重新调整，或明确选择原报价');
    if (Number(selectedCandidate.value?.version) !== draft.version) throw new Error('原报价版本已变化，请放弃调整稿后重新调整');
    return draft;
  }
  async function restoreQuotationAdjustment() {
    if (!restoreAdjustmentPending) return;
    restoreAdjustmentPending = false;
    if (quotationDraft.value) {
      try { await quotationTable.value?.restoreQuotationDraft(requireQuotationDraft().rows); }
      catch (error: any) { quotationOpen.value = false; createMessage.warning(error.message); }
    }
  }
  const quotationPreviewOpen = ref(false);
  const quotationPreviewLoading = ref(false);
  const quotationPreviewError = ref('');
  const quotationPreviewData = ref<Recordable | null>(null);
  let quotationPreviewSequence = 0;
  function closeQuotationPreview() {
    quotationPreviewSequence++;
    quotationPreviewOpen.value = false;
    quotationPreviewLoading.value = false;
    quotationPreviewData.value = null;
  }
  watch([materialCandidateId, quotationVersionChoice, editing], closeQuotationPreview);
  async function openQuotationPreview() {
    if (readonly.value && !editing.value) {
      closeQuotationPreview();
      quotationPreviewError.value = '';
      quotationPreviewData.value = info.value.materialSnapshot ?? null;
      quotationPreviewOpen.value = true;
      return;
    }
    if (!materialCandidateId.value || quotationPreviewLoading.value || submitting.value || quotationSaving.value) return;
    const id = materialCandidateId.value;
    const sequence = ++quotationPreviewSequence;
    quotationPreviewOpen.value = true;
    quotationPreviewLoading.value = true;
    quotationPreviewError.value = '';
    quotationPreviewData.value = null;
    try {
      await loadContractCandidates();
      if (candidatesFailed.value || String(selectedCandidate.value?.id || '') !== id) throw new Error('报价信息已变化，请重新选择');
      const header = { ...selectedCandidate.value };
      const access = selectedQuotationAccess.value;
      if (quotationVersionChoice.value === 'draft') {
        const draft = requireQuotationDraft();
        if (sequence !== quotationPreviewSequence || materialCandidateId.value !== id) return;
        quotationPreviewData.value = { candidateName: `${header.candidateName}（调整稿）`,
          items: draft.items.map(row => ({ ...row, finalPrice: access.canViewQuote ? row.finalPrice : null })),
          serviceFees: draft.serviceFees.map(row => access.canViewQuote ? row : { ...row, guidePrice: null, guideAmount: null }) };
        return;
      }
      let fees: Recordable[] = [];
      const items = await getAllMaterialCandidateItems(id, rows => { fees = rows; });
      if (sequence !== quotationPreviewSequence || materialCandidateId.value !== id) return;
      quotationPreviewData.value = { candidateName: header.candidateName,
        items: items.map(row => ({ ...row, finalPrice: access.canViewQuote ? row.finalPrice : null })),
        serviceFees: fees.map(row => access.canViewQuote ? row : { ...row, guidePrice: null, guideAmount: null }) };
    } catch (error: any) {
      if (sequence === quotationPreviewSequence) quotationPreviewError.value = error?.message || '报价预览加载失败，请重试';
    } finally {
      if (sequence === quotationPreviewSequence) quotationPreviewLoading.value = false;
    }
  }
  const canReleaseQuotation = computed(
    () =>
      canEditContract.value &&
      quotationCapabilities(selectedCandidate.value, selectedQuotationAccess.value, userStore.getUserInfo, hasPermission).edit &&
      (isApprovalRejected(info.value.status) || isApprovalWithdrawn(info.value.status)) &&
      isQuotationAdopted(selectedCandidate.value)
  );
  const selectedCandidate = computed(() => contractCandidates.value.find((item) => String(item.id) === materialCandidateId.value));
  const contractCandidateOptions = computed(() =>
    contractCandidates.value
      .filter((item) => (String(item.status) === QUOTATION_STATUS_APPROVED && Number(item.priced) === 1) || String(item.id) === materialCandidateId.value)
      .map((item) => ({ value: String(item.id), label: item.candidateName || '未命名报价单', disabled: String(item.status) !== QUOTATION_STATUS_APPROVED || Number(item.priced) !== 1 }))
  );
  const selectedQuotationAccess = ref({ ...noQuotationAccess });
  let quotationAccessSequence = 0;
  let quotationAccessKey = '';
  let quotationAccessPending: Promise<void> | undefined;
  function resetQuotationAccess() {
    quotationAccessSequence++;
    quotationAccessKey = '';
    quotationAccessPending = undefined;
    selectedQuotationAccess.value = { ...noQuotationAccess };
  }
  async function refreshSelectedQuotationAccess(candidate = selectedCandidate.value) {
    const targetPeriodId = periodId.value;
    const candidateId = candidate?.id ? String(candidate.id) : '';
    const key = candidateId && targetPeriodId ? JSON.stringify([targetPeriodId, candidateId]) : '';
    if (!key) { resetQuotationAccess(); return; }
    if (key === quotationAccessKey) return quotationAccessPending;
    const sequence = ++quotationAccessSequence;
    quotationAccessKey = key;
    selectedQuotationAccess.value = { ...noQuotationAccess };
    quotationAccessPending = (async () => {
      try {
        const access = await getQuotationAccess(targetPeriodId, candidateId);
        if (sequence === quotationAccessSequence) selectedQuotationAccess.value = access;
      } catch (error: any) {
        if (sequence === quotationAccessSequence) {
          quotationAccessKey = '';
          createMessage.error(error?.message || '报价修改权限读取失败，请刷新');
        }
      } finally {
        if (sequence === quotationAccessSequence) quotationAccessPending = undefined;
      }
    })();
    return quotationAccessPending;
  }
  watch([periodId, materialCandidateId], () => {
    resetQuotationAccess();
    if (!candidatesLoading.value) void refreshSelectedQuotationAccess();
  }, { flush: 'sync' });
  const canAdjustQuotation = computed(() => !!selectedCandidate.value && selectedQuotationAccess.value.canRevise);

  const quotationAdjustDisabledReason = computed(() => {
    if (submitting.value || quotationSaving.value || candidatesLoading.value) return '正在处理，请稍候';
    if (candidatesFailed.value) return '报价信息加载失败，请刷新后重试';
    if (!selectedCandidate.value) return '请先选择报价单';
    if (!selectedQuotationAccess.value.canRevise) return '当前未获报价修改权限，请联系授权管理员';
    return '';
  });

  function filterQuotationByName(input: string, option: { label?: unknown }) {
    return String(option?.label || '')
      .toLocaleLowerCase()
      .includes(input.trim().toLocaleLowerCase());
  }

  async function handleQuotationSelection(value?: string) {
    if (submitting.value || quotationSaving.value || candidatesLoading.value) return;
    if (value === materialCandidateId.value) return;
    if (quotationDraft.value) {
      createConfirm({ title: '更换原报价单', content: '更换后将清除当前调整稿，是否继续？', onOk: async () => {
        discardQuotationDraft();
        await handleQuotationSelection(value);
      } });
      return;
    }
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
      const candidates = await getAllMaterialCandidates(periodId.value);
      contractCandidates.value = candidates;
      const adopted = contractCandidates.value.filter((item) => isQuotationAdopted(item));
      if (adopted.length > 1) throw new Error('当前分期存在多张已采用报价，请联系管理员核对');
      if (restoreSelection && !materialCandidateId.value && adopted.length) materialCandidateId.value = String(adopted[0].id);
      await refreshSelectedQuotationAccess();
    } catch (error: any) {
      candidatesFailed.value = true;
      createMessage.error(error?.message || '关联报价加载失败');
    } finally {
      candidatesLoading.value = false;
    }
  }

  async function openQuotation(edit: boolean) {
    if (submitting.value || quotationSaving.value || candidatesLoading.value) return;
    await loadContractCandidates();
    if (candidatesFailed.value || !selectedCandidate.value) return;
    if (edit && !canAdjustQuotation.value) return createMessage.warning('当前报价不可修改');
    if (quotationDraft.value) {
      try { requireQuotationDraft(); } catch (error: any) { createMessage.warning(error.message); return; }
    }
    restoreAdjustmentPending = !!quotationDraft.value;
    quotationServiceFees.value = [];
    quotationFeesReady.value = false;
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
    const lifecycle = quotationLifecycle;
    try {
      const records = quotationTable.value?.getData();
      if (!records) throw new Error('报价尚未加载完成');
      const rows = JSON.parse(JSON.stringify(quotationTable.value.getRows()));
      await loadContractCandidates();
      if (candidatesFailed.value || !canAdjustQuotation.value) throw new Error('报价状态已变化，请重新打开');
      assertQuotationVersion(quotationSnapshot.value, selectedCandidate.value);
      const previous = quotationDraft.value ? requireQuotationDraft() : undefined;
      if (!quotationFeesReady.value) throw new Error('服务费尚未加载完成，请重新打开');
      const serviceFees = JSON.parse(JSON.stringify(quotationServiceFees.value));
      const serviceFeeRecords = contractServiceFeePayload(serviceFees);
      if (lifecycle !== quotationLifecycle) return;
      const result = await reviseMaterialCandidate({ candidateId: materialCandidateId.value, candidateName: quotationSnapshot.value.candidateName, version: quotationSnapshot.value.version, records, serviceFees: serviceFeeRecords, ...(previous ? { draftToken: previous.token } : {}) });
      if (lifecycle !== quotationLifecycle) return;
      if (!result?.draftToken) {
        if (previous) throw new Error('暂存响应缺少令牌，请重试');
        quotationOpen.value = false;
        createMessage.info('内容未发生变化，继续使用原报价');
        return;
      }
      const ttl = Number(result.draftExpiresIn);
      if (!Number.isFinite(ttl) || ttl <= 0) throw new Error('调整稿有效期无效，请重试');
      quotationDraft.value = { token: result.draftToken, candidateId: materialCandidateId.value!, version: Number(quotationSnapshot.value.version), expiresAt: Date.now() + ttl * 1000,
        rows, items: rows.map(row => ({ ...row, quantity: row.plannedQty, unit: row._unitOptions?.find(option => String(option.value) === String(row._unitValue))?.label || row.unit, finalPrice: row.id ? row.finalPrice : null })), serviceFees };
      quotationVersionChoice.value = 'draft';
      closeQuotationPreview();
      quotationOpen.value = false;
      createMessage.success('调整稿已暂存，本次合同默认使用调整稿；原报价未改变');
    } catch (error: any) {
      createMessage.error(error?.message || '报价调整保存失败');
    } finally {
      quotationSaving.value = false;
    }
  }
  const userOptions = ref<UserOption[]>([]);
  const userOptionsLoading = ref(false);
  const managerOptions = ref<UserOption[]>([]);
  const managerOptionsLoading = ref(false);
  let managerOptionsKey = '';
  let managerOptionsSequence = 0;
  const managerRequestKey = () => JSON.stringify([userStore.getToken, periodId.value]);
  function resetManagers() {
    managerOptionsSequence++;
    managerOptionsKey = '';
    managerOptions.value = [];
    managerOptionsLoading.value = false;
  }
  onDeactivated(resetManagers);
  onBeforeUnmount(resetManagers);
  watch(() => [userStore.getToken, periodId.value], resetManagers);
  async function loadManagers() {
    const key = managerRequestKey();
    if (managerOptionsKey === key) return;
    if (managerOptionsLoading.value) return;
    const sequence = ++managerOptionsSequence;
    managerOptionsLoading.value = true;
    managerOptions.value = [];
    try {
      const options = await loadProjectManagerOptions();
      if (sequence === managerOptionsSequence && key === managerRequestKey()) {
        managerOptions.value = options;
        managerOptionsKey = key;
      }
    } catch (error: any) {
      if (sequence === managerOptionsSequence && key === managerRequestKey()) createMessage.error(error?.message || '项目经理列表加载失败');
    } finally { if (sequence === managerOptionsSequence) managerOptionsLoading.value = false; }
  }
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

  function handlePaymentPlanChange(record: Recordable, field: string) {
    if (field === 'node') handlePaybackNodeChange(record);
    else if (field === 'ratio') handlePaybackRatioChange(record);
    else clearPaybackError(record, field);
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
  const workflowOpen = ref(false), workflowRoundsOpen = ref(false), workflowRecordId = ref('');
  const businessActions = ref<ContractApprovalActions | null>();
  const workflowIdentityError = ref('');
  const workflowInstanceId = computed(() => String(info.value.workflowInstanceId || '').trim());
  const isWorkflowContract = computed(() => CONTRACT_WORKFLOW_ENABLED && (!!workflowInstanceId.value || !!businessActions.value));
  const workflowContractHint = computed(() => info.value.workflowStatus === 'RUNNING'
    ? '合同审批中，不能修改合同或回款计划；可在合同信息的申请操作中按权限撤回。'
    : info.value.workflowStatus === 'APPROVED' ? '合同审批已通过，本试点不支持覆盖修改。'
    : '此合同已接入审批中心，请查看审批记录；驳回或撤回后由原发起人修改重提。');
  function openWorkflowRound(id: string) { workflowRecordId.value = id; workflowOpen.value = true; }
  function openWorkflowRecord() { openWorkflowRound(workflowInstanceId.value); }
  const isContractRevisable = computed(
    () => isApprovalRejected(info.value.status) || isApprovalWithdrawn(info.value.status) || isApprovalPendingSubmit(info.value.status)
  );
  // 合同提交人可撤回待审批合同，并修改待提交、驳回或已撤回合同；审批人仅处理待审批合同。
  const canEditContract = computed(() => isWorkflowContract.value
    ? businessActions.value?.canResubmit === true
    : isCurrentContractSubmitter.value && isContractRevisable.value);
  const canWithdrawContract = computed(() => !isWorkflowContract.value && isCurrentContractSubmitter.value && isApprovalPending(info.value.status));
  const canAuditContract = computed(() => !isWorkflowContract.value && isApprovalPending(info.value.status) && hasPermission('project:contract:approve'));
  const showAuditPanel = computed(() => readonly.value && !editing.value && canAuditContract.value && !contractLoadFailed.value);
  const isContractFormRendered = computed(() => !readonly.value || editing.value);

  const [registerForm, { resetFields, setFieldsValue, validate, updateSchema, getFieldsValue }] = useForm({
    validateOnSubmitOnly: true,
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
        dynamicRules: ({ values }) => [{ required: !isNoContractType(values.contractType), validator: async () => {
          if (!isNoContractType(values.contractType) && !contractAttachments.value.length) throw new Error('请上传至少一个合同附件');
        } }],
        colProps: { span: 24 },
      },
      { label: '合同清单', field: 'quotation', component: 'Input', slot: 'quotation', colProps: { span: 24 },
        rules: [{ required: true, validator: async () => {
          if (!materialCandidateId.value) throw new Error('请选择已定价的报价单作为合同清单');
        } }],
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

  function isNoContractType(value: unknown) {
    return contractTypeOptions.value.some((option) => option.label.trim() === '无合同' && String(option.value) === String(value));
  }

  async function initializeContract() {
    resetQuotationAccess();
    approvalResolveError.value = '';
    if (approvalInstanceId.value) return;
    // 新合同恢复原状态审批：先查业务详情，只有后端标记的历史流程合同才定位实例。
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

    // 查看模式也需要字典：详情不保证返回 *_dictText，不能只回显原始编码。
    const auxiliaryDataPromise = Promise.all([loadDictOptions('contract_type'), loadDictOptions('payback_node')]);

    if (pageMode.value === 'create') {
      const [contractTypes, nodes] = await auxiliaryDataPromise;
      contractTypeOptions.value = contractTypes || [];
      paybackNodeOptions.value = nodes || [];
      await loadProjectRecord();
      await initializeCreateMode();
      await restoreContractDraft();
      await loadContractCandidates(true);
      return;
    }

    // 详情接口一次返回合同、两个文件记录与回款计划。
    await loadExistingContract();
    if (approvalInstanceId.value || approvalResolveError.value) return;
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
  }
  onMounted(initializeContract);

  // 查看页可能在“修改重提”跳转前已被改成编辑状态。缓存恢复时必须按
  // 原入口重新定位最新轮次，不能继续使用旧表单或旧 approvalInstanceId。
  let activatedOnce = false;
  onActivated(() => {
    if (!activatedOnce) { activatedOnce = true; return; }
    // 未提交的新建/编辑标签仍保留用户输入；提交成功后 pageMode 已转为 view。
    if (routeMode !== 'view' && pageMode.value !== 'view') {
      void refreshSelectedQuotationAccess();
      return;
    }
    pageMode.value = 'view';
    readonly.value = true;
    editing.value = false;
    // 显式带实例的历史审批入口仍查看指定轮次，普通合同入口查询最新轮次。
    approvalInstanceId.value = CONTRACT_WORKFLOW_ENABLED ? String(route.query.instanceId || '') : '';
    approvalContractId.value = approvalContractId.value || contractId.value;
    approvalResolveError.value = '';
    approvalResolving.value = !approvalInstanceId.value;
    void initializeContract().finally(() => { approvalResolving.value = false; });
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
    businessActions.value = undefined;
    workflowIdentityError.value = '';
    try {
      const detail: any = await contractDetailByPeriodId(periodId.value);
      const { contractFile, materialFile, records, ...contract } = detail || {};
      if (!contract?.id) throw new Error('合同详情不存在');
      if (contractId.value && String(contract.id) !== contractId.value) throw new Error('合同与当前分期不匹配');
      const hasWorkflowInstance = CONTRACT_WORKFLOW_ENABLED && !!String(contract.workflowInstanceId || '').trim();
      if (pageMode.value === 'view' && hasWorkflowInstance) {
        approvalContractId.value = String(contract.id);
        await resolveApproval();
        if (approvalInstanceId.value || approvalResolveError.value) return;
      }

      if (pageMode.value !== 'view' && hasWorkflowInstance) {
        const currentInstance = await currentContractApproval(String(contract.id));
        if (currentInstance) {
          businessActions.value = await contractApprovalActions(String(contract.id));
          if (!businessActions.value || businessActions.value.instanceId !== currentInstance) throw new Error('合同审批轮次已变化，请重新打开合同信息');
        } else businessActions.value = null;
      } else businessActions.value = null;
      contractLoadFailed.value = false;
      paybackLoadFailed.value = false;
      contractId.value = String(contract.id);
      periodId.value = periodId.value || contract.periodId || '';
      projectId.value = projectId.value || contract.projectId || '';
      info.value = { ...contract, contractFile, materialFile, records: records || [] };
      materialCandidateId.value = contract.materialCandidateId ? String(contract.materialCandidateId) : undefined;
      await loadContractCandidates(true);
      if (contract.salesUserId && contract.salesUserName && !usersLoaded) {
        userOptions.value = [{ value: String(contract.salesUserId), label: contract.salesUserName }];
        userMap[String(contract.salesUserId)] = { name: contract.salesUserName };
      }
      originalContract.value = { ...contract };
      approvalResult.value = undefined;
      approvalReason.value = '';
      projectManagerUserId.value = contract.projectManagerUserId || undefined;
      projectRecord.value = { ...contract,
        ...readContractProjectContext(window.history.state?.contractProjectContext, periodId.value, String(userStore.getUserInfo?.id || '')),
        periodId: periodId.value, projectId: projectId.value };
      await loadContractAttachments({ contract, contractFile, materialFile });
      setPaybackRows(records || []);

    } catch (error: any) {
      contractLoadFailed.value = true;
      approvalResolveError.value = error?.message || '合同信息加载失败，请稍后重试';
      readonly.value = true;
      editing.value = false;
      createMessage.error(error?.message || '合同信息加载失败，请稍后重试');
    } finally {
      approvalResolving.value = false;
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
      createMessage.warning(DOCUMENT_UPLOAD_HINT);
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

  async function editWorkflowContract(targetPeriodId: string, targetContractId: string) {
    if (!CONTRACT_WORKFLOW_ENABLED) return;
    try {
    const capabilities = await contractApprovalActions(targetContractId);
    if (!capabilities?.canResubmit || capabilities.instanceId !== approvalInstanceId.value) {
      createMessage.warning(capabilities?.resubmitReason || '当前合同不能修改重提');
      return;
    }
    periodId.value = targetPeriodId;
    contractId.value = targetContractId;
    pageMode.value = 'edit';
    approvalInstanceId.value = '';
    readonly.value = true;
    editing.value = true;
    await router.replace({ path: '/project/contract', query: { mode: 'edit', contractId: contractId.value, periodId: targetPeriodId } });
    await initializeContract();
    } catch (error: any) { createMessage.error(error?.message || '重提权限读取失败，请重试'); }
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
    if (managerOptionsLoading.value) return;
    actionSubmitting.value = true;
    await loadManagers();
    const selected = managerOptions.value.find((item) => String(item.value) === String(projectManagerUserId.value));
    if (!selected) {
      actionSubmitting.value = false;
      createMessage.warning('请选择项目经理角色下的用户');
      return;
    }
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
      await goBack();
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
      await goBack();
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

  function handlePaybackNodeChange(row: Recordable) {
    clearPaybackError(row, 'node');
    if (getOptionLabel(paybackNodeOptions.value, row.node).trim() === '一次款') {
      row.ratio = 100;
      handlePaybackRatioChange(row);
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
    if (contractId.value && !canEditContract.value) {
      createMessage.warning('当前合同不可修改，请刷新审批状态');
      return;
    }
    submitting.value = true;
    try {
      const values = await validate();
      delete values.quotation;
      if (quotationOpen.value || quotationSaving.value) throw new Error('请先完成报价调整');
      if (attachmentUploading.value) throw new Error('合同附件正在上传，请等待上传完成');
      if ((!isNoContractType(values.contractType) && contractAttachments.value.length < 1) || contractAttachments.value.length > CONTRACT_ATTACHMENT_LIMIT) {
        throw new Error(`无合同类型附件可选，其他类型至少上传 1 个，最多 ${CONTRACT_ATTACHMENT_LIMIT} 个`);
      }
      const requestedCandidateId = materialCandidateId.value;
      if (!requestedCandidateId) throw new Error('请选择已定价的报价单作为合同清单');
      if (requestedCandidateId) {
        if (candidatesLoading.value) throw new Error('请等待报价加载完成');
        await loadContractCandidates();
        if (
          candidatesFailed.value ||
          requestedCandidateId !== materialCandidateId.value ||
          !selectedCandidate.value ||
          String(selectedCandidate.value.status) !== QUOTATION_STATUS_APPROVED
          || Number(selectedCandidate.value.priced) !== 1
        ) {
          throw new Error('报价状态已变化，请重新确认关联报价');
        }
      }
      if (!validatePaybackPlan()) return;

      recalculateAllPaybackAmounts(values.contractAmount);
      const wasNewContract = !contractId.value;
      const selectedDraft = quotationVersionChoice.value === 'draft' ? requireQuotationDraft() : undefined;
      submitting.value = true;
      if (wasNewContract) {
        const payload = {
          ...values,
          ...buildSalesFields(values),
          periodId: periodId.value,
          projectId: projectId.value,
        };
        const result: any = await addContractWithPaymentRecords({
          ...(selectedDraft ? { materialCandidateDraftToken: selectedDraft.token } : {}),
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
        info.value = { ...info.value, ...savedContract, workflowInstanceId: result.workflowInstanceId, workflowStatus: result.workflowStatus };
      } else {
        const result: any = await editContractWithPaymentRecords({
          ...(selectedDraft ? { materialCandidateDraftToken: selectedDraft.token } : {}),
          ...(requestedCandidateId ? { materialCandidateId: requestedCandidateId } : {}),
          contract: { ...buildChangedContract(values), contractFileId: contractAttachments.value.map((file) => file.fileId).join(',') },
          records: buildPaybackRecords(true, values.contractAmount),
        });
        info.value = { ...info.value, ...result.contract, workflowInstanceId: result.workflowInstanceId, workflowStatus: result.workflowStatus };
      }

      createMessage.success(wasNewContract ? '合同已提交，等待审批' : '合同与回款计划已修改并重新提交审批');
      contractDraft.clear();
      discardQuotationDraft();
      pageMode.value = 'view';
      approvalContractId.value = contractId.value;
      approvalInstanceId.value = '';
      readonly.value = true;
      editing.value = false;
      await goBack();
    } catch (error: any) {
      if (Array.isArray(error?.errorFields)) {
        const messages = error.errorFields.flatMap((field: any) => field.errors || []).filter((message: unknown) => typeof message === 'string' && message.trim());
        createMessage.warning(messages[0] || '请填写完整必填信息后再提交');
        return;
      }
      createMessage.error(error?.message || '合同提交失败，请确认当前保存状态后重试');
    } finally {
      submitting.value = false;
    }
  }

  function goBack() {
    return router.push(route.query.from === 'periodDetail' && periodId.value
      ? { path: `/project/detail/${periodId.value}`, query: { tab: 'contract' } }
      : '/project/list');
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
