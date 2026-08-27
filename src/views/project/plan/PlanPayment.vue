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
        <a-descriptions-item label="合同文件" :span="3">
          <a-button
            v-if="contractFileId"
            type="link"
            size="small"
            preIcon="ant-design:eye-outlined"
            @click="previewFileInModal(contractFileId, contractFileName)"
          >
            预览：{{ contractFileName }}
          </a-button>
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
      <a-table :columns="columns" :data-source="rows" :row-key="(record) => record._key" :pagination="false" size="middle" bordered>
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
  import { computed, ref, unref, watch, onMounted } from 'vue';
  import { contractDetail, paybackList } from '/@/views/payment/Payment.api';
  import { initDictOptions } from '/@/utils/dict/index';
  import { loadUserOptions, type UserOption } from '/@/views/resource/userOptions';
  import { getPlanMembers } from './Plan.api';
  import { projectDetail } from '../Project.api';
  import { previewFileInModal } from '/@/utils/filePreview';

  const props = defineProps<{
    periodId?: string;
  }>();

  const contract = ref<Recordable>({});
  // 回款项下拉(字典 payback_node)
  const nodeOptions = ref<{ label: string; value: string }[]>([]);
  const contractTypeOptions = ref<any[]>([]);
  const userOptions = ref<UserOption[]>([]);
  const projectMembers = ref<any[]>([]);
  const project = ref<Recordable>({});

  const contractFileId = computed(
    () => contract.value.contractFile?.fileId || contract.value.contractFileId || contract.value.contractFilePath || ''
  );
  const contractFileName = computed(
    () =>
      contract.value.contractFile?.fileName ||
      contract.value.contractFileName ||
      (contractFileId.value ? String(contractFileId.value).split('/').pop() || '合同文件' : '')
  );

  const contractTypeText = computed(() => {
    const value = contract.value.contractType;
    if (value == null || value === '') return '—';
    const option = contractTypeOptions.value.find((item) => String(item.value) === String(value));
    return option?.label || option?.text || option?.title || String(value);
  });

  const salesUserText = computed(() => {
    const salesUser = contract.value.salesUser || contract.value.saleUser || {};
    const isValidName = (value: unknown) => {
      const text = String(value || '').trim();
      return !!text && text !== '-' && text !== '—';
    };
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
    const salesMember = projectMembers.value.find((item) => String(item.memberRole ?? item.role) === '1');
    const memberName = salesMember?.userName || salesMember?.memberName;
    if (isValidName(memberName)) return memberName;
    return isValidName(creator) ? String(creator).trim() : '—';
  });

  async function load() {
    if (!props.periodId) return;
    try {
      const [contractResult, paybackResult, nodeResult, typeResult, userResult, memberResult, projectResult] = await Promise.allSettled([
        contractDetail({ periodId: props.periodId }),
        paybackList({ periodId: props.periodId, pageNo: 1, pageSize: 100 }),
        initDictOptions('payback_node'),
        initDictOptions('contract_type'),
        loadUserOptions(true),
        getPlanMembers({ periodId: props.periodId, pageNo: 1, pageSize: 1000 }),
        projectDetail({ periodId: props.periodId }),
      ]);
      if (contractResult.status === 'rejected') throw contractResult.reason;
      const paybackRes: any = paybackResult.status === 'fulfilled' ? paybackResult.value : [];
      contract.value = contractResult.value || {};
      project.value = projectResult.status === 'fulfilled' ? projectResult.value || {} : {};
      nodeOptions.value = nodeResult.status === 'fulfilled' ? nodeResult.value || [] : [];
      contractTypeOptions.value = typeResult.status === 'fulfilled' ? typeResult.value || [] : [];
      userOptions.value = userResult.status === 'fulfilled' ? userResult.value || [] : [];
      const memberPayload: any = memberResult.status === 'fulfilled' ? memberResult.value : [];
      projectMembers.value = memberPayload?.records || memberPayload || [];
      const paymentRecords = Array.isArray(paybackRes?.records) ? paybackRes.records : Array.isArray(paybackRes) ? paybackRes : [];
      setRows(paymentRecords.length ? paymentRecords : contract.value.records || []);
    } catch {
      contract.value = {};
      project.value = {};
      projectMembers.value = [];
      rows.value = [];
    }
  }

  onMounted(() => {
    load();
  });

  // 合同金额变化 → 重算所有行金额
  watch(
    () => contract.value.contractAmount,
    () => rows.value.forEach((r) => calcAmount(r))
  );

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
    rows.value = (list || []).map((item) => ({ ...item, _key: ++rowSeed, amount: Number(item.amount) || 0 }));
    rows.value.forEach((row) => calcAmount(row));
  }

  defineExpose({
    getData() {
      return unref(rows);
    },
    setData: setRows,
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
