<template>
  <BasicDrawer v-bind="$attrs" @register="register" title="返工管理" :width="1240" :show-footer="false" destroyOnClose>
    <div class="rework-drawer__header">
      <div>
        <div class="rework-drawer__project">{{ projectTitle }}</div>
        <div class="rework-drawer__hint">每张返工单统一配置一个返工工序；返工用料只填写本轮需要额外领料的数量。</div>
      </div>
      <a-button v-if="!editing && sourceAcceptance.id && canApply" type="primary" preIcon="ant-design:plus-outlined" @click="startCreate">
        新建返工申请
      </a-button>
    </div>

    <template v-if="editing">
      <a-alert
        type="info"
        show-icon
        class="rework-drawer__notice"
        message="返工方案按整张单据审批"
        description="返工统一为一个工序；额外领料量不包含现场已有余料。审批通过后，后端生成本轮返工工序并进入返工阶段。"
      />

      <section class="rework-drawer__section">
        <div class="rework-drawer__section-title">申请信息</div>
        <a-descriptions :column="2" size="small" bordered class="rework-drawer__source">
          <a-descriptions-item label="来源验收">{{ sourceTypeText }}</a-descriptions-item>
          <a-descriptions-item label="来源记录">{{ form.sourceAcceptanceId || '—' }}</a-descriptions-item>
        </a-descriptions>
        <a-form layout="vertical">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="返工原因" required>
                <a-textarea v-model:value="form.reason" :rows="3" :maxlength="500" show-count placeholder="请说明本次返工原因" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="返工说明">
                <a-textarea v-model:value="form.description" :rows="3" :maxlength="1000" show-count placeholder="可补充返工范围和执行要求" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </section>

      <section class="rework-drawer__section">
        <div class="rework-drawer__section-heading">
          <div>
            <div class="rework-drawer__section-title">返工工序</div>
            <div class="rework-drawer__section-subtitle">每张返工单固定一个工序；工序名称、现场负责人、计划日期和预计工时均必填。</div>
          </div>
        </div>
        <a-table
          :columns="processColumns"
          :data-source="processRows"
          :row-key="(record) => record._key"
          :pagination="false"
          :scroll="{ x: 980 }"
          size="small"
          bordered
        >
          <template #emptyText><a-empty description="请添加返工工序" /></template>
          <template #headerCell="{ column }">
            <span>{{ column.title }}<span v-if="column.required" class="rework-drawer__required" aria-hidden="true">*</span></span>
          </template>
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'index'">{{ index + 1 }}</template>
            <template v-else-if="column.key === 'processName'">
              <a-select v-model:value="record.processName" :options="workTypeOptions" placeholder="请选择工序" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'siteLeaderId'">
              <a-select
                v-model:value="record.siteLeaderId"
                :options="leaderOptions"
                show-search
                option-filter-prop="label"
                placeholder="请选择现场负责人"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'plannedStartTime'">
              <a-date-picker
                v-model:value="record.plannedStartTime"
                value-format="YYYY-MM-DD"
                placeholder="计划开始"
                style="width: 100%"
                @change="recalculateHours(record)"
              />
            </template>
            <template v-else-if="column.key === 'plannedEndTime'">
              <a-date-picker
                v-model:value="record.plannedEndTime"
                value-format="YYYY-MM-DD"
                placeholder="计划完成"
                style="width: 100%"
                @change="recalculateHours(record)"
              />
            </template>
            <template v-else-if="column.key === 'plannedHours'">
              <a-input-number v-model:value="record.plannedHours" :min="0" :precision="1" placeholder="小时" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'remark'">
              <a-input v-model:value="record.remark" :maxlength="200" placeholder="选填" />
            </template>
          </template>
        </a-table>
      </section>

      <section class="rework-drawer__section">
        <div class="rework-drawer__section-title">返工用料记录</div>
        <div class="rework-drawer__section-subtitle">这里只记录本轮需要新增出库的物料；现场余料不重复填报，未新增领料时可留空。</div>
        <MaterialPlanTable ref="materialRef" :period-id="periodId" mode="rework" />
      </section>

      <div class="rework-drawer__form-actions">
        <a-button :disabled="saving" @click="cancelEdit">取消</a-button>
        <a-button :loading="saving" @click="saveDraft(false)">保存草稿</a-button>
        <a-button type="primary" :loading="saving" @click="saveDraft(true)">保存并提交审批</a-button>
      </div>
    </template>

    <template v-else>
      <a-table
        :columns="reworkColumns"
        :data-source="reworks"
        :row-key="(record) => record.id"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 1240 }"
        size="middle"
        bordered
      >
        <template #emptyText><a-empty description="暂无返工记录" /></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'approvalStatus'">
            <a-tag :color="getApprovalStatusMeta(record.approvalStatus).color">{{ getApprovalStatusMeta(record.approvalStatus).text }}</a-tag>
          </template>
          <template v-else-if="column.key === 'executionStatus'">
            <a-tag :color="executionMeta(record.executionStatus).color">{{ executionMeta(record.executionStatus).text }}</a-tag>
          </template>
          <template v-else-if="column.key === 'processSummary'">{{ parsePlan(record).process?.processName || '—' }}</template>
          <template v-else-if="column.key === 'materialSummary'">{{ parsePlan(record).materials.length }} 种额外领料</template>
          <template v-else-if="column.key === 'reason'">
            <a-tooltip :title="record.reason"
              ><span class="rework-drawer__ellipsis">{{ record.reason || '—' }}</span></a-tooltip
            >
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="rework-drawer__row-actions">
              <a-button type="link" size="small" @click="viewRework(record)">详情</a-button>
              <a-button v-if="canEditRework(record)" type="link" size="small" @click="editRework(record)">修改</a-button>
              <a-popconfirm v-if="canSubmitRework(record)" title="确认提交这张返工申请？" @confirm="submitRework(record)">
                <a-button type="link" size="small">提交</a-button>
              </a-popconfirm>
              <a-popconfirm v-if="canWithdrawRework(record)" title="确认撤回这张返工申请？" @confirm="withdrawRework(record)">
                <a-button type="link" size="small">撤回</a-button>
              </a-popconfirm>
              <a-button v-if="canApproveRework(record)" type="link" size="small" @click="prepareApproval(record, true)">通过</a-button>
              <a-button v-if="canApproveRework(record)" type="link" danger size="small" @click="prepareApproval(record, false)">驳回</a-button>
              <a-button v-if="canApplyMaterial(record)" type="link" size="small" @click="goPick(record)">申请领料</a-button>
            </div>
          </template>
        </template>
      </a-table>

      <a-drawer v-model:open="detailVisible" title="返工详情" :width="760" destroyOnClose>
        <a-spin :spinning="detailLoading">
          <a-descriptions :column="2" size="small" bordered>
            <a-descriptions-item label="返工单号">{{ detailRecord.reworkNo || '—' }}</a-descriptions-item>
            <a-descriptions-item label="审批状态">{{ getApprovalStatusMeta(detailRecord.approvalStatus).text }}</a-descriptions-item>
            <a-descriptions-item label="申请人">{{ detailRecord.applyUserName || '—' }}</a-descriptions-item>
            <a-descriptions-item label="申请时间">{{ detailRecord.applyTime || detailRecord.createTime || '—' }}</a-descriptions-item>
            <a-descriptions-item label="返工原因" :span="2">{{ detailRecord.reason || '—' }}</a-descriptions-item>
            <a-descriptions-item label="返工说明" :span="2">{{ detailRecord.description || '—' }}</a-descriptions-item>
            <a-descriptions-item label="审批意见" :span="2">{{ detailRecord.approvalReason || '—' }}</a-descriptions-item>
          </a-descriptions>

          <div class="rework-drawer__detail-title">返工工序</div>
          <a-table
            :columns="detailProcessColumns"
            :data-source="parsePlan(detailRecord).process ? [parsePlan(detailRecord).process] : []"
            :row-key="(record, index) => record.id || index"
            :pagination="false"
            size="small"
          />

          <div class="rework-drawer__detail-title">额外领料执行情况</div>
          <a-table
            :columns="materialStatColumns"
            :data-source="materialStats"
            :row-key="(record) => record.materialId"
            :pagination="false"
            size="small"
          >
            <template #emptyText><a-empty description="本轮没有额外领料记录" /></template>
          </a-table>

          <div class="rework-drawer__detail-actions">
            <a-button v-if="canEditRework(detailRecord)" @click="editFromDetail">修改</a-button>
            <a-button v-if="canSubmitRework(detailRecord)" type="primary" @click="submitFromDetail">提交审批</a-button>
            <a-button v-if="canWithdrawRework(detailRecord)" @click="withdrawFromDetail">撤回</a-button>
            <a-button v-if="canApproveRework(detailRecord)" type="primary" @click="prepareApproval(detailRecord, true)">通过</a-button>
            <a-button v-if="canApproveRework(detailRecord)" danger @click="prepareApproval(detailRecord, false)">驳回</a-button>
            <a-button v-if="canApplyMaterial(detailRecord)" type="primary" @click="goPick(detailRecord)">申请领料</a-button>
          </div>
        </a-spin>
      </a-drawer>
    </template>

    <a-modal
      v-model:open="approvalVisible"
      :title="approvalApproved ? '通过返工申请' : '驳回返工申请'"
      :okText="approvalApproved ? '确认通过' : '确认驳回'"
      :confirm-loading="approving"
      @ok="submitApproval"
    >
      <a-alert
        type="info"
        show-icon
        class="rework-drawer__approval-tip"
        :message="approvalApproved ? '通过后将生成返工工序并进入返工阶段' : '驳回后申请人可以修改方案并重新提交'"
      />
      <a-textarea
        v-model:value="approvalComment"
        :rows="4"
        :maxlength="500"
        show-count
        :placeholder="approvalApproved ? '审批意见（选填）' : '请填写驳回原因（必填）'"
      />
    </a-modal>
  </BasicDrawer>
