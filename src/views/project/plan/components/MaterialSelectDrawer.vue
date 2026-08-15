<template>
  <BasicDrawer
    v-bind="$attrs"
    @register="register"
    title="添加用料"
    :width="900"
    showFooter
    @visible-change="handleVisibleChange"
    @ok="handleOk"
  >
    <div class="plan-material-select">
      <!-- 左侧：物料大类树 -->
      <div class="plan-material-select__tree">
        <div class="plan-material-select__tree-title">物料分类</div>
        <a-tree
          :tree-data="treeData"
          :selected-keys="selectedKeys"
          :field-names="{ title: 'title', key: 'key', children: 'children' }"
          :default-expand-all="true"
          @select="handleTreeSelect"
        />
      </div>
      <!-- 右侧：搜索 + 表格 -->
      <div class="plan-material-select__body">
        <div class="plan-material-select__search">
          <a-input v-model:value="queryParam.materialName" allowClear placeholder="名称" style="width: 150px" />
          <a-input v-model:value="queryParam.model" allowClear placeholder="型号" style="width: 150px" />
          <a-select
            v-model:value="queryParam.brand"
            allowClear
            placeholder="品牌"
            style="width: 150px"
            :options="brandOptions"
          />
          <a-button type="primary" @click="handleSearch">筛选</a-button>
          <a-button @click="handleReset">重置</a-button>
        </div>
        <a-table
          :columns="columns"
          :data-source="tableData"
          :pagination="pagination"
          :row-key="(record) => record.id"
          :row-class-name="getRowClassName"
          :loading="loading"
          size="small"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-button
                v-if="!isSelected(record)"
                type="link"
                size="small"
                @click="handleSelect(record)"
              >
                选择
              </a-button>
              <a-button v-else type="link" size="small" danger @click="handleUnselect(record)">
                取消选择
              </a-button>
            </template>
          </template>
        </a-table>
        <!-- 已选物料 -->
        <div v-if="selectedList.length > 0" class="plan-material-select__selected">
          <span class="plan-material-select__selected-label">已选物料：</span>
          <a-tag v-for="item in selectedList" :key="item.id" closable @close="removeSelected(item)">
            {{ item.materialName }}
          </a-tag>
        </div>
      </div>
    </div>
  </BasicDrawer>
</template>

<script lang="ts" setup>
  import { ref, reactive, unref } from 'vue';
  import { BasicDrawer, useDrawerInner } from '/@/components/Drawer';
  import { selectMaterialList } from '/@/views/material/apply/MaterialApply.api';
  import { initDictOptions } from '/@/utils/dict/index';

  // Emits声明
  const emit = defineEmits(['register', 'success']);

  // 已选物料(回传给计划页)
  const selectedList = ref<any[]>([]);

  const [register, { closeDrawer }] = useDrawerInner();

  // 抽屉打开时重置
  function handleVisibleChange(visible: boolean) {
    if (visible) {
      selectedList.value = [];
      handleReset();
    }
  }

  // 表格列(对齐 /stock/material/list 契约)
  const columns = [
    { title: '名称', dataIndex: 'materialName', key: 'materialName' },
    { title: '品牌', dataIndex: 'brand', key: 'brand' },
    { title: '型号', dataIndex: 'model', key: 'model' },
    { title: '总库存', dataIndex: 'stockQty', key: 'stockQty' },
    { title: '操作', key: 'action', width: 100, align: 'center' },
  ];

  // 搜索参数(对齐 /stock/material/list 过滤字段)
  const queryParam = reactive<any>({
    materialName: '',
    model: '',
    brand: undefined,
    materialCategory: undefined,
  });

  const tableData = ref<any[]>([]);
  const loading = ref(false);
  const brandOptions = ref<any[]>([]);

  // 分页(服务端分页)
  const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
    showTotal: (total: number) => `共 ${total} 条`,
  });

  // 大类树
  const treeData = ref<any[]>([]);
  const selectedKeys = ref<any[]>([]);

  // 加载树(物料类别走后端数据字典 material_category)
  async function loadTree() {
    const items: any[] = (await initDictOptions('material_category')) || [];
    treeData.value = items.map((c: any) => ({ title: c.text, key: c.value, categoryCode: c.value }));
  }

  // 加载列表
  async function loadData() {
    loading.value = true;
    try {
      const params = {
        pageNo: pagination.current,
        pageSize: pagination.pageSize,
        ...queryParam,
      };
      const res = await selectMaterialList(params);
      tableData.value = res?.records || [];
      pagination.current = params.pageNo;
      pagination.pageSize = params.pageSize;
      pagination.total = res?.total ?? 0;
      collectBrands(tableData.value);
    } finally {
      loading.value = false;
    }
  }

  // 品牌下拉去重
  function collectBrands(list: any[]) {
    const brands = new Set<string>();
    (list || []).forEach((m) => {
      if (m.brand) brands.add(m.brand);
    });
    brandOptions.value = Array.from(brands).map((b) => ({ label: b, value: b }));
  }

  // 树选中
  function handleTreeSelect(keys: any[]) {
    selectedKeys.value = keys;
    const node = findNode(treeData.value, keys[0]);
    queryParam.materialCategory = node?.categoryCode || keys[0];
    loadData();
  }

  // 递归找树节点
  function findNode(nodes: any[], key: any): any {
    for (const n of nodes || []) {
      if (n.key === key) return n;
      if (n.children?.length) {
        const res = findNode(n.children, key);
        if (res) return res;
      }
    }
    return null;
  }

  // 筛选
  function handleSearch() {
    pagination.current = 1;
    loadData();
  }

  // 重置
  function handleReset() {
    queryParam.materialName = '';
    queryParam.model = '';
    queryParam.brand = undefined;
    queryParam.materialCategory = undefined;
    selectedKeys.value = [];
    pagination.current = 1;
    loadData();
  }

  // 分页变化
  function handleTableChange(pg: any) {
    pagination.current = pg.current;
    pagination.pageSize = pg.pageSize;
    loadData();
  }

  // 是否已选
  function isSelected(record: any) {
    return selectedList.value.some((s) => s.id === record.id);
  }

  // 选择
  function handleSelect(record: any) {
    selectedList.value.push(record);
  }

  // 取消选择
  function handleUnselect(record: any) {
    selectedList.value = selectedList.value.filter((s) => s.id !== record.id);
  }

  // 已选标签删除
  function removeSelected(record: any) {
    selectedList.value = selectedList.value.filter((s) => s.id !== record.id);
  }

  // 行高亮
  function getRowClassName(record: any) {
    return isSelected(record) ? 'plan-material-select__row-selected' : '';
  }

  // 确定: 回传已选物料
  function handleOk() {
    emit('success', unref(selectedList));
    closeDrawer();
  }

  loadTree();
  loadData();
</script>

<style lang="less" scoped>
  .plan-material-select {
    display: flex;
    height: 100%;
    gap: 12px;

    &__tree {
      width: 200px;
      flex-shrink: 0;
      border: 1px solid #f0f0f0;
      border-radius: 4px;
      padding: 8px;
      overflow: auto;

      &-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: #333;
      }
    }

    &__body {
      flex: 1;
      min-width: 0;
    }

    &__search {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    &__selected {
      margin-top: 12px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;

      &-label {
        color: #666;
      }
    }

    :deep(.plan-material-select__row-selected) {
      td {
        background-color: #fffbe6 !important;
      }
    }
  }
</style>
