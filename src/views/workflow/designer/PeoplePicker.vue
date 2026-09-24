<template>
  <a-modal :open="open" title="请选择" :width="720" ok-text="确认" cancel-text="取消" @cancel="emit('cancel')" @ok="emit('confirm', [...selected])">
    <div class="people-picker">
      <section class="candidates">
        <a-input-search v-model:value="keyword" placeholder="搜索名称" allow-clear @search="load(1)" />
        <a-tree
          v-if="kind === 'users' && departments.length"
          :tree-data="tree"
          :selected-keys="departmentId ? [departmentId] : []"
          class="department-tree"
          @select="chooseDepartment"
        />
        <a-button v-if="departmentId" type="link" size="small" @click="chooseDepartment([])">全部人员</a-button>
        <a-alert v-if="departmentError" type="warning" :message="departmentError"
          ><template #action><a-button size="small" @click="loadDepartments(session)">重试部门</a-button></template></a-alert
        >
        <h4>{{ kind === 'users' ? '人员' : '角色' }}</h4>
        <a-spin :spinning="loading"
          ><div class="people-list">
            <a-empty v-if="!loading && !rows.length && !error" description="暂无匹配结果" />
            <label v-for="row in rows" :key="row.id" class="person-row"
              ><a-checkbox
                :checked="selected.includes(row.id)"
                :disabled="!selected.includes(row.id) && selected.length >= 100"
                @change="toggle(row.id, $event.target.checked)"
              /><UserOutlined /><span>{{ label(row) }}</span></label
            >
            <a-button v-if="page * 30 < total" type="link" :loading="loading" @click="load(page + 1)">加载更多</a-button>
          </div></a-spin
        >
        <a-alert v-if="error" type="error" :message="error"
          ><template #action><a-button size="small" @click="load(1)">重试</a-button></template></a-alert
        >
      </section>
      <section class="chosen"
        ><header
          ><span>已选 {{ selected.length }} / 100</span><a-button type="link" size="small" @click="selected = []">清空</a-button></header
        >
        <div class="people-list"
          ><a-empty v-if="!selected.length" description="请选择" />
          <div v-for="id in selected" :key="id" class="person-row"
            ><UserOutlined /><span>{{ labels[id] || `已选 ${id}` }}</span
            ><a-button type="text" size="small" :aria-label="`移除${labels[id] || id}`" @click="toggle(id, false)"><CloseOutlined /></a-button
          ></div>
        </div>
      </section>
    </div>
  </a-modal>
</template>
<script setup lang="ts">
  import { ref, watch, computed, onBeforeUnmount } from 'vue';
  import { UserOutlined, CloseOutlined } from '@ant-design/icons-vue';
  import { departmentTree } from '../directoryTree';
  import { directory } from '../Workflow.api';
  import type { DirectoryEntry } from '../workflow.types';
  const props = defineProps<{ open: boolean; kind: 'users' | 'roles'; value: string[] }>();
  const emit = defineEmits<{ (e: 'cancel'): void; (e: 'confirm', ids: string[]): void }>();
  const selected = ref<string[]>([]),
    rows = ref<DirectoryEntry[]>([]),
    labels = ref<Record<string, string>>({});
  const keyword = ref(''),
    loading = ref(false),
    error = ref(''),
    page = ref(1),
    total = ref(0);
  let generation = 0,
    session = 0;
  const departments = ref<DirectoryEntry[]>([]),
    departmentId = ref<string>(),
    departmentError = ref('');
  const tree = computed(() => departmentTree(departments.value));
  function chooseDepartment(keys: (string | number)[]) {
    departmentId.value = keys[0] == null ? undefined : String(keys[0]);
    load(1);
  }
  async function loadDepartments(current: number) {
    departmentError.value = '';
    const resultRows: DirectoryEntry[] = [];
    let next = 1;
    try {
      while (current === session) {
        const result = await directory('departments', '', next++);
        if (current !== session) return;
        resultRows.push(...result.records);
        if (!result.records.length || resultRows.length >= result.total) break;
      }
      if (current === session) departments.value = resultRows;
    } catch (e) {
      if (current === session) departmentError.value = '部门目录加载失败，可重试或搜索全部人员';
    }
  }
  const label = (row: DirectoryEntry) => row.name || row.username || row.code || row.id;
  function remember(items: DirectoryEntry[]) {
    for (const row of items) labels.value[row.id] = label(row);
  }
  async function load(next: number) {
    const current = ++generation;
    loading.value = true;
    error.value = '';
    try {
      const result = await directory(props.kind, keyword.value.trim(), next, departmentId.value);
      if (current !== generation) return;
      remember(result.records);
      rows.value = next === 1 ? result.records : [...rows.value, ...result.records];
      total.value = result.total;
      page.value = next;
    } catch (e) {
      if (current === generation) error.value = (e as Error).message;
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  function toggle(id: string, checked: boolean) {
    selected.value = checked ? [...new Set([...selected.value, id])] : selected.value.filter((v) => v !== id);
  }
  watch(
    () => props.open,
    async (open) => {
      const current = ++session;
      ++generation;
      if (!open) return;
      selected.value = [...props.value];
      keyword.value = '';
      rows.value = [];
      labels.value = {};
      departmentId.value = undefined;
      if (props.kind === 'users') void loadDepartments(current);
      await load(1);
      // Preserve names for selections outside the currently displayed page without filtering out inaccessible IDs.
      let next = 1,
        remainingTotal = Infinity;
      while (current === session && selected.value.some((id) => !labels.value[id]) && (next - 1) * 30 < remainingTotal) {
        try {
          const result = await directory(props.kind, '', next++);
          if (current !== session) return;
          remember(result.records);
          remainingTotal = result.total;
          if (!result.records.length) break;
        } catch {
          if (current === session) error.value = '部分已选名称加载失败，已保留原标识';
          break;
        }
      }
    },
    { immediate: true }
  );
  onBeforeUnmount(() => {
    ++generation;
    ++session;
  });
</script>
<style scoped>
  .people-picker {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid #e8e9f0;
    min-height: 360px;
    margin-top: 24px;
  }
  .candidates {
    padding: 16px;
    border-right: 1px solid #e8e9f0;
    min-width: 0;
  }
  .chosen {
    padding: 16px;
    min-width: 0;
  }
  h4 {
    font-size: 13px;
    margin: 16px 0 8px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .department-tree {
    max-height: 160px;
    overflow: auto;
    margin-top: 12px;
  }
  .people-list {
    max-height: 300px;
    overflow: auto;
  }
  .person-row {
    display: flex;
    gap: 10px;
    align-items: center;
    min-height: 38px;
    padding: 4px 0;
  }
  .person-row > span:not(.anticon) {
    flex: 1;
    overflow-wrap: anywhere;
  }
  .person-row > .anticon {
    color: #7774e9;
  }
  @media (max-width: 480px) {
    .candidates,
    .chosen {
      padding: 10px;
    }
    .people-picker {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
</style>
