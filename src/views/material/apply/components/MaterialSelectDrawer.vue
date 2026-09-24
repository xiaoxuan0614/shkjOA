<template>
  <BasicDrawer v-bind="$attrs" @register="register" :title="drawerTitle" :width="quotationLayout ? 'min(1440px, 96vw)' : 900" showFooter @visible-change="handleVisibleChange" @ok="handleOk">
    <div class="material-select">
      <!-- 左侧：物料大类树 -->
      <div v-if="!isProjectMode && !laborOnly" class="material-select__tree">
        <div class="material-select__tree-title">物料分类</div>
        <a-tree
          :tree-data="treeData"
          :selected-keys="selectedKeys"
          :field-names="{ title: 'title', key: 'key', children: 'children' }"
          :default-expand-all="true"
          @select="handleTreeSelect"
        />
      </div>
      <!-- 右侧：搜索 + 表格 -->
      <div class="material-select__body">
        <div class="material-select__search">
          <a-input
            v-if="isProjectMode"
            v-model:value="queryParam.keyword"
            allowClear
            placeholder="输入物料编码、名称、品牌或型号"
            style="width: 280px"
            @press-enter="handleSearch"
          />
          <template v-else>
            <a-input v-model:value="queryParam.materialName" allowClear placeholder="名称" style="width: 160px" />
            <a-input v-model:value="queryParam.model" allowClear placeholder="型号" style="width: 160px" />
            <a-select
              v-model:value="queryParam.brand"
              allowClear
              showSearch
              placeholder="品牌(输入后模糊搜索)"
              style="width: 160px"
              :options="brandOptions"
              :filter-option="false"
              @search="onBrandSearch"
            />
          </template>
          <a-button type="primary" @click="handleSearch">筛选</a-button>
          <a-button @click="handleReset">重置</a-button>
          <a-button v-if="isProjectMode && !showSelectAll" :disabled="loading || selectableMaterials.length === 0" @click="handleToggleSelectAll">
            {{ allPageMaterialsSelected ? '取消本页全选' : `全选本页（${selectableMaterials.length}）` }}
          </a-button>
          <a-button v-if="!isProjectMode && !laborOnly" type="primary" class="material-select__add-btn" @click="handleAddMaterial">
            <Icon icon="ant-design:plus-outlined" />
            新增物料
          </a-button>
        </div>
        <a-table
          :columns="columns"
          :data-source="tableData"
          :pagination="showSelectAll ? false : pagination"
          :row-key="(record) => record.id"
          :row-class-name="getRowClassName"
          :loading="loading"
          :scroll="{ x: quotationLayout ? 900 : isProjectMode ? 1160 : 1110 }"
          size="small"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'material'">
              <div class="material-select__identity">
                <a-button type="link" class="material-select__name" style="padding: 0; text-align: left; white-space: normal; height: auto; overflow-wrap: anywhere" @click.stop="basicInfoRef?.open(record)">{{ record.materialName || '未命名物料' }}<template v-if="quotationLayout && record.brand">（{{ formatBrand(record.brand) }}）</template></a-button>
                <span v-if="!codeTooltip" class="material-select__code">{{ record.materialCode || '暂无编码' }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'brand'">
              {{ formatBrand(record.brand) }}
            </template>
            <template v-else-if="column.key === 'model' && quotationLayout">
              <a-tooltip :title="record.model || undefined">
                <span class="material-select__model-clamp" :tabindex="record.model ? 0 : undefined">{{ record.model || '—' }}</span>
              </a-tooltip>
            </template>
            <template v-else-if="column.key === 'availableApplyQty'">
              <span class="material-select__available"> {{ record.availableApplyQty }}{{ record.baseUnitName || '' }} </span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button v-if="excludedMaterialIds.has(String(record.id))" type="link" size="small" disabled>
                {{ showSelectedMaterials ? '已选择' : '已添加' }}
              </a-button>
              <a-button
                v-else-if="!isSelected(record)"
                type="link"
                size="small"
                :disabled="isProjectMode && !record.availableApplyQty"
                @click="handleSelect(record)"
              >
                {{ isProjectMode && !record.availableApplyQty ? '暂无可申请量' : '选择' }}
              </a-button>
              <a-button v-else type="link" size="small" danger @click="handleUnselect(record)">取消选择</a-button>
            </template>
          </template>
        </a-table>
        <div v-if="showSelectAll" class="material-select__pagination">
          <a-button :disabled="loading || selectableMaterials.length === 0" @click="handleToggleSelectAll">
            {{ allPageMaterialsSelected ? '取消本页全选' : `全选本页（${selectableMaterials.length}）` }}
          </a-button>
          <a-pagination v-bind="pagination" :disabled="loading" @change="(current, pageSize) => handleTableChange({ current, pageSize })" />
        </div>
        <!-- 已选物料 -->
        <div v-if="selectedList.length > 0" class="material-select__selected">
          <span class="material-select__selected-label">已选物料：</span>
          <a-tag v-for="item in selectedList" :key="item.id" closable @close="removeSelected(item)">
            <span v-if="codeTooltip">{{ item.materialName }}</span>
            <template v-else>{{ item.materialName }}{{ item.materialCode ? ` · ${item.materialCode}` : '' }}</template>
          </a-tag>
        </div>
      </div>
    </div>
    <!-- 新增物料弹窗 -->
    <MaterialAddModal @register="registerAddModal" @success="handleAddMaterialSuccess" />
    <MaterialBasicInfoModal ref="basicInfoRef" />
  </BasicDrawer>
</template>

<script lang="ts" setup>
  import { computed, ref, reactive, unref } from 'vue';
  import { BasicDrawer, useDrawerInner } from '/@/components/Drawer';
  import { useModal } from '/@/components/Modal';
  import MaterialAddModal from '/@/views/material/components/MaterialAddModal.vue';
  import MaterialBasicInfoModal from '../../components/MaterialBasicInfoModal.vue';
  import { selectMaterialList, selectProjectMaterialAccountPage, addMaterial } from '../MaterialApply.api';
  import { initDictOptions } from '/@/utils/dict/index';
  import { invalidateMaterialMap, loadDictMap } from '../../material.util';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { renderMaterialSpecification } from '../../materialSpecification';

  // Emits声明
  const emit = defineEmits(['register', 'success']);
  const { createMessage } = useMessage();
  const basicInfoRef = ref<InstanceType<typeof MaterialBasicInfoModal>>();
  const props = withDefaults(
    defineProps<{
      sourceMode?: 'all' | 'project';
      laborOnly?: boolean;
      periodId?: string;
      /** 保留已加入明细的物料行，显示已选择并禁止重复添加。 */
      showSelectedMaterials?: boolean;
      showSelectAll?: boolean;
      codeTooltip?: boolean;
      quotationLayout?: boolean;
    }>(),
    { sourceMode: 'all', periodId: '', showSelectedMaterials: false, showSelectAll: false, codeTooltip: false }
  );
  const isProjectMode = computed(() => props.sourceMode === 'project');
  const laborCategory = ref<string>();
  const drawerTitle = computed(() => (isProjectMode.value ? '添加可申请物料' : '添加物料'));

  // 新增物料弹窗
  const [registerAddModal, { openModal: openAddModal }] = useModal();

  // 已选物料(回传给申请页)
  const selectedList = ref<any[]>([]);
  const excludedMaterialIds = ref<Set<string>>(new Set());
  const drawerVisible = ref(false);
  let loadSequence = 0;

  const [register, { closeDrawer }] = useDrawerInner((data) => {
    drawerVisible.value = true;
    excludedMaterialIds.value = new Set((data?.excludeMaterialIds || []).map((id: unknown) => String(id)).filter(Boolean));
    selectedList.value = [];
    resetQueryState();
    void initializeDrawer();
  });

  // useDrawerInner 负责每次真正打开时初始化；visible-change 只维护可见状态，避免重复请求。
  function handleVisibleChange(visible: boolean) {
    drawerVisible.value = visible;
    if (!visible) {
      loadSequence += 1;
      loading.value = false;
    }
  }

  async function initializeDrawer() {
    try {
      if (isProjectMode.value) await loadData();
      else await Promise.all([loadTree(), loadData()]);
    } catch (error: any) {
      if (drawerVisible.value) createMessage.error(error?.message || '物料选择数据加载失败，请重新打开后再试');
    }
  }

  // 项目领料读取物料总账，普通选料保持库存主数据列。
  const columns = computed(() => [
    { title: '物料', key: 'material', width: props.quotationLayout ? 340 : 240 },
    ...(props.quotationLayout ? [] : [
      { title: '类别', dataIndex: 'materialCategory', key: 'materialCategory', width: 110 },
      { title: '品牌', dataIndex: 'brand', key: 'brand', width: 120 },
    ]),
    { title: '型号', dataIndex: 'model', key: 'model', width: 140 },
    { title: '参数', dataIndex: 'specificationParams', key: 'specificationParams', width: 180,
      customRender: ({ text }) => renderMaterialSpecification(text) },
    ...(isProjectMode.value
      ? [{ title: '当前可申请数量', dataIndex: 'availableApplyQty', key: 'availableApplyQty', width: 150 }]
      : [{ title: '总库存', dataIndex: 'stockQty', key: 'stockQty', width: 100 }]),
    { title: '操作', key: 'action', width: 120, align: 'center' },
  ]);

  // 搜索参数
  const queryParam = reactive<any>({
    keyword: '',
    materialName: '',
    model: '',
    brand: undefined,
    materialCategory: undefined,
  });

  const tableData = ref<any[]>([]);
  const loading = ref(false);
  const brandOptions = ref<any[]>([]); // 展示用(输入后过滤)
  const brandAll = ref<any[]>([]); // 全量池(只读过滤用，来源: 当前列表数据去重)
  const brandMap = ref<Record<string, { text: string; color: string }>>({});
  let brandMapLoaded = false;
  let brandMapRequest: Promise<void> | null = null;

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

  // 大类树：从后端数据字典 material_category 构建（后台「系统管理→数据字典」配置，重新登录生效）
  // 顶部加「全部」节点，默认选中即展示全部物料
  async function loadTree() {
    const items: any[] = (await initDictOptions('material_category')) || [];
    const children = items.map((c) => ({ title: c.text, key: c.value, categoryCode: c.value }));
    treeData.value = [{ title: '全部', key: 'all', categoryCode: undefined }, ...children];
  }

  // 全选仅作用于当前页未加入明细的记录；项目领料额外校验可申请量。
  const selectableMaterials = computed(() =>
    tableData.value.filter((item) => !excludedMaterialIds.value.has(String(item.id)) && (!isProjectMode.value || Number(item.availableApplyQty) > 0))
  );
  const allPageMaterialsSelected = computed(
    () =>
      selectableMaterials.value.length > 0 &&
      selectableMaterials.value.every((item) => selectedList.value.some((selected) => String(selected.id) === String(item.id)))
  );

  // 加载列表
  function normalizePageNumber(value: unknown, fallback: number): number {
    const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
    return Number.isSafeInteger(number) && number > 0 ? number : fallback;
  }

  async function loadData() {
    if (!drawerVisible.value) return;
    pagination.current = normalizePageNumber(pagination.current, 1);
    pagination.pageSize = normalizePageNumber(pagination.pageSize, 10);
    const requestSequence = ++loadSequence;
    const sourceMode = props.sourceMode;
    const periodId = props.periodId;
    loading.value = true;
    try {
      if (sourceMode === 'project') {
        if (!periodId) throw new Error('请先选择分期项目');
        const params = {
          periodId,
          pageNo: pagination.current,
          pageSize: pagination.pageSize,
          ...(String(queryParam.keyword || '').trim() ? { keyword: String(queryParam.keyword).trim() } : {}),
        };
        const [, res]: any[] = await Promise.all([ensureBrandMap(), selectProjectMaterialAccountPage(params)]);
        if (requestSequence !== loadSequence || !drawerVisible.value) return;
        const records = Array.isArray(res) ? res : res?.records || [];
        tableData.value = records.filter((item: any) => item.materialId).map(normalizeProjectMaterialAccount);
        pagination.current = params.pageNo;
        pagination.pageSize = params.pageSize;
        pagination.total = Array.isArray(res) ? records.length : Number(res?.total) || 0;
        collectBrands(tableData.value);
        return;
      }
      if (props.laborOnly && !laborCategory.value) {
        const categories = (await initDictOptions('material_category')) || [];
        const matches = categories.filter((item) => String(item.text).trim() === '劳保用品');
        if (matches.length !== 1) throw new Error('请在物料类别字典中确认唯一的“劳保用品”类别');
        laborCategory.value = String(matches[0].value);
      }
      const params = {
        pageNo: pagination.current,
        pageSize: pagination.pageSize,
        materialName: queryParam.materialName,
        model: queryParam.model,
        brand: queryParam.brand,
        materialCategory: props.laborOnly ? laborCategory.value : queryParam.materialCategory,
      };
      const [, res] = await Promise.all([ensureBrandMap(), selectMaterialList(params)]);
      if (requestSequence !== loadSequence || !drawerVisible.value) return;
      tableData.value = (res?.records || []).filter(
        (item: any) =>
          (!props.laborOnly || String(item.materialCategory) === laborCategory.value) &&
          (props.showSelectedMaterials || !excludedMaterialIds.value.has(String(item.id)))
      );
      pagination.current = params.pageNo;
      pagination.pageSize = params.pageSize;
      pagination.total = res?.total ?? 0;
      collectBrands(tableData.value);
    } catch (error: any) {
      if (requestSequence === loadSequence && drawerVisible.value) {
        tableData.value = [];
        pagination.total = 0;
        createMessage.error(error?.message || '物料列表加载失败，请重试');
      }
    } finally {
      if (requestSequence === loadSequence) loading.value = false;
    }
  }

  function normalizeProjectMaterialAccount(account: any) {
    const unitName = account.baseUnitName || '';
    return {
      ...account,
      id: account.materialId,
      materialName: account.materialName || '',
      materialCode: account.materialCode || '',
      baseUnitName: unitName,
      unit: unitName,
      unitList: unitName ? [{ unitName }] : [],
      availableApplyQty: Math.max(Number(account.availableApplyQty) || 0, 0),
    };
  }

  async function ensureBrandMap() {
    if (brandMapLoaded) return;
    if (brandMapRequest) return brandMapRequest;
    brandMapRequest = (async () => {
      brandMap.value = await loadDictMap('material_brand');
      brandMapLoaded = true;
    })();
    try {
      await brandMapRequest;
    } finally {
      brandMapRequest = null;
    }
  }

  function formatBrand(value: unknown) {
    const rawValue = String(value ?? '');
    return brandMap.value[rawValue]?.text || rawValue || '—';
  }

  // 品牌下拉去重(来源: 当前列表数据) → 全量池
  function collectBrands(list: any[]) {
    const brands = new Map<string, { label: string; value: string }>();
    (list || []).forEach((m) => {
      const value = String(m.brand ?? '');
      if (value && !brands.has(value)) brands.set(value, { label: formatBrand(value), value });
    });
    brandAll.value = Array.from(brands.values());
  }

  // 品牌下拉：初次点击不展示，输入后模糊查询
  function onBrandSearch(keyword: string) {
    if (!keyword) {
      brandOptions.value = [];
      return;
    }
    const kw = keyword.toLowerCase();
    brandOptions.value = brandAll.value.filter((o) => String(o.label).toLowerCase().includes(kw));
  }

  // 树选中
  function handleTreeSelect(keys: any[]) {
    selectedKeys.value = keys;
    const key = keys[0];
    const node = findNode(treeData.value, key);
    // 选中「全部」(或无分类节点) → 清空分类过滤，展示全部
    queryParam.materialCategory = node && node.key !== 'all' ? node.categoryCode : undefined;
    pagination.current = 1;
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
    resetQueryState();
    void loadData();
  }

  function resetQueryState() {
    queryParam.keyword = '';
    queryParam.materialName = '';
    queryParam.model = '';
    queryParam.brand = undefined;
    queryParam.materialCategory = undefined;
    selectedKeys.value = ['all']; // 默认选中「全部」→ 展示全部物料
    pagination.current = 1;
  }

  // 分页变化
  function handleTableChange(pg: any) {
    pagination.current = normalizePageNumber(pg?.current, pagination.current);
    pagination.pageSize = normalizePageNumber(pg?.pageSize, pagination.pageSize);
    loadData();
  }

  // 是否已选
  function isSelected(record: any) {
    return selectedList.value.some((s) => String(s.id) === String(record.id));
  }

  // 选择
  function handleSelect(record: any) {
    if (excludedMaterialIds.value.has(String(record.id))) return;
    if (isProjectMode.value && Number(record.availableApplyQty) <= 0) return;
    if (isSelected(record)) return;
    selectedList.value.push(record);
  }

  // 本页全选或取消不影响其他页已经选择的物料。
  function handleToggleSelectAll() {
    const selectable = selectableMaterials.value;
    if (!selectable.length) return;
    const filteredIds = new Set(selectable.map((item) => String(item.id)));
    if (allPageMaterialsSelected.value) {
      selectedList.value = selectedList.value.filter((item) => !filteredIds.has(String(item.id)));
      return;
    }

    const selectedIds = new Set(selectedList.value.map((item) => String(item.id)));
    const additions: any[] = [];
    selectable.forEach((item) => {
      const id = String(item.id);
      if (selectedIds.has(id)) return;
      selectedIds.add(id);
      additions.push(item);
    });
    selectedList.value = [...selectedList.value, ...additions];
  }

  // 取消选择
  function handleUnselect(record: any) {
    selectedList.value = selectedList.value.filter((s) => String(s.id) !== String(record.id));
  }

  // 已选标签删除
  function removeSelected(record: any) {
    selectedList.value = selectedList.value.filter((s) => String(s.id) !== String(record.id));
  }

  // 行高亮(已选行)
  function getRowClassName(record: any) {
    if (excludedMaterialIds.value.has(String(record.id))) return 'material-select__row-excluded';
    return isSelected(record) ? 'material-select__row-selected' : '';
  }

  // 新增物料: 打开弹窗
  function handleAddMaterial() {
    openAddModal(true, { isUpdate: false });
  }

  // 新增物料成功: 调用接口写入物料列表, 刷新列表
  async function handleAddMaterialSuccess(values: any) {
    await addMaterial(values);
    invalidateMaterialMap();
    // 刷新树和列表
    if (drawerVisible.value) await Promise.all([loadTree(), loadData()]);
  }

  // 确定: 回传已选物料
  function handleOk() {
    emit('success', unref(selectedList));
    closeDrawer();
  }
</script>

<style lang="less" scoped>
  .material-select__model-clamp {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 20px;
    max-height: 40px;
  }
  .material-select {
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

      &-add-btn {
        margin-left: auto;
      }
    }

    &__pagination {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 16px;
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

    &__identity {
      display: flex;
      min-width: 0;
      gap: 12px;
      align-items: baseline;
      justify-content: space-between;
    }

    &__name {
      min-width: 0;
      overflow: hidden;
      color: #262626;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    &__code {
      max-width: 45%;
      overflow: hidden;
      color: #8c8c8c;
      font-size: 12px;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: none;
    }

    &__available {
      color: #1677ff;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }

    :deep(.material-select__row-selected) {
      td {
        background-color: #fffbe6 !important;
      }
    }

    :deep(.material-select__row-excluded) {
      td {
        color: #8c8c8c;
        background-color: #fafafa !important;
      }
    }
  }
</style>
