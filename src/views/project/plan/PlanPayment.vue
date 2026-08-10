<template>
  <div class="plan-payment">
    <!-- 合同信息 -->
    <div class="plan-payment__group">
      <div class="plan-payment__group-title">合同信息</div>
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="项目名称">
              <a-input v-model:value="contractInfo.projectName" :disabled="true" placeholder="自动带出" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="甲方名称">
              <a-input v-model:value="contractInfo.customerName" :disabled="true" placeholder="自动带出" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="合同类型">
              <a-select v-model:value="contractInfo.contractType" :disabled="!editable" placeholder="请选择合同类型" style="width: 100%" :options="contractTypeOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="合同金额">
              <a-input-number v-model:value="contractInfo.amount" :disabled="!editable" placeholder="请输入合同金额" style="width: 100%" :min="0" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="合同签订日期">
              <a-date-picker v-model:value="contractInfo.signDate" :disabled="!editable" value-format="YYYY-MM-DD" style="width: 100%" placeholder="请选择签订日期" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="质保期">
              <a-input-number v-model:value="contractInfo.warranty" :disabled="!editable" placeholder="请输入质保期" style="width: 60%" :min="0" />
              <span style="margin-left: 8px">年</span>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <!-- 回款计划 -->
    <div class="plan-payment__group">
      <div class="plan-payment__group-title">
        <span>回款计划</span>
        <a-button v-if="editable" type="primary" size="small" preIcon="ant-design:plus-outlined" @click="addPayment">添加</a-button>
      </div>
      <a-table
        :columns="paymentColumns"
        :data-source="paymentList"
        :row-key="(record) => record._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'type'">
            <a-select v-model:value="record.type" :disabled="!editable" placeholder="请选择回款类型" style="width: 100%" :options="paymentTypeOptions" />
          </template>
          <template v-else-if="column.key === 'amount'">
            <a-input-number v-model:value="record.amount" :disabled="!editable" :min="0" placeholder="计划回款金额" style="width: 100%" />
          </template>
          <template v-else-if="column.key === 'date'">
            <a-date-picker v-model:value="record.date" :disabled="!editable" value-format="YYYY-MM-DD" style="width: 100%" placeholder="计划回款日期" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="editable" type="link" danger size="small" @click="removePayment(record._key)">删除</a-button>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 合同文件 + 备注 -->
    <div class="plan-payment__group">
      <div class="plan-payment__group-title">合同文件</div>
      <a-upload :disabled="!editable" :before-upload="() => false" :max-count="1">
        <a-button preIcon="ant-design:upload-outlined">上传文件</a-button>
      </a-upload>
    </div>
    <div class="plan-payment__group">
      <div class="plan-payment__group-title">备注</div>
      <a-textarea v-model:value="paymentRemark" :disabled="!editable" placeholder="请输入备注" :rows="3" />
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, unref, watch } from 'vue';
  import { contractTypeOptions } from '../Project.data';

  // 属性: editable 控制是否可编辑; project 项目信息(自动带出)
  const props = defineProps<{
    editable?: boolean;
    project?: Recordable;
  }>();

  // 回款类型(后续接字典)
  const paymentTypeOptions = [
    { label: '预付款', value: '预付款' },
    { label: '进度款', value: '进度款' },
    { label: '验收款', value: '验收款' },
    { label: '质保金', value: '质保金' },
  ];

  // 合同信息
  const contractInfo = reactive<any>({
    projectName: '',
    customerName: '',
    contractType: undefined,
    amount: undefined,
    signDate: undefined,
    warranty: undefined,
  });

  // 项目信息变化时自动带出
  watch(
    () => props.project,
    (val) => {
      if (val?.projectName) {
        contractInfo.projectName = val.projectName;
        contractInfo.customerName = val.customerName;
      }
    },
    { immediate: true }
  );

  // 回款计划
  const paymentColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '回款类型', key: 'type', width: 140 },
    { title: '计划回款金额', key: 'amount', width: 160 },
    { title: '计划回款日期', key: 'date', width: 160 },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const paymentList = ref<any[]>([]);
  let paymentSeed = 0;

  // 备注
  const paymentRemark = ref('');

  // 暴露给父级
  defineExpose({
    getData() {
      return {
        contractInfo: { ...unref(contractInfo) },
        paymentList: unref(paymentList),
        remark: unref(paymentRemark),
      };
    },
    setData(data: any) {
      if (data?.contractInfo) {
        Object.assign(contractInfo, data.contractInfo);
      }
      paymentList.value = (data?.paymentList || []).map((item) => ({ ...item, _key: ++paymentSeed }));
      paymentRemark.value = data?.remark || '';
    },
  });

  // 添加回款
  function addPayment() {
    paymentList.value.push({ _key: ++paymentSeed, type: undefined, amount: undefined, date: undefined });
  }

  // 移除回款
  function removePayment(key: number) {
    paymentList.value = paymentList.value.filter((p) => p._key !== key);
  }
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
    }
  }
</style>
