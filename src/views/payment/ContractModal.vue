<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    destroyOnClose
    :title="title"
    :width="760"
    @ok="handleSubmit"
  >
    <div class="contract-modal">
      <!-- 合同信息 -->
      <div class="contract-modal__section">
        <div class="contract-modal__section-title">合同信息</div>
        <BasicForm @register="registerForm" />
      </div>

      <!-- 回款计划 -->
      <div class="contract-modal__section">
        <div class="contract-modal__section-title">
          回款计划
          <a-button type="link" size="small" @click="addPaybackRow">+ 添加</a-button>
        </div>
        <a-table
          :columns="paybackColumns"
          :data-source="paybackList"
          :pagination="false"
          size="small"
          bordered
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'type'">
              <a-select
                v-model:value="record.type"
                :options="paybackTypeOpts"
                placeholder="回款类型"
                style="width: 100%"
              />
            </template>
            <template v-else-if="column.key === 'amount'">
              <a-input-number v-model:value="record.amount" :min="0" placeholder="计划回款金额" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'planDate'">
              <a-date-picker v-model:value="record.planDate" valueFormat="YYYY-MM-DD" placeholder="计划回款日期" style="width: 100%" />
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button type="link" size="small" danger @click="removePaybackRow(index)">删除</a-button>
            </template>
          </template>
        </a-table>
      </div>
    </div>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed, unref, onMounted } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { loadContractTypeOptions, loadPaybackTypeOptions } from './Payment.data';
  import { saveContract } from './Payment.api';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const isUpdate = ref(false);
  const title = computed(() => (unref(isUpdate) ? '编辑合同' : '新增合同'));

  const paybackList = ref<any[]>([]);

  // 回款类型下拉(字典 payback_type, 失败兜底硬编码)
  const paybackTypeOpts = ref<{ label: string; value: string }[]>([]);
  onMounted(async () => {
    paybackTypeOpts.value = await loadPaybackTypeOptions();
  });

  const [registerForm, { resetFields, setFieldsValue, validate }] = useForm({
    labelWidth: 110,
    showActionButtonGroup: false,
    baseColProps: { span: 12 },
    schemas: [
      {
        label: '合同类型',
        field: 'contractType',
        component: 'ApiSelect',
        componentProps: { api: loadContractTypeOptions, placeholder: '请选择合同类型' },
        dynamicRules: () => [{ required: true, message: '请选择合同类型!' }],
      },
      {
        label: '合同金额',
        field: 'contractAmount',
        component: 'InputNumber',
        componentProps: { placeholder: '请输入合同金额', min: 0, style: { width: '100%' } },
        dynamicRules: () => [{ required: true, message: '请输入合同金额!' }],
      },
      {
        label: '合同签订日期',
        field: 'signDate',
        component: 'DatePicker',
        componentProps: { valueFormat: 'YYYY-MM-DD', placeholder: '请选择合同签订日期' },
        dynamicRules: () => [{ required: true, message: '请选择合同签订日期!' }],
      },
      {
        label: '负责人',
        field: 'owner',
        component: 'Input',
        componentProps: { placeholder: '请输入负责人' },
        dynamicRules: () => [{ required: true, message: '请输入负责人!' }],
      },
      {
        label: '关联项目ID',
        field: 'projectNo',
        component: 'Input',
        componentProps: { placeholder: '请输入关联项目ID' },
      },
      {
        label: '甲方名称',
        field: 'customerName',
        component: 'Input',
        componentProps: { placeholder: '请输入甲方名称' },
        dynamicRules: () => [{ required: true, message: '请输入甲方名称!' }],
      },
      {
        label: '甲方联系人',
        field: 'contact',
        component: 'Input',
        componentProps: { placeholder: '请输入甲方联系人' },
      },
      {
        label: '甲方联系电话',
        field: 'phone',
        component: 'Input',
        componentProps: { placeholder: '请输入甲方联系电话' },
      },
      {
        label: '备注',
        field: 'remark',
        component: 'InputTextArea',
        componentProps: { placeholder: '请输入备注', rows: 2 },
      },
    ],
  });

  // 回款计划编辑列
  const paybackColumns = [
    { title: '序号', dataIndex: 'seq', width: 50, align: 'center', customRender: ({ index }) => index + 1 },
    { title: '回款类型', key: 'type', width: 140 },
    { title: '计划回款金额', key: 'amount', width: 140 },
    { title: '计划回款日期', key: 'planDate', width: 150 },
    { title: '操作', key: 'action', width: 70, align: 'center' },
  ];

  const [register, { closeModal }] = useModalInner(async (data) => {
    await resetFields();
    isUpdate.value = !!data?.isUpdate;
    paybackList.value = [];
    if (data?.record) {
      await setFieldsValue({ ...data.record });
      paybackList.value = (data.record.paybackPlan || []).map((p) => ({ ...p }));
    }
  });

  function addPaybackRow() {
    paybackList.value.push({ type: undefined, amount: undefined, planDate: undefined });
  }

  function removePaybackRow(index: number) {
    paybackList.value.splice(index, 1);
  }

  async function handleSubmit() {
    try {
      const values = await validate();
      await saveContract({
        ...values,
        paybackPlan: paybackList.value,
      });
      createMessage.success('保存成功');
      closeModal();
      emit('success');
    } catch ({ errorFields }) {
      if (errorFields) {
        return Promise.reject(errorFields);
      }
    }
  }
</script>

<style lang="less" scoped>
  .contract-modal {
    &__section {
      margin-bottom: 16px;

      &-title {
        font-weight: 600;
        font-size: 15px;
        color: #333;
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    }
  }
</style>
