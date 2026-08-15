<template>
  <BasicModal
    v-bind="$attrs"
    @register="register"
    destroyOnClose
    :title="title"
    :width="800"
    @ok="handleSubmit"
  >
    <BasicForm @register="registerForm" />

    <!-- 单位信息(子表格)：绑定多个单位，第一个单位即基准单位(固定不可移动/删除)，副单位可上移/下移调整顺序 -->
    <div class="unit-section">
      <div class="unit-section__title">
        <span>单位信息</span>
        <a-button type="link" size="small" :disabled="readOnly" @click="addUnit">+ 添加单位</a-button>
      </div>
      <a-table
        :columns="unitColumns"
        :data-source="unitList"
        :pagination="false"
        :row-key="(r: any) => r.uid"
        size="small"
        bordered
      >
        <template #bodyCell="{ column, record, index }">
          <!-- 单位：下拉选择(后续可在字典里维护，换 JSelectDict 即可) -->
          <template v-if="column.key === 'unitName'">
            <a-select
              v-model:value="record.unitName"
              :options="unitOptions"
              :disabled="readOnly"
              placeholder="请选择单位"
              style="width: 100%"
            />
          </template>
          <!-- 换算系数：与基准单位的换算关系(1当前单位 = conversionQty基准单位)；第一行即基准单位，固定为 1 且不可改 -->
          <template v-else-if="column.key === 'conversionQty'">
            <a-input-number
              v-model:value="record.conversionQty"
              :disabled="readOnly || index === 0"
              :min="0"
              :max="999999"
              :precision="2"
              placeholder="与基准单位换算"
              style="width: 100%"
            />
          </template>
          <!-- 操作：上移/下移调整顺序(第一行即基准单位，禁止移动/删除)，删除 -->
          <template v-else-if="column.key === 'action'">
            <a-button
              type="link"
              size="small"
              :disabled="readOnly || index <= 1"
              @click="moveUnit(index, -1)"
            >上移</a-button>
            <a-button
              type="link"
              size="small"
              :disabled="readOnly || index === 0 || index === unitList.length - 1"
              @click="moveUnit(index, 1)"
            >下移</a-button>
            <a-button
              type="link"
              size="small"
              danger
              :disabled="readOnly || index === 0 || unitList.length <= 1"
              @click="removeUnit(index)"
            >删除</a-button>
          </template>
        </template>
      </a-table>
      <div class="unit-section__tip">
        第一个单位为基准单位，固定不可移动/删除；副单位可上移/下移调整顺序，并填写换算系数（1副单位 = 换算系数 × 基准单位）。
      </div>
    </div>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed, unref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { formSchema, unitOptions } from '../Goods.data';
  import { saveOrUpdate } from '../Goods.api';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  const isUpdate = ref(false);
  const readOnly = ref(false); // 详情模式：整表只读
  const title = computed(() => {
    // 详情(showFooter=false)只读查看；否则新增/编辑
    if (unref(readOnly)) return '物料详情';
    return unref(isUpdate) ? '编辑物料' : '新增物料';
  });

  // 单位子表数据（对齐 StockMaterialUnit: unitName/isBaseUnit/conversionQty/sortNo/materialId）
  const unitList = ref<any[]>([]);
  let uidSeq = 0; // 行内唯一 uid(行 key)

  // 单位子表列定义(第一行即基准单位，固定不可移动/删除，不再单选)
  const unitColumns = [
    { title: '序号', key: 'seq', width: 60, align: 'center', customRender: ({ index }: any) => index + 1 },
    { title: '单位', key: 'unitName', width: 150 },
    { title: '换算系数', key: 'conversionQty', width: 170 },
    { title: '操作', key: 'action', width: 170, align: 'center' },
  ];

  // 表单配置
  const [registerForm, { setProps, resetFields, setFieldsValue, validate, updateSchema }] = useForm({
    labelWidth: 100,
    showActionButtonGroup: false,
    baseColProps: { span: 12 },
    schemas: formSchema,
  });

  const [register, { setModalProps, closeModal }] = useModalInner(async (data) => {
    await resetFields();
    isUpdate.value = !!data?.isUpdate;
    readOnly.value = !data?.showFooter; // showFooter=false 即详情只读
    setModalProps({
      showOkBtn: !!data?.showFooter,
      showCancelBtn: !!data?.showFooter,
      confirmLoading: false,
    });
    setProps({ disabled: readOnly.value });

    // 编辑时：库存数量统一走「出入库」，这里禁用不允许直接改
    // 编号显示规则：新增隐藏，编辑/详情显示(只读)
    updateSchema([
      { field: 'stockQty', componentProps: { disabled: isUpdate.value } },
      { field: 'materialCode', ifShow: () => !!isUpdate.value },
    ]);

    if (isUpdate.value) {
      // 编辑回显(unitList 契约：第一个为基准单位)
      await setFieldsValue({ ...data.record });
      unitList.value = (data.record.unitList || []).map((u: any) => ({
        uid: ++uidSeq,
        materialId: u.materialId,
        unitName: u.unitName,
        isBaseUnit: !!u.isBaseUnit,
        conversionQty: u.conversionQty ?? 1,
      }));
    } else {
      // 新增：物料编码由后端生成(前端不预填，新增后自动带出)；默认给一行基准单位
      await setFieldsValue({ stockQty: 0 });
      unitList.value = [{ uid: ++uidSeq, materialId: undefined, unitName: undefined, conversionQty: 1, isBaseUnit: true }];
    }
  });

  /** 添加单位行 */
  function addUnit() {
    unitList.value.push({
      uid: ++uidSeq,
      materialId: undefined,
      unitName: undefined,
      conversionQty: undefined,
      isBaseUnit: false,
    });
  }

  /** 删除单位行(至少保留一行；基准单位第一行固定不可删除) */
  function removeUnit(index: number) {
    if (index === 0) return; // 基准单位不可删除
    unitList.value.splice(index, 1);
  }

  /** 上移/下移调整顺序：第一行(基准单位)固定不参与换位；仅第 2 行起的副单位在 1..length-1 区间内交换 */
  function moveUnit(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (index < 1 || target < 1 || target >= unitList.value.length) return;
    const arr = unitList.value;
    [arr[index], arr[target]] = [arr[target], arr[index]];
  }

  /**
   * 单位子表校验(保存强制校验，关键逻辑)：
   * 1. 至少添加一行单位
   * 2. 每行必须选择单位名称
   * 3. 第一行即基准单位(换算系数固定 1)；其余副单位换算系数必须大于 0
   */
  function validateUnits(): boolean {
    if (!unitList.value.length) {
      createMessage.warning('请至少添加一个单位！');
      return false;
    }
    for (let i = 0; i < unitList.value.length; i++) {
      const u = unitList.value[i];
      if (!u.unitName) {
        createMessage.warning('请完善每个单位的单位名称！');
        return false;
      }
      if (i === 0) {
        u.isBaseUnit = true;
        u.conversionQty = 1; // 第一行即基准单位，换算系数固定为 1
      } else {
        u.isBaseUnit = false;
        if (!u.conversionQty || u.conversionQty <= 0) {
          createMessage.warning(`单位「${u.unitName}」请填写大于 0 的换算系数！`);
          return false;
        }
      }
    }
    return true;
  }

  /** 提交：第一行即基准单位，按当前行序组装(含 sortNo)一并保存 */
  async function handleSubmit() {
    try {
      const values = await validate();
      if (!validateUnits()) return;
      const baseUnit = unitList.value[0];
      const unitListPayload = unitList.value.map((u, i) => ({
        materialId: u.materialId,
        unitName: u.unitName,
        isBaseUnit: i === 0 ? 1 : 0,
        conversionQty: i === 0 ? 1 : u.conversionQty,
        sortNo: i + 1,
      }));
      await saveOrUpdate(
        {
          ...values,
          // 物料编码后端生成：为空则不传
          materialCode: values.materialCode || undefined,
          unit: baseUnit?.unitName, // 主表基准单位冗余字段(第一个单位)
          unitList: unitListPayload,
        },
        isUpdate.value
      );
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
  .unit-section {
    margin-top: 12px;

    &__title {
      font-weight: 600;
      font-size: 15px;
      color: #333;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    &__tip {
      color: #999;
      font-size: 12px;
      margin-top: 8px;
    }
  }

  :deep(.ant-input-number) {
    width: 100%;
  }
</style>