</template>

<script lang="ts" setup>
  import { computed, nextTick, reactive, ref } from 'vue';
  import dayjs from 'dayjs';
  import { useRouter } from 'vue-router';
  import { BasicDrawer, useDrawerInner } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { usePermission } from '/@/hooks/web/usePermission';
  import { validateEditableRows } from '/@/components/EditableTable';
  import {
    getApprovalStatusMeta,
    isApprovalPending,
    isApprovalPendingSubmit,
    isApprovalRejected,
    isApprovalWithdrawn,
  } from '/@/utils/approvalStatus';
  import MaterialPlanTable from '/@/views/plan/components/MaterialPlanTable.vue';
  import { enrichMaterialInfo, getCurrentUser, loadMaterialMap } from '/@/views/material/material.util';
  import { loadProjectWorkTypeOptions } from '../../Project.data';
  import {
    addProjectRework,
    approveProjectRework,
    editProjectRework,
    getMembers,
    getProjectReworkDetail,
    getProjectReworkMaterials,
    getProjectReworks,
    submitProjectRework,
    withdrawProjectRework,
  } from '../ProjectDetail.api';

  interface ReworkProcessRow extends Recordable {
    _key: number;
    processName?: string;
    siteLeaderId?: string;
    plannedStartTime?: string;
    plannedEndTime?: string;
    plannedHours?: number;
    remark?: string;
  }

  const emit = defineEmits(['register', 'success']);
  const router = useRouter();
  const { createMessage } = useMessage();
  const { hasPermission } = usePermission();
  const canApply = computed(() => hasPermission('project:rework:apply'));
  const canApprove = computed(() => hasPermission('project:rework:approve'));
  const currentUserId = computed(() => String(getCurrentUser().applyUserId || ''));

  const periodId = ref('');
  const project = ref<Recordable>({});
  const sourceAcceptance = ref<Recordable>({});
  const loading = ref(false);
  const saving = ref(false);
  const editing = ref(false);
  const reworks = ref<Recordable[]>([]);
  const workTypeOptions = ref<{ label: string; value: string }[]>([]);
  const leaderOptions = ref<{ label: string; value: string }[]>([]);
  const processRows = ref<ReworkProcessRow[]>([]);
  const materialRef = ref();
  let processSeed = 0;

  const form = reactive<Recordable>({ id: '', version: undefined, sourceAcceptanceId: '', sourceAcceptanceType: '', reason: '', description: '' });
  const projectTitle = computed(() => [project.value.projectName, project.value.periodName].filter(Boolean).join(' / ') || '项目返工');
  const sourceTypeText = computed(() =>
    form.sourceAcceptanceType === 'INTERNAL' ? '内部验收不通过' : form.sourceAcceptanceType === 'CUSTOMER' ? '外部验收不通过' : '验收不通过'
  );

  const processColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '工序名称', key: 'processName', width: 150, required: true },
    { title: '现场负责人', key: 'siteLeaderId', width: 160, required: true },
    { title: '计划开始时间', key: 'plannedStartTime', width: 150, required: true },
    { title: '计划完成时间', key: 'plannedEndTime', width: 150, required: true },
    { title: '预计工时(h)', key: 'plannedHours', width: 130, required: true },
    { title: '备注', key: 'remark', width: 180 },
  ];
  const reworkColumns = [
    { title: '返工单号', dataIndex: 'reworkNo', width: 180 },
    { title: '审批状态', key: 'approvalStatus', width: 110 },
    { title: '执行状态', key: 'executionStatus', width: 110 },
    { title: '申请人', dataIndex: 'applyUserName', width: 110 },
    { title: '返工工序', key: 'processSummary', width: 120 },
    { title: '额外领料', key: 'materialSummary', width: 120 },
    { title: '返工原因', key: 'reason', width: 220 },
    { title: '申请时间', dataIndex: 'applyTime', width: 170 },
    { title: '操作', key: 'action', width: 300, fixed: 'right' },
  ];
  const detailProcessColumns = [
    { title: '工序名称', dataIndex: 'processName', width: 120 },
    { title: '现场负责人', dataIndex: 'siteLeaderName', width: 120 },
    { title: '计划开始', dataIndex: 'plannedStartTime', width: 120 },
    { title: '计划完成', dataIndex: 'plannedEndTime', width: 120 },
    { title: '预计工时(h)', dataIndex: 'plannedHours', width: 110 },
  ];
  const materialStatColumns = [
    { title: '物料编码', dataIndex: 'materialCode', width: 130 },
    { title: '物料名称', dataIndex: 'materialName', width: 150 },
    { title: '计划额外领料', dataIndex: 'plannedAdditionalQty', width: 120 },
    { title: '已出库', dataIndex: 'outboundQty', width: 90 },
    { title: '已消耗', dataIndex: 'consumedQty', width: 90 },
    { title: '当前可申请', dataIndex: 'availableApplyQty', width: 110 },
  ];

  const detailVisible = ref(false);
  const detailLoading = ref(false);
  const detailRecord = ref<Recordable>({});
  const materialStats = ref<Recordable[]>([]);
  const approvalVisible = ref(false);
  const approvalApproved = ref(true);
  const approvalComment = ref('');
  const approvalRecord = ref<Recordable>({});
  const approving = ref(false);

  const [register] = useDrawerInner(async (data) => {
    const record = data?.record || data || {};
    periodId.value = String(data?.periodId || record.periodId || record.actionParams?.periodId || '');
    project.value = data?.project || record || {};
    sourceAcceptance.value = data?.sourceAcceptance || {};
    editing.value = false;
    detailVisible.value = false;
    resetForm();
    if (!periodId.value) {
      createMessage.error('缺少项目分期 ID，无法加载返工管理');
      return;
    }
    await Promise.all([loadReworks(), loadOptions()]);
    if (data?.reworkId) await viewRework({ id: String(data.reworkId) });
    else if (data?.initialCreate && sourceAcceptance.value.id) startCreate();
  });

  async function loadOptions() {
    const [types, members]: any[] = await Promise.all([
      loadProjectWorkTypeOptions(),
      getMembers({ periodId: periodId.value, pageNo: 1, pageSize: 1000 }),
    ]);
    workTypeOptions.value = types || [];
    const memberRecords = Array.isArray(members) ? members : members?.records || [];
    const seen = new Set<string>();
    leaderOptions.value = memberRecords
      .filter((member: any) => String(member.inviteStatus) === '1')
      .map((member: any) => ({
        label: member.memberName || member.userName || member.realname || '',
        value: String(member.userId || member.memberId || ''),
      }))
      .filter((option: any) => {
        if (!option.label || !option.value || seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      });
  }
  async function loadReworks() {
    loading.value = true;
    try {
      const result: any = await getProjectReworks({ periodId: periodId.value, pageNo: 1, pageSize: 100 });
      reworks.value = Array.isArray(result) ? result : result?.records || [];
    } catch (error: any) {
      reworks.value = [];
      createMessage.error(error?.message || '返工记录加载失败，请重试');
    } finally {
      loading.value = false;
    }
  }

  function parsePlan(record: Recordable) {
    let plan: Recordable = {};
    try {
      plan = typeof record?.planJson === 'string' ? JSON.parse(record.planJson || '{}') : record?.planJson || {};
    } catch {
      plan = {};
    }
    // 当前契约是一张返工单一个 process；仅在读取历史试验数据时取旧数组的第一项。
    const process =
      record?.process || plan.process || record?.processes?.[0] || plan.processes?.[0] || record?.processList?.[0] || plan.processList?.[0];
    const materials = record?.materials || plan.materials || [];
    return { process: process || undefined, materials: Array.isArray(materials) ? materials : [] };
  }

  function resetForm() {
    Object.assign(form, { id: '', version: undefined, sourceAcceptanceId: '', sourceAcceptanceType: '', reason: '', description: '' });
    processRows.value = [];
    materialRef.value?.reset?.();
  }

  function startCreate() {
    if (!canApply.value) return;
    const existing = reworks.value.find((record) => String(record.sourceAcceptanceId || '') === String(sourceAcceptance.value.id || ''));
    if (existing) {
      if (canEditRework(existing)) editRework(existing);
      else viewRework(existing);
      return;
    }
    resetForm();
    Object.assign(form, {
      sourceAcceptanceId: String(sourceAcceptance.value.id || ''),
      sourceAcceptanceType: String(sourceAcceptance.value.acceptType || ''),
    });
    addProcess();
    editing.value = true;
  }

  function addProcess() {
    processRows.value = [
      {
        _key: ++processSeed,
        processName: undefined,
        siteLeaderId: undefined,
        plannedStartTime: undefined,
        plannedEndTime: undefined,
        plannedHours: undefined,
        remark: '',
      },
    ];
  }

  function recalculateHours(record: ReworkProcessRow) {
    if (!record.plannedStartTime || !record.plannedEndTime) return;
    const start = dayjs(record.plannedStartTime);
    const end = dayjs(record.plannedEndTime);
    if (start.isValid() && end.isValid() && !end.isBefore(start)) record.plannedHours = Math.max(end.diff(start, 'day'), 0) * 8;
  }

  async function editRework(record: Recordable) {
    if (!canEditRework(record)) return;
    saving.value = true;
    try {
      const detail: any = await getProjectReworkDetail({ id: String(record.id) });
      const plan = parsePlan(detail || record);
      resetForm();
      Object.assign(form, {
        id: detail.id,
        version: detail.version,
        sourceAcceptanceId: detail.sourceAcceptanceId,
        sourceAcceptanceType: detail.sourceAcceptanceType || '',
        reason: detail.reason || '',
        description: detail.description || '',
      });
      processRows.value = plan.process ? [{ ...plan.process, _key: ++processSeed }] : [];
      if (!processRows.value.length) addProcess();
      editing.value = true;
      await nextTick();
      materialRef.value?.reset?.();
      if (plan.materials.length) await materialRef.value?.importRows?.(plan.materials);
    } catch (error: any) {
      createMessage.error(error?.message || '返工详情加载失败，请重试');
    } finally {
      saving.value = false;
    }
  }

  function cancelEdit() {
    editing.value = false;
    resetForm();
  }

  function buildProcess() {
    if (!processRows.value.length) throw new Error('请填写返工工序');
    const issues = validateEditableRows(processRows.value, {
      selectorField: 'processName',
      selectorLabel: '工序名称',
      optionLabel: (value) => workTypeOptions.value.find((option) => String(option.value) === String(value))?.label || String(value),
      rules: [
        { field: 'siteLeaderId', label: '现场负责人', required: true },
        {
          field: 'plannedStartTime',
          label: '计划开始时间',
          required: true,
          validate: (value) => dayjs(value as string).isValid() || '请选择有效的计划开始时间',
        },
        {
          field: 'plannedEndTime',
          label: '计划完成时间',
          required: true,
          validate: (value, row) =>
            (dayjs(value as string).isValid() && !dayjs(value as string).isBefore(dayjs(row.plannedStartTime))) || '计划完成时间不能早于计划开始时间',
        },
        { field: 'plannedHours', label: '预计工时', required: true, validate: (value) => Number(value) >= 0 || '预计工时不能小于 0' },
      ],
    });
    if (issues.length) throw new Error(issues[0].message);
    const record = processRows.value[0];
    return {
      processName: record.processName,
      siteLeaderId: record.siteLeaderId,
      siteLeaderName: leaderOptions.value.find((option) => String(option.value) === String(record.siteLeaderId))?.label || '',
      plannedStartTime: record.plannedStartTime,
      plannedEndTime: record.plannedEndTime,
      plannedHours: Number(record.plannedHours),
      remark: record.remark || '',
    };
  }

  async function saveDraft(andSubmit: boolean) {
    if (saving.value) return;
    if (!form.sourceAcceptanceId) {
      createMessage.warning('缺少来源失败验收记录，无法申请返工');
      return;
    }
    if (!String(form.reason || '').trim()) {
      createMessage.warning('请填写返工原因');
      return;
    }
    let process: Recordable;
    let materials: Recordable[];
    try {
      process = buildProcess();
      materials = materialRef.value?.getData?.() || [];
    } catch (error: any) {
      createMessage.warning(error.message);
      return;
    }
    saving.value = true;
    try {
      const editVersion = Number(form.version);
      if (form.id && !Number.isFinite(editVersion)) throw new Error('返工详情缺少有效版本号，请退出编辑后重新打开');
      const payload = {
        ...(form.id ? { id: form.id, version: editVersion } : {}),
        periodId: periodId.value,
        sourceAcceptanceId: form.sourceAcceptanceId,
        reason: String(form.reason).trim(),
        description: String(form.description || '').trim(),
        process,
        materials,
      };
      const saved: any = form.id ? await editProjectRework(payload) : await addProjectRework(payload);
      if (andSubmit) {
        const reworkId = String(saved?.id || form.id || '');
        if (!reworkId) throw new Error('返工草稿已保存，但响应缺少提交审批所需的返工单 ID');
        const { version } = await getLatestReworkSnapshot(reworkId);
        await submitProjectRework({ reworkId, version });
        createMessage.success('返工申请已提交审批');
      } else {
        createMessage.success('返工草稿已保存');
      }
      editing.value = false;
      await loadReworks();
      emit('success');
    } catch (error: any) {
      createMessage.error(error?.message || '返工申请保存失败，请重试');
    } finally {
      saving.value = false;
    }
  }

  function canEditRework(record: Recordable) {
    const isApplicant = !record.applyUserId || String(record.applyUserId) === currentUserId.value;
    return (
      canApply.value &&
      isApplicant &&
      [isApprovalPendingSubmit(record.approvalStatus), isApprovalRejected(record.approvalStatus), isApprovalWithdrawn(record.approvalStatus)].some(
        Boolean
      )
    );
  }

  function canSubmitRework(record: Recordable) {
    return canEditRework(record);
  }

  function canWithdrawRework(record: Recordable) {
    const isApplicant = !record.applyUserId || String(record.applyUserId) === currentUserId.value;
    return canApply.value && isApplicant && isApprovalPending(record.approvalStatus);
  }

  function canApproveRework(record: Recordable) {
    return canApprove.value && isApprovalPending(record.approvalStatus);
  }

  function canApplyMaterial(record: Recordable) {
    return String(record.approvalStatus) === '1' && String(record.executionStatus || '') !== 'COMPLETED' && parsePlan(record).materials.length > 0;
  }

  /**
   * version 是返工单的乐观锁。列表数据或弹窗打开时缓存的 version 都可能过期，
   * 所以每个状态动作执行前都重新读取详情，并只提交详情返回的最新 version。
   */
  async function getLatestReworkSnapshot(recordOrId: Recordable | string) {
    const reworkId = typeof recordOrId === 'string' ? recordOrId : String(recordOrId.id || '');
    if (!reworkId) throw new Error('缺少返工单 ID，无法读取最新版本');
    const latest: any = await getProjectReworkDetail({ id: reworkId });
    const version = Number(latest?.version);
    if (!Number.isFinite(version)) throw new Error('返工详情未返回有效的最新版本号，请刷新后重试');
    return { reworkId, version, latest };
  }

  async function submitRework(record: Recordable) {
    try {
      const { reworkId, version } = await getLatestReworkSnapshot(record);
      await submitProjectRework({ reworkId, version });
      createMessage.success('返工申请已提交审批');
      await loadReworks();
      emit('success');
      return true;
    } catch (error: any) {
      createMessage.error(error?.message || '返工申请提交失败，请重试');
      return false;
    }
  }

  async function withdrawRework(record: Recordable) {
    try {
      const { reworkId, version } = await getLatestReworkSnapshot(record);
      await withdrawProjectRework({ reworkId, version });
      createMessage.success('返工申请已撤回');
      await loadReworks();
      emit('success');
      return true;
    } catch (error: any) {
      createMessage.error(error?.message || '返工申请撤回失败，请重试');
      return false;
    }
  }

  function editFromDetail() {
    const record = { ...detailRecord.value };
    detailVisible.value = false;
    void editRework(record);
  }

  async function submitFromDetail() {
    if (await submitRework(detailRecord.value)) detailVisible.value = false;
  }

  async function withdrawFromDetail() {
    if (await withdrawRework(detailRecord.value)) detailVisible.value = false;
  }

  function prepareApproval(record: Recordable, approved: boolean) {
    approvalRecord.value = record;
    approvalApproved.value = approved;
    approvalComment.value = '';
    approvalVisible.value = true;
  }

  async function submitApproval() {
    if (!approvalApproved.value && !approvalComment.value.trim()) {
      createMessage.warning('请填写驳回原因');
      return;
    }
    approving.value = true;
    try {
      const { reworkId, version } = await getLatestReworkSnapshot(approvalRecord.value);
      await approveProjectRework({
        reworkId,
        version,
        approvalResult: approvalApproved.value ? 'AGREE' : 'REJECT',
        approvalComment: approvalComment.value.trim(),
      });
      createMessage.success(approvalApproved.value ? '返工申请已通过' : '返工申请已驳回');
      approvalVisible.value = false;
      detailVisible.value = false;
      await loadReworks();
      emit('success');
    } catch (error: any) {
      createMessage.error(error?.message || '返工审批失败，请重试');
    } finally {
      approving.value = false;
    }
  }

  async function viewRework(record: Recordable) {
    detailVisible.value = true;
    detailLoading.value = true;
    materialStats.value = [];
    try {
      const [detail, stats, materialMap]: any[] = await Promise.all([
        getProjectReworkDetail({ id: String(record.id) }),
        getProjectReworkMaterials({ reworkId: String(record.id) }),
        loadMaterialMap(),
      ]);
      detailRecord.value = detail || record;
      const records = Array.isArray(stats) ? stats : [];
      enrichMaterialInfo(records, materialMap);
      materialStats.value = records;
    } catch (error: any) {
      createMessage.error(error?.message || '返工详情加载失败，请重试');
    } finally {
      detailLoading.value = false;
    }
  }

  function goPick(record: Recordable) {
    router.push({ path: '/material/pick', query: { periodId: periodId.value, reworkId: String(record.id) } });
  }

  function executionMeta(value: unknown) {
    const status = String(value || 'NOT_STARTED');
    if (status === 'COMPLETED') return { text: '已完成', color: 'success' };
    if (status === 'IN_PROGRESS') return { text: '返工中', color: 'processing' };
    return { text: '未开始', color: 'default' };
  }
</script>

<style lang="less" scoped>
  .rework-drawer {
    &__header,
    &__section-heading,
    &__form-actions,
    &__row-actions,
    &__detail-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    &__header,
    &__section-heading {
      justify-content: space-between;
    }
    &__header {
      margin-bottom: 16px;
    }
    &__project {
      color: #262626;
      font-size: 16px;
      font-weight: 600;
    }
    &__hint,
    &__section-subtitle {
      margin-top: 4px;
      color: #8c8c8c;
    }
    &__notice,
    &__approval-tip {
      margin-bottom: 16px;
    }
    &__section {
      margin-bottom: 24px;
    }
    &__section-title,
    &__detail-title {
      margin-bottom: 12px;
      color: #262626;
      font-weight: 600;
    }
    &__source {
      margin-bottom: 16px;
    }
    &__required {
      margin-left: 2px;
      color: #ff4d4f;
    }
    &__form-actions {
      justify-content: flex-end;
      padding: 16px 0 8px;
      border-top: 1px solid #f0f0f0;
    }
    &__ellipsis {
      display: inline-block;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: bottom;
    }
    &__detail-title {
      margin-top: 20px;
    }
    &__detail-actions {
      justify-content: flex-end;
      margin-top: 20px;
    }
  }
</style>
