<template>
  <div class="material-apply">
    <!-- 申请信息 -->
    <div class="material-apply__card">
      <div class="material-apply__card-title">申请信息</div>
      <BasicForm @register="registerForm" />
    </div>

    <!-- 物料明细 -->
    <div class="material-apply__card">
      <div class="material-apply__card-title">
        <span>物料明细</span>
        <a-button type="primary" preIcon="ant-design:plus-outlined" @click="handleAddMaterial">
          添加物料
        </a-button>
      </div>
      <a-table
        :columns="detailColumns"
        :data-source="detailList"
        :row-key="(record) => record._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'useNum'">
            <a-input-number
              v-model:value="record.useNum"
              :min="1"
              :max="record.stock ?? 99999"
              placeholder="请输入使用数量"
              style="width: 100%"
            />
          </template>
          <template v-else-if="column.key === 'unit'">
            <a-select
              v-model:value="record.unit"
              allowClear
              placeholder="请选择单位"
              style="width: 100%"
              :options="unitOptions"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" danger size="small" @click="handleRemoveDetail(record._key)">
              移除
            </a-button>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 底部操作 -->
    <div class="material-apply__footer">
      <a-button type="primary" preIcon="ant-design:save-outlined" @click="handleSave">保存</a-button>
      <a-button type="primary" preIcon="ant-design:send-outlined" @click="handleSubmit">发起申请</a-button>
      <a-button @click="handleCancel">取消</a-button>
    </div>

    <!-- 添加用料抽屉 -->
    <MaterialSelectDrawer @register="registerDrawer" @success="handleDrawerSuccess" />
  </div>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useDrawer } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { applyFormSchema } from './MaterialApply.data';
  import { saveApply, submitApply } from './MaterialApply.api';
  import MaterialSelectDrawer from './components/MaterialSelectDrawer.vue';

  const router = useRouter();
  const { createMessage } = useMessage();

  // 注册表单
  const [registerForm, { getFieldsValue, resetFields, validate }] = useForm({
    labelWidth: 100,
    schemas: applyFormSchema,
    showActionButtonGroup: false,
    baseColProps: { span: 8 },
  });

  // 注册抽屉
  const [registerDrawer, { openDrawer }] = useDrawer();

  // 明细表格列
  const detailColumns = [
    { title: '物料类别', dataIndex: 'categoryName', key: 'categoryName', width: 110 },
    { title: '物料名称', dataIndex: 'goodsName', key: 'goodsName', width: 160 },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 120 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 160 },
    { title: '库存', dataIndex: 'stock', key: 'stock', width: 90 },
    { title: '*使用数量', key: 'useNum', width: 140 },
    { title: '*单位', key: 'unit', width: 120 },
    { title: '操作', key: 'action', width: 90, align: 'center', fixed: 'right' },
  ];

  // 明细数据(本地数组)
  const detailList = ref<any[]>([]);

  // 单位下拉
  const unitOptions = [
    { label: '台', value: '台' },
    { label: '个', value: '个' },
    { label: '米', value: '米' },
    { label: '根', value: '根' },
    { label: '套', value: '套' },
    { label: '条', value: '条' },
    { label: '件', value: '件' },
  ];

  // 自增key, 用于唯一标识明细行
  let detailKeySeed = 0;

  /**
   * 添加物料: 打开抽屉
   */
  function handleAddMaterial() {
    openDrawer(true);
  }

  /**
   * 抽屉确定: 选中的物料回填为明细行
   * @param selected 抽屉选中的物料列表
   */
  function handleDrawerSuccess(selected: any[]) {
    if (!selected || selected.length === 0) {
      createMessage.warning('请选择物料');
      return;
    }
    selected.forEach((m) => {
      // 已存在同物料则提示跳过
      if (detailList.value.some((d) => d.id === m.id)) {
        createMessage.warning(`「${m.goodsName}」已在明细中`);
        return;
      }
      detailList.value.push({
        _key: ++detailKeySeed,
        id: m.id,
        categoryName: m.categoryName, // 物料类别 <- 大类
        goodsName: m.goodsName, // 物料名称 <- 商品名称
        brand: m.brand,
        model: m.model, // 型号 <- 规格型号
        stock: m.stock, // 库存
        useNum: 1,
        unit: m.mainUnit, // 单位 <- 主计量单位
      });
    });
  }

  /**
   * 移除明细行
   */
  function handleRemoveDetail(key: number) {
    detailList.value = detailList.value.filter((d) => d._key !== key);
  }

  /**
   * 校验并组装提交数据
   */
  async function buildSubmitData() {
    await validate();
    const formValues = getFieldsValue();
    if (detailList.value.length === 0) {
      createMessage.warning('请添加物料明细');
      return null;
    }
    // 校验明细必填
    const invalid = detailList.value.find((d) => !d.useNum || !d.unit);
    if (invalid) {
      createMessage.warning('请填写完整的使用数量和单位');
      return null;
    }
    return {
      ...formValues,
      detailList: detailList.value,
    };
  }

  /**
   * 保存
   */
  async function handleSave() {
    const data = await buildSubmitData();
    if (!data) return;
    await saveApply(data);
    createMessage.success('保存成功');
    router.push('/material/list');
  }

  /**
   * 发起申请
   */
  async function handleSubmit() {
    const data = await buildSubmitData();
    if (!data) return;
    await submitApply(data);
    createMessage.success('发起申请成功');
    // 清空表单和明细
    await resetFields();
    detailList.value = [];
  }

  /**
   * 取消: 返回列表
   */
  function handleCancel() {
    router.push('/material/list');
  }
</script>

<style lang="less" scoped>
  .material-apply {
    padding: 16px;

    &__card {
      background: #fff;
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 16px;

      &-title {
        font-weight: 600;
        font-size: 15px;
        color: #333;
        margin-bottom: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    }

    &__footer {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 8px 0 24px;
    }
  }
</style>
