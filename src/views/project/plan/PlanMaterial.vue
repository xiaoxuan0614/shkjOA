<template>
  <div class="plan-material">
    <!-- 顶部按钮 -->
    <div class="plan-material__toolbar">
      <a-button type="primary" preIcon="ant-design:plus-outlined" :disabled="!editable" @click="handleAddMaterial">添加用料</a-button>
      <a-button type="primary" preIcon="ant-design:import-outlined" :disabled="!editable" @click="handleImport">导入文件</a-button>
    </div>

    <!-- 用料明细表格 -->
    <a-table
      :columns="columns"
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
            :disabled="!editable"
            placeholder="请输入数量"
            style="width: 100%"
          />
        </template>
        <template v-else-if="column.key === 'unit'">
          <a-select
            v-model:value="record.unit"
            allowClear
            :disabled="!editable"
            placeholder="请选择单位"
            style="width: 100%"
            :options="unitOptions"
          />
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button v-if="editable" type="link" danger size="small" @click="handleRemove(record._key)">移除</a-button>
        </template>
      </template>
    </a-table>

    <!-- 添加用料抽屉 -->
    <MaterialSelectDrawer @register="registerDrawer" @success="handleDrawerSuccess" />
  </div>
</template>

<script lang="ts" setup>
  import { ref, unref } from 'vue';
  import { useDrawer } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import MaterialSelectDrawer from '/@/views/material/apply/components/MaterialSelectDrawer.vue';

  const { createMessage } = useMessage();

  // 属性: editable 控制是否可编辑
  defineProps<{
    editable?: boolean;
  }>();

  // 抽屉
  const [registerDrawer, { openDrawer }] = useDrawer();

  // 表格列
  const columns = [
    { title: '物料类别', dataIndex: 'categoryName', key: 'categoryName', width: 100 },
    { title: '物料名称', dataIndex: 'goodsName', key: 'goodsName', width: 150 },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 100 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 120 },
    { title: '*申请数量', key: 'useNum', width: 120 },
    { title: '*单位', key: 'unit', width: 100 },
    { title: '操作', key: 'action', width: 80, align: 'center', fixed: 'right' },
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

  // 自增key
  let detailKeySeed = 0;

  // 暴露给父级(行数组, 父级映射为 project_material_plan 实体)
  defineExpose({
    getData() {
      return unref(detailList);
    },
    setData(list: any[]) {
      detailList.value = list || [];
      detailKeySeed = 0;
      detailList.value.forEach((item) => {
        item._key = ++detailKeySeed;
      });
    },
  });

  /**
   * 添加物料: 打开抽屉
   */
  function handleAddMaterial() {
    openDrawer(true);
  }

  /**
   * 导入文件(Excel 物料清单, 暂无解析库, 先占位)
   */
  function handleImport() {
    createMessage.info('导入 Excel 物料清单功能待接入');
  }

  /**
   * 抽屉确定: 选中的物料回填为明细行
   */
  function handleDrawerSuccess(selected: any[]) {
    if (!selected || selected.length === 0) return;
    selected.forEach((m) => {
      if (detailList.value.some((d) => d.id === m.id)) {
        createMessage.warning(`「${m.materialName}」已在明细中`);
        return;
      }
      detailList.value.push({
        _key: ++detailKeySeed,
        id: m.id,
        categoryName: m.materialCategory,
        goodsName: m.materialName,
        brand: m.brand,
        model: m.model,
        stock: m.stockQty,
        useNum: 1,
        unit: m.unit,
      });
    });
  }

  /**
   * 移除明细行
   */
  function handleRemove(key: number) {
    detailList.value = detailList.value.filter((d) => d._key !== key);
  }
</script>

<style lang="less" scoped>
  .plan-material {
    &__toolbar {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
  }
</style>
