<template>
  <div class="plan-payment">
    <!-- 合同主信息(只读, 来自合同信息页面) -->
    <div class="plan-payment__group">
      <div class="plan-payment__group-title">合同主信息</div>
      <a-descriptions :column="3" size="middle" bordered>
        <a-descriptions-item label="合同编号">{{ contract.contractNo || '—' }}</a-descriptions-item>
        <a-descriptions-item label="合同类型">{{ contractTypeText }}</a-descriptions-item>
        <a-descriptions-item label="合同金额">{{ contract.contractAmount != null ? `${contract.contractAmount} 元` : '—' }}</a-descriptions-item>
        <a-descriptions-item label="销售负责人">{{ salesUserText }}</a-descriptions-item>
        <a-descriptions-item label="质保期">{{ contract.warrantyPeriod != null ? `${contract.warrantyPeriod} 月` : '—' }}</a-descriptions-item>
        <a-descriptions-item label="计划交付日期">{{ contract.plannedDeliveryDate || '—' }}</a-descriptions-item>
        <a-descriptions-item label="合同附件" :span="3">
          <a-space v-if="contractAttachments.length" direction="vertical" size="small">
            <a-button
              v-for="file in contractAttachments"
              :key="file.id || file.fileId"
              type="link"
              size="small"
              preIcon="ant-design:eye-outlined"
              @click="previewFileInModal(file.fileId, file.fileName)"
            >
              预览：{{ file.fileName }}
            </a-button>
          </a-space>
          <span v-else>—</span>
        </a-descriptions-item>
        <a-descriptions-item label="备注" :span="3">{{ contract.remark || '—' }}</a-descriptions-item>
      </a-descriptions>
    </div>

    <!-- 回款计划(节点 + 比例, 金额按合同金额自动计算) -->
    <div class="plan-payment__group">
      <div class="plan-payment__group-title">
        <span>回款计划</span>
        <span class="plan-payment__hint">金额 = 合同金额 × 比例</span>
      </div>
      <a-table
        :loading="loading"
        :columns="columns"
        :data-source="rows"
        :row-key="(record) => record._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'node'">
            {{ getNodeText(record.node) }}
          </template>
          <template v-else-if="column.key === 'ratio'">
            <a-input-number
              v-model:value="record.ratio"
              :min="0"
              :max="100"
              disabled
              placeholder="比例%"
              style="width: 100%"
              addon-after="%"
              @change="calcAmount(record)"
            />
          </template>
          <template v-else-if="column.key === 'amount'">
            <b>{{ record.amount != null ? record.amount.toFixed(2) : '—' }} 元</b>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, unref, watch } from 'vue';
  import { initDictOptions } from '/@/utils/dict/index';
  import { loadUserOptions, type UserOption } from '/@/views/resource/userOptions';
  import { getPlanMembers } from './Plan.api';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { getFiles } from '../detail/ProjectDetail.api';

  const props = defineProps<{
    periodId?: string;
    contractRecord?: Recordable;
    projectRecord?: Recordable;
  }>();

  const contract = ref<Recordable>({});
  // 回款项下拉(字典 payback_node)
  const nodeOptions = ref<{ label: string; value: string }[]>([]);
  const contractTypeOptions = ref<any[]>([]);
  const userOptions = ref<UserOption[]>([]);
  const projectMembers = ref<any[]>([]);
  const project = ref<Recordable>({});
  const contractAttachments = ref<Recordable[]>([]);
  const loading = ref(false);
  const loaded = ref(false);
  const loadFailed = ref(false);
  let loadSequence = 0;

  const contractTypeText = computed(() => {
    const value = contract.value.contractType;
    if (value == null || value === '') return '—';
    const option = contractTypeOptions.value.find((item) => String(item.value) === String(value));
    return option?.label || option?.text || option?.title || String(value);
  });

  function isValidName(value: unknown) {
    const text = String(value || '').trim();
    return !!text && text !== '-' && text !== '—';
  }

  const salesUserText = computed(() => {
    const salesUser = contract.value.salesUser || contract.value.saleUser || {};
    const snapshot = [
      contract.value.salesUserName,
      contract.value.saleUserName,
      contract.value.salesUserRealName,
      contract.value.salesName,
      project.value.salesUserName,
      project.value.saleUserName,
      project.value.salesName,
      salesUser.realname,
      salesUser.realName,
      salesUser.name,
      salesUser.username,
    ].find(isValidName);
    if (snapshot) return String(snapshot).trim();
    const salesUserId =
      contract.value.salesUserId ??
      contract.value.saleUserId ??
      project.value.salesUserId ??
      project.value.saleUserId ??
      salesUser.id ??
      salesUser.userId;
    if (salesUserId != null && salesUserId !== '') {
      const userName = userOptions.value.find(
        (item) => String(item.value) === String(salesUserId) || String(item.username || '') === String(salesUserId)
      )?.label;
      if (userName) return userName;
      const matchedMember = projectMembers.value.find((item) => String(item.userId ?? item.memberId) === String(salesUserId));
      const memberName = matchedMember?.userName || matchedMember?.memberName;
      if (memberName) return memberName;
    }
    const creator = contract.value.createBy ?? contract.value.createUser ?? contract.value.creator;
    if (isValidName(creator)) {
      const creatorName = userOptions.value.find(
        (item) => String(item.username || '') === String(creator) || String(item.value) === String(creator)
      )?.label;
      if (creatorName) return creatorName;
    }
    const salesMember = projectMembers.value.find((item) =>
      String(item.memberRole ?? item.role)
        .split(/[,，、]/)
        .map((role) => role.trim())
        .includes('1')
    );
    const memberName = salesMember?.userName || salesMember?.memberName;
    if (isValidName(memberName)) return memberName;
    return isValidName(creator) ? String(creator).trim() : '—';
  });

  function hasSalesNameSnapshot() {
    const salesUser = contract.value.salesUser || contract.value.saleUser || {};
    return [
      contract.value.salesUserName,
      contract.value.saleUserName,
      contract.value.salesUserRealName,
      contract.value.salesName,
      project.value.salesUserName,
      project.value.saleUserName,
      project.value.salesName,
      salesUser.realname,
      salesUser.realName,
      salesUser.name,
      salesUser.username,
    ].some(isValidName);
  }

  /**
   * 合同与回款明细由父页面已经完成的上下文请求直接传入，避免页签再次查询同一份数据。
   * 只有销售负责人没有姓名快照时，才按需请求用户与项目成员作为兜底。
   */
  async function load() {
    const sequence = ++loadSequence;
    loading.value = true;
    loaded.value = false;
    loadFailed.value = false;
    try {
      contract.value = { ...(props.contractRecord || {}) };
      project.value = { ...(props.projectRecord || {}) };
      userOptions.value = [];
      projectMembers.value = [];
      contractAttachments.value = [];
      setRows(Array.isArray(contract.value.records) ? contract.value.records : []);

      const dictionaryPromise = Promise.allSettled([initDictOptions('payback_node'), initDictOptions('contract_type')]);
      const fallbackPromise =
        !hasSalesNameSnapshot() && props.periodId
          ? Promise.allSettled([loadUserOptions(false), getPlanMembers({ periodId: props.periodId, pageNo: 1, pageSize: 1000 })])
          : Promise.resolve([]);
      const attachmentPromise = props.periodId
        ? getFiles({ periodId: props.periodId, pageNo: 1, pageSize: 100 }).catch(() => undefined)
        : Promise.resolve(undefined);
      const [dictionaryResults, fallbackResults, attachmentResult]: any[] = await Promise.all([
        dictionaryPromise,
        fallbackPromise,
        attachmentPromise,
      ]);
      if (sequence !== loadSequence) return;

      const attachmentRecords = (Array.isArray(attachmentResult) ? attachmentResult : attachmentResult?.records || []).filter(
        (item: Recordable) => String(item.fileType || '') === 'CONTRACT_ATTACHMENT' && item.fileId
      );
      contractAttachments.value = attachmentRecords.length
        ? attachmentRecords
        : [
            {
              fileId: contract.value.contractFile?.fileId || contract.value.contractFileId || contract.value.contractFilePath,
              fileName: contract.value.contractFile?.fileName || contract.value.contractFileName,
            },
            {
              fileId: contract.value.materialFile?.fileId || contract.value.materialFileId || contract.value.materialListFilePath,
              fileName: contract.value.materialFile?.fileName || contract.value.materialFileName,
            },
          ]
            .filter((item) => item.fileId)
            .map((item) => ({ ...item, fileName: item.fileName || String(item.fileId).split('/').pop() || '合同附件' }));

      const [nodeResult, typeResult] = dictionaryResults;
      nodeOptions.value = nodeResult.status === 'fulfilled' ? nodeResult.value || [] : [];
      contractTypeOptions.value = typeResult.status === 'fulfilled' ? typeResult.value || [] : [];

      if (fallbackResults.length) {
        const [userResult, memberResult] = fallbackResults;
        userOptions.value = userResult.status === 'fulfilled' ? userResult.value || [] : [];
        const memberPayload: any = memberResult.status === 'fulfilled' ? memberResult.value : [];
        projectMembers.value = memberPayload?.records || memberPayload || [];
      }
      loaded.value = true;
    } catch {
      if (sequence !== loadSequence) return;
      loaded.value = false;
      loadFailed.value = true;
      contract.value = {};
      project.value = {};
      projectMembers.value = [];
      contractAttachments.value = [];
      rows.value = [];
    } finally {
      if (sequence === loadSequence) loading.value = false;
    }
  }

  // 回款计划行
  const columns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '回款项', key: 'node', width: 160 },
    { title: '比例(%)', key: 'ratio', width: 140 },
    { title: '金额(自动)', key: 'amount', width: 160 },
  ];
  const rows = ref<any[]>([]);
  let rowSeed = 0;

  function getNodeText(value: unknown) {
    if (value == null || value === '') return '—';
    return nodeOptions.value.find((item) => String(item.value) === String(value))?.label || String(value);
  }

  /** 金额 = 合同金额 × 比例% */
  function calcAmount(record: any) {
    const amount = Number(contract.value.contractAmount) || 0;
    const ratio = Number(record.ratio) || 0;
    record.amount = ratio > 0 ? (amount * ratio) / 100 : 0;
  }

  function setRows(list: any[]) {
    rowSeed = 0;
    rows.value = (list || []).map((item) => ({
      ...item,
      _key: ++rowSeed,
      node: item.paymentNode ?? item.node,
      amount: Number(item.plannedAmount ?? item.amount) || 0,
    }));
    rows.value.forEach((row) => calcAmount(row));
  }

  watch(
    () => [props.periodId, props.contractRecord, props.projectRecord],
    () => load(),
    { immediate: true }
  );

  // 合同金额变化 → 重算所有行金额
  watch(
    () => contract.value.contractAmount,
    () => rows.value.forEach((row) => calcAmount(row))
  );

  defineExpose({
    getData() {
      return unref(rows);
    },
    setData: setRows,
    getSubmissionState() {
      return {
        loading: loading.value,
        loaded: loaded.value,
        loadFailed: loadFailed.value,
        saving: false,
        dirty: false,
      };
    },
  });
</script>

<style lang="less" scoped>
  .plan-payment {
    &__group {
      margin-bottom: 16px;

      &-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin-bottom: 12px;
      }

      &-hint {
        font-weight: 400;
        font-size: 12px;
        color: #999;
      }
    }
  }
</style>
