<template>
  <div class="payment-detail">
    <a-card class="payment-detail__card">
      <!-- 顶部 -->
      <div class="payment-detail__header">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="goBack">返回</a-button>
        <span class="payment-detail__title">回款管理 > 回款记录</span>
      </div>

      <!-- 合同信息 -->
      <div class="payment-detail__info">
        <div class="payment-detail__info-title">合同ID：{{ contract.contractNo || '—' }}</div>
        <a-descriptions :column="3" size="small" bordered>
          <a-descriptions-item label="合同类型">{{ contract.contractType || '—' }}</a-descriptions-item>
          <a-descriptions-item label="甲方名称">{{ contract.customerName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="项目状态">{{ contract.projectStatus || '—' }}</a-descriptions-item>
          <a-descriptions-item label="已回款金额">{{ contract.paidAmount || 0 }}</a-descriptions-item>
          <a-descriptions-item label="未回款金额">{{ contract.unpaidAmount || 0 }}</a-descriptions-item>
          <a-descriptions-item label="合同签订日期">{{ contract.signDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="合同金额">{{ contract.contractAmount || '—' }}</a-descriptions-item>
          <a-descriptions-item label="负责人">{{ contract.owner || '—' }}</a-descriptions-item>
          <a-descriptions-item label="关联项目ID">{{ contract.projectNo || '—' }}</a-descriptions-item>
        </a-descriptions>
      </div>

      <!-- 回款记录 -->
      <div class="payment-detail__body">
        <div class="payment-detail__body-toolbar">
          <span class="payment-detail__body-title">回款计划</span>
          <a-button type="primary" preIcon="ant-design:plus-outlined" @click="openAddPayback">添加回款</a-button>
        </div>
        <a-table
          :columns="columns"
          :data-source="paybackRecords"
          :pagination="false"
          size="middle"
          bordered
        />
      </div>
    </a-card>

    <PaybackModal @register="registerModal" :contract="contract" @success="load" />
  </div>
</template>

<script lang="ts" name="payment-detail" setup>
  import { ref, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useModal } from '/@/components/Modal';
  import { contractDetail, paybackList } from '../Payment.api';
  import PaybackModal from '../PaybackModal.vue';

  const route = useRoute();
  const router = useRouter();
  const contractId = route.params.id as string;

  const contract = ref<any>({});
  const paybackRecords = ref<any[]>([]);
  const [registerModal, { openModal }] = useModal();

  // 墨刀回款记录列: 回款类型/计划回款金额/已回款金额/未回款金额/计划回款日期/回款详情
  const columns = [
    { title: '回款类型', dataIndex: 'type', width: 110 },
    { title: '计划回款金额', dataIndex: 'planAmount', width: 120 },
    { title: '已回款金额', dataIndex: 'paidAmount', width: 110 },
    { title: '未回款金额', dataIndex: 'unpaidAmount', width: 110 },
    { title: '计划回款日期', dataIndex: 'planDate', width: 120 },
    { title: '回款详情', dataIndex: 'detail' },
  ];

  async function load() {
    const info = await contractDetail({ id: contractId });
    contract.value = info || {};
    const records = await paybackList({ contractId });
    paybackRecords.value = records || [];
  }

  function openAddPayback() {
    openModal(true, { contract: contract.value });
  }

  function goBack() {
    router.push('/payment/list');
  }

  onMounted(() => {
    load();
  });
</script>

<style lang="less" scoped>
  .payment-detail {
    padding: 16px;

    &__card {
      background: #fff;
      border-radius: 4px;
      padding: 16px;
    }

    &__header {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 16px;
    }

    &__title {
      font-weight: 600;
      font-size: 16px;
      color: #333;
    }

    &__info {
      margin-bottom: 24px;

      &-title {
        font-weight: 600;
        color: #333;
        margin-bottom: 12px;
      }
    }

    &__body {
      &-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      &-title {
        font-weight: 600;
        font-size: 15px;
        color: #333;
      }
    }
  }
</style>
