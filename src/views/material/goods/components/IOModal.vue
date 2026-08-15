<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    destroyOnClose
    :title="title"
    :width="520"
    @ok="handleSubmit"
  >
    <!-- 物料基础信息(只读) -->
    <a-descriptions :column="1" size="small" bordered class="io-desc">
      <a-descriptions-item label="物料编码">{{ material.materialCode }}</a-descriptions-item>
      <a-descriptions-item label="物料名称">{{ material.materialName }}</a-descriptions-item>
      <a-descriptions-item label="基准单位">{{ material.unit }}</a-descriptions-item>
      <a-descriptions-item label="当前库存">{{ material.stockQty }} {{ material.unit }}</a-descriptions-item>
    </a-descriptions>

    <!-- 出入库录入：对齐 StockIoRecord(manualIn/manualOut) -->
    <a-form layout="vertical" class="io-form">
      <a-form-item label="出入库类型" required>
        <a-radio-group v-model:value="form.ioType" button-style="solid">
          <a-radio-button value="IN">入库</a-radio-button>
          <a-radio-button value="OUT">出库</a-radio-button>
        </a-radio-group>
      </a-form-item>
      <a-form-item label="单位" required>
        <a-select
          v-model:value="form.unitId"
          :options="unitSelectOptions"
          placeholder="请选择单位"
          style="width: 100%"
        />
      </a-form-item>
      <a-form-item label="数量" required>
        <a-input-number
          v-model:value="form.unitQty"
          :min="0"
          :precision="2"
          placeholder="按所选单位录入数量"
          style="width: 100%"
        />
      </a-form-item>
      <a-form-item label="基准单价">
        <a-input-number
          v-model:value="form.unitPrice"
          :min="0"
          :precision="2"
          placeholder="基准单位单价"
          style="width: 100%"
        />
      </a-form-item>
      <a-form-item label="备注">
        <a-textarea v-model:value="form.remark" :rows="2" placeholder="请输入备注" />
      </a-form-item>
    </a-form>

    <!-- 换算预览：基准数量 + 变动后库存(由后端最终计算，此处实时预览) -->
    <div class="io-preview">
      换算基准数量：<b>{{ baseQty.toFixed(2) }}</b> {{ material.unit }}
      ｜ 变动后库存：<b :class="{ 'text-danger': afterQty < 0 }">{{ afterQty.toFixed(2) }}</b>
      {{ material.unit }}
    </div>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { queryById, manualInOut } from '../Goods.api';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  // 当前物料(含单位子表 unitList)
  const material = ref<Recordable>({});
  // 表单数据
  const form = ref<Recordable>({ ioType: 'IN', unitId: undefined, unitQty: undefined, unitPrice: undefined, remark: undefined });
  // 单位下拉(来自物料 unitList，基准单位排第一)
  const unitSelectOptions = ref<any[]>([]);

  const title = computed(() => (form.value.ioType === 'IN' ? '手动入库' : '手动出库'));

  // 当前选中单位的换算系数(1当前单位 = conversionQty基准单位)
  const currentConversion = computed(() => {
    const u = (material.value.unitList || []).find((it: any) => String(it.id) === String(form.value.unitId));
    return u ? u.conversionQty || 1 : 1;
  });

  // 换算后的基准单位数量
  const baseQty = computed(() => {
    const q = Number(form.value.unitQty || 0);
    return q * currentConversion.value;
  });

  // 变动后库存(预览)
  const afterQty = computed(() => {
    const cur = Number(material.value.stockQty || 0);
    return form.value.ioType === 'IN' ? cur + baseQty.value : cur - baseQty.value;
  });

  const [register, { closeModal }] = useModalInner(async (data) => {
    // 打开时按 id 查询完整物料(含 unitList)，用于单位换算
    const detail = await queryById({ id: data.record.id });
    material.value = { ...data.record, ...detail };
    // 单位下拉：基准单位排第一
    const units = detail.unitList || [];
    unitSelectOptions.value = [...units]
      .sort((a: any, b: any) => Number(b.isBaseUnit) - Number(a.isBaseUnit))
      .map((u: any) => ({ label: u.unitName, value: u.id, conversionQty: u.conversionQty || 1 }));
    // 默认选基准单位，回填基准单价
    const baseUnit = units.find((u: any) => u.isBaseUnit);
    form.value = {
      ioType: 'IN',
      unitId: baseUnit?.id,
      unitQty: undefined,
      unitPrice: detail.unitPrice ?? 0,
      remark: undefined,
    };
  });

  /**
   * 提交：调用 手动入库/manualIn 或 手动出库/manualOut
   * 请求体对齐 StockIoRecord(后端计算 baseQty/qty/amount/beforeQty/afterQty 并更新库存)
   */
  async function handleSubmit() {
    if (!form.value.unitId) {
      createMessage.warning('请选择单位！');
      return;
    }
    if (!form.value.unitQty || form.value.unitQty <= 0) {
      createMessage.warning('请输入大于 0 的数量！');
      return;
    }
    if (afterQty.value < 0) {
      createMessage.warning('出库数量超过当前库存，无法出库！');
      return;
    }
    const ioType: 'IN' | 'OUT' = form.value.ioType;
    const unit = (material.value.unitList || []).find((u: any) => String(u.id) === String(form.value.unitId));
    await manualInOut(
      {
        materialId: material.value.id,
        unitId: form.value.unitId,
        unitName: unit?.unitName,
        unitQty: form.value.unitQty,
        unitPrice: form.value.unitPrice ?? 0,
        ioType,
        sourceType: 'manual',
        remark: form.value.remark,
      },
      ioType
    );
    closeModal();
    emit('success');
  }
</script>

<style lang="less" scoped>
  .io-desc {
    margin-bottom: 16px;
  }

  .io-form {
    margin-bottom: 8px;
  }

  .io-preview {
    padding: 8px 12px;
    background: #f5f5f5;
    border-radius: 4px;
    color: #666;
    font-size: 13px;

    .text-danger {
      color: #f5222d;
    }
  }

  :deep(.ant-input-number) {
    width: 100%;
  }
</style>
