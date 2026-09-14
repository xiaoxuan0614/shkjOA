<template>
  <div class="record-table">
    <!-- 搜索区 -->
    <div class="record-table__search">
      <slot name="extra" />
      <a-input v-if="showKeyword" v-model:value="query.keyword" allowClear placeholder="关键字" style="width: 160px" @press-enter="handleSearch" />
      <a-range-picker v-if="showDate" v-model:value="dateRange" :value-format="dateFormat || 'YYYY-MM-DD'" style="width: 260px" />
      <a-button type="primary" @click="handleSearch">筛选</a-button>
      <a-button @click="handleReset">重置</a-button>
    </div>

    <!-- 表格 -->
    <a-table
      :columns="[...columns, { title: '操作', key: 'action', width: 80 }]"
      :data-source="tableData"
      :pagination="pagination"
      :row-key="rowKey"
      :loading="loading"
      size="middle"
      bordered
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button type="link" size="small" @click="emit('detail', record)">详情</a-button>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, watch, onBeforeUnmount } from 'vue';

  const props = defineProps<{
    columns: any[];
    rowKey: string;
    loadFn: (params: any) => Promise<any>;
    params?: Recordable; // 固定参数, 如 { vehicleId }
    query?: Recordable; // 父组件注入的查询条件(响应式对象)
    title?: string;
    showKeyword?: boolean;
    showDate?: boolean;
    dateField?: string; // 日期区间映射到后端的字段前缀, 默认 date
    dateFormat?: string;
  }>();

  const emit = defineEmits(['detail']);

  // 本地查询条件(与父组件 query 共用引用)
  const query = reactive<any>(props.query || {});

  const tableData = ref<any[]>([]);
  const loading = ref(false);
  const dateRange = ref<any[]>([]);

  // 分页(服务端分页)
  const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
    showTotal: (total: number) => `共 ${total} 条`,
  });

  /**
   * 加载数据
   */
  let sequence = 0;
  async function loadData() {
    const request = ++sequence;
    if (!props.params?.vehicleId) return;
    loading.value = true;
    try {
      const params = {
        pageNo: pagination.current,
        pageSize: pagination.pageSize,
        ...query,
        ...props.params,
      };
      // 日期区间 -> 后端 { date_begin, date_end }
      if (dateRange.value && dateRange.value.length === 2) {
        const field = props.dateField || 'date';
        params[`${field}_begin`] = `${dateRange.value[0]} 00:00:00`;
        params[`${field}_end`] = `${dateRange.value[1]} 23:59:59`;
      }
      const res = await props.loadFn(params);
      if (request !== sequence) return;
      tableData.value = res?.records || [];
      pagination.current = params.pageNo;
      pagination.pageSize = params.pageSize;
      pagination.total = res?.total ?? 0;
    } catch {
      if (request === sequence) {
        tableData.value = [];
        pagination.total = 0;
      }
    } finally {
      if (request === sequence) loading.value = false;
    }
  }

  /**
   * 筛选
   */
  function handleSearch() {
    pagination.current = 1;
    loadData();
  }

  /**
   * 重置
   */
  function handleReset() {
    Object.keys(query).forEach((k) => delete query[k]);
    dateRange.value = [];
    pagination.current = 1;
    loadData();
  }

  /**
   * 分页变化
   */
  function handleTableChange(pg: any) {
    pagination.current = pg.current;
    pagination.pageSize = pg.pageSize;
    loadData();
  }

  watch(
    () => props.params?.vehicleId,
    () => {
      pagination.current = 1;
      loadData();
    },
    { immediate: true }
  );
  onBeforeUnmount(() => {
    ++sequence;
  });
</script>

<style lang="less" scoped>
  .record-table {
    &__search {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
  }
</style>
