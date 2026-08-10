<template>
  <div class="plan-material">
    <!-- 顶部按钮 -->
    <div class="plan-material__toolbar">
      <a-button type="primary" preIcon="ant-design:plus-outlined" @click="handleAddMaterial">
        添加用料
      </a-button>
      <a-button type="primary" preIcon="ant-design:import-outlined" @click="handleImport">导入文件</a-button>
      <a-button
        type="primary"
        :disabled="selectedRowKeys.length === 0"
        @click="handleBatchStart"
      >
        开始采购
      </a-button>
      <a-button
        type="primary"
        :disabled="selectedRowKeys.length === 0"
        @click="handleBatchComplete"
      >
        采购完成
      </a-button>
    </div>

    <!-- 采购信息表格 -->
    <a-table
      :columns="columns"
      :data-source="detailList"
      :row-key="(record) => record._key"
      :pagination="false"
      :row-selection="{ selectedRowKeys, onChange: onRowSelectChange }"
      size="middle"
      bordered
    >
      <template #bodyCell="{ column, record }">
        <!-- 采购状态 -->
        <template v-if="column.key === 'status'">
          <a-tag :color="getStatusColor(record.status)">{{ getStatusText(record.status) }}</a-tag>
        </template>
        <!-- 申请数量 -->
        <template v-else-if="column.key === 'useNum'">
          <a-input-number
            v-model:value="record.useNum"
            :min="1"
            :max="record.stock ?? 99999"
            :disabled="record.status === 'done' || !editable"
            placeholder="请输入数量"
            style="width: 100%"
          />
        </template>
        <!-- 单位 -->
        <template v-else-if="column.key === 'unit'">
          <a-select
            v-model:value="record.unit"
            allowClear
            :disabled="record.status === 'done' || !editable"
            placeholder="请选择单位"
            style="width: 100%"
            :options="unitOptions"
          />
        </template>
        <!-- 快递单号(选填) -->
        <template v-else-if="column.key === 'expressNo'">
          <a-input
            v-model:value="record.expressNo"
            :disabled="record.status === 'done' || !editable"
            placeholder="选填"
          />
        </template>
        <!-- 操作 -->
        <template v-else-if="column.key === 'action'">
          <!-- 待采购: 开始采购 + 移除 -->
          <template v-if="record.status === 'pending'">
            <a-button type="link" size="small" @click="handleStart(record)">开始采购</a-button>
            <a-button type="link" danger size="small" @click="handleRemove(record._key)">移除</a-button>
          </template>
          <!-- 采购中: 采购完成 -->
          <template v-else-if="record.status === 'buying'">
            <a-button type="link" size="small" @click="handleComplete(record)">采购完成</a-button>
          </template>
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
  import MaterialSelectDrawer from './components/MaterialSelectDrawer.vue';

  const { createMessage } = useMessage();

  // 属性: editable 控制是否可编辑
  const props = defineProps<{
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
    { title: '采购状态', key: 'status', width: 90 },
    { title: '*申请数量', key: 'useNum', width: 120 },
    { title: '*单位', key: 'unit', width: 100 },
    { title: '快递单号', key: 'expressNo', width: 120 },
    { title: '操作', key: 'action', width: 150, align: 'center', fixed: 'right' },
  ];

  // 明细数据(本地数组)
  const detailList = ref<any[]>([]);

  // 选中行(用于全局按钮)
  const selectedRowKeys = ref<(string | number)[]>([]);

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

  // 采购状态枚举
  const STATUS = {
    pending: 'pending', // 待采购
    buying: 'buying', // 采购中
    done: 'done', // 已完成
  };

  // 暴露给父级
  defineExpose({
    getData() {
      return unref(detailList);
    },
    setData(list: any[]) {
      detailList.value = list || [];
      // 重新分配_key
      detailKeySeed = 0;
      detailList.value.forEach((item) => {
        item._key = ++detailKeySeed;
        item.status = item.status || STATUS.pending;
      });
    },
  });

  /**
   * 添加物料: 打开抽屉
   */
  function handleAddMaterial() {
    if (!props.editable) {
      createMessage.warning('当前无编辑权限');
      return;
    }
    openDrawer(true);
  }

  /**
   * 导入文件(占位)
   */
  function handleImport() {
    createMessage.info('导入文件功能待接入');
  }

  /**
   * 抽屉确定: 选中的物料回填为明细行(待采购)
   */
  function handleDrawerSuccess(selected: any[]) {
    if (!selected || selected.length === 0) return;
    selected.forEach((m) => {
      if (detailList.value.some((d) => d.id === m.id && d.status !== STATUS.done)) {
        createMessage.warning(`「${m.goodsName}」已在明细中`);
        return;
      }
      detailList.value.push({
        _key: ++detailKeySeed,
        id: m.id,
        categoryName: m.categoryName,
        goodsName: m.goodsName,
        brand: m.brand,
        model: m.model,
        stock: m.stock,
        status: STATUS.pending,
        useNum: 1,
        unit: m.mainUnit,
        expressNo: '',
      });
    });
  }

  /**
   * 行内开始采购
   */
  function handleStart(record: any) {
    record.status = STATUS.buying;
  }

  /**
   * 行内采购完成
   */
  function handleComplete(record: any) {
    record.status = STATUS.done;
  }

  /**
   * 移除明细行(仅待采购)
   */
  function handleRemove(key: number) {
    detailList.value = detailList.value.filter((d) => d._key !== key);
  }

  /**
   * 勾选变化
   */
  function onRowSelectChange(keys: any[]) {
    selectedRowKeys.value = keys;
  }

  /**
   * 全局开始采购: 选中的待采购行 -> 采购中
   */
  function handleBatchStart() {
    detailList.value.forEach((d) => {
      if (selectedRowKeys.value.includes(d._key) && d.status === STATUS.pending) {
        d.status = STATUS.buying;
      }
    });
    selectedRowKeys.value = [];
  }

  /**
   * 全局采购完成: 选中的采购中行 -> 已完成
   */
  function handleBatchComplete() {
    detailList.value.forEach((d) => {
      if (selectedRowKeys.value.includes(d._key) && d.status === STATUS.buying) {
        d.status = STATUS.done;
      }
    });
    selectedRowKeys.value = [];
  }

  /**
   * 状态文本
   */
  function getStatusText(status: string): string {
    const map = { pending: '待采购', buying: '采购中', done: '已完成' };
    return map[status] || status;
  }

  /**
   * 状态颜色
   */
  function getStatusColor(status: string): string {
    const map = { pending: 'default', buying: 'blue', done: 'green' };
    return map[status] || 'default';
  }
</script>

<style lang="less" scoped>
  .plan-material {
    &__toolbar {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
  }
</style>
