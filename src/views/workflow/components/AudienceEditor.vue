<template>
  <div class="audience-fields">
    <a-form-item label="指定人员"><DirectorySelect :value="value.userIds" kind="users" @update:value="(v) => update('userIds', v)" /></a-form-item>
    <a-form-item label="指定角色"><DirectorySelect :value="value.roleIds" kind="roles" @update:value="(v) => update('roleIds', v)" /></a-form-item>
    <a-form-item label="指定部门"
      ><DirectorySelect :value="value.departmentIds" kind="departments" @update:value="(v) => update('departmentIds', v)"
    /></a-form-item>
    <a-form-item label="指定岗位"
      ><DirectorySelect :value="value.positionIds" kind="positions" @update:value="(v) => update('positionIds', v)"
    /></a-form-item>
    <a-checkbox :checked="value.includeChildren" @change="(e) => update('includeChildren', e.target.checked)">部门范围包含下级部门</a-checkbox>
  </div>
</template>
<script setup lang="ts">
  import DirectorySelect from './DirectorySelect.vue';
  import type { Audience } from '../workflow.types';
  const props = defineProps<{ value: Audience }>();
  const emit = defineEmits<{ (e: 'update:value', value: Audience): void }>();
  function update(key: keyof Audience, value: string[] | boolean) {
    emit('update:value', { ...props.value, [key]: value });
  }
</script>
