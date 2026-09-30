<template>
  <div class="audience-fields">
    <a-radio-group v-if="singleSource" :value="source" class="audience-types" @change="changeSource($event.target.value)">
      <a-radio value="all">全部人</a-radio>
      <a-radio v-for="item in sources" :key="item.key" :value="item.key">{{ item.label }}</a-radio>
      <a-radio v-if="source === 'mixed'" value="mixed">组合范围</a-radio>
    </a-radio-group>
    <p v-if="singleSource && source === 'all'" class="audience-hint">不额外限制发起范围，仍须具备发起权限且流程已发布、启用。</p>
    <p v-else-if="singleSource && source !== 'mixed' && !sources.some((item) => value?.[item.key]?.length)" class="audience-hint"
      >请选择范围对象；未配置有效发起范围，当前无人可发起。请补选或明确选择“全部人”。</p
    >
    <p v-if="singleSource && source === 'mixed'" class="audience-hint">已有多个范围来源，已保留原配置；切换类型可重新选择。</p>
    <a-form-item v-if="visible('userIds')" label="指定人员"
      ><DirectorySelect :value="value?.userIds || undefined" kind="users" @update:value="(v) => update('userIds', v)"
    /></a-form-item>
    <a-form-item v-if="visible('roleIds')" label="指定角色"
      ><DirectorySelect :value="value?.roleIds || undefined" kind="roles" @update:value="(v) => update('roleIds', v)"
    /></a-form-item>
    <a-form-item v-if="visible('departmentIds')" label="指定部门"
      ><DirectorySelect :value="value?.departmentIds || undefined" kind="departments" @update:value="(v) => update('departmentIds', v)"
    /></a-form-item>
    <a-form-item v-if="visible('positionIds')" label="指定岗位"
      ><DirectorySelect :value="value?.positionIds || undefined" kind="positions" @update:value="(v) => update('positionIds', v)"
    /></a-form-item>
    <a-checkbox
      v-if="visible('departmentIds')"
      :disabled="!value?.departmentIds?.length"
      :checked="value?.includeChildren"
      @change="(e) => update('includeChildren', e.target.checked)"
      >部门范围包含下级部门</a-checkbox
    >
  </div>
</template>
<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { Modal } from 'ant-design-vue';
  import DirectorySelect from './DirectorySelect.vue';
  import type { Audience } from '../workflow.types';
  const props = defineProps<{ value?: Audience | null; singleSource?: boolean }>();
  const emit = defineEmits<{ (e: 'update:value', value: Audience | null): void }>();
  const sources = [
    { key: 'userIds', label: '指定成员' },
    { key: 'roleIds', label: '指定角色' },
    { key: 'departmentIds', label: '指定部门' },
    { key: 'positionIds', label: '指定岗位' },
  ] as const;
  const selectedSource = ref('userIds');
  const source = computed(() => {
    if (props.singleSource && props.value == null) return 'all';
    const active = sources.filter((item) => props.value?.[item.key]?.length);
    return active.length > 1 ? 'mixed' : active[0]?.key || (selectedSource.value === 'all' ? 'userIds' : selectedSource.value);
  });
  const visible = (key: string) => !props.singleSource || source.value === 'mixed' || source.value === key;
  function changeSource(key: string) {
    if (key === source.value || (key !== 'all' && !sources.some((item) => item.key === key))) return;
    const apply = () => {
      selectedSource.value = key;
      emit('update:value', key === 'all' ? null : { userIds: [], roleIds: [], departmentIds: [], positionIds: [], includeChildren: false });
    };
    if (sources.some((item) => props.value?.[item.key]?.length)) {
      Modal.confirm({
        title: '切换发起范围类型？',
        content: key === 'all' ? '切换后清空已选限制，全部人可发起；保存并发布后生效。' : '切换会清空当前已选范围，请重新选择。',
        okText: '切换',
        cancelText: '保留原配置',
        onOk: apply,
      });
    } else apply();
  }
  function update(key: keyof Audience, value: string[] | boolean) {
    if (key !== 'includeChildren') selectedSource.value = key;
    emit('update:value', {
      ...props.value,
      [key]: value,
      ...(key === 'departmentIds' && Array.isArray(value) && !value.length ? { includeChildren: false } : {}),
    });
  }
</script>

<style scoped>
  .audience-types {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    margin-bottom: 20px;
  }
  .audience-types :deep(.ant-radio-wrapper) {
    margin-inline-end: 0;
  }
  .audience-hint {
    color: #595959;
    font-size: 12px;
    margin: 0 0 16px;
  }
</style>
