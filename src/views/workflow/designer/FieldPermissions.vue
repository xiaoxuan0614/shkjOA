<template>
  <a-empty v-if="!fields.length" description="请先在表单配置中添加字段" /><table v-else class="field-table"
    ><thead
      ><tr><th>字段名称</th><th>设置</th></tr></thead
    ><tbody
      ><tr v-for="field in fields" :key="field.key"
        ><td>{{ field.name }}</td
        ><td
          ><a-radio-group :value="value[field.key]" @change="(e) => emit('update:value', { ...value, [field.key]: e.target.value })"
            ><a-radio value="EDITABLE">可编辑</a-radio><a-radio value="READ_ONLY">只读</a-radio><a-radio value="HIDDEN">隐藏</a-radio></a-radio-group
          ></td
        ></tr
      ></tbody
    ></table
  >
</template>
<script setup lang="ts">
  import type { FormField, FieldPermission } from '../workflow.types';
  defineProps<{ fields: FormField[]; value: Record<string, FieldPermission> }>();
  const emit = defineEmits<{ (e: 'update:value', value: Record<string, FieldPermission>): void }>();
</script>
<style scoped>
  .field-table {
    width: 720px;
    max-width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .field-table th {
    background: #f8f8fc;
    font-weight: 500;
  }
  .field-table th,
  .field-table td {
    padding: 14px 16px;
    text-align: left;
    border-bottom: 1px solid #eeeef5;
  }
  .field-table th:first-child {
    width: 40%;
  }
  .field-table :deep(.ant-radio-wrapper) {
    margin-right: 20px;
  }
</style>
