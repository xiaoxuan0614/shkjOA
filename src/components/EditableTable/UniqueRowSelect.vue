<template>
  <div class="unique-row-select">
    <a-select v-bind="$attrs" :value="modelValue" :options="availableOptions" :status="error ? 'error' : undefined" @change="handleChange" />
    <div v-if="error" class="unique-row-select__error" role="alert">{{ error }}</div>
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue';
  import { getAvailableUniqueRowOptions, type UniqueRowOption } from './uniqueRow';

  defineOptions({ name: 'UniqueRowSelect', inheritAttrs: false });

  const props = withDefaults(
    defineProps<{
      modelValue?: string | number;
      rows: Record<string, any>[];
      row: Record<string, any>;
      options: UniqueRowOption[];
      field: string;
      rowKey?: string;
      error?: string;
    }>(),
    { rowKey: '_key', error: '' }
  );

  const emit = defineEmits<{
    'update:modelValue': [value: string | number | undefined];
    change: [value: string | number | undefined, option: UniqueRowOption | UniqueRowOption[] | undefined];
  }>();

  const availableOptions = computed(() =>
    getAvailableUniqueRowOptions(props.rows, props.row, props.options, { field: props.field, rowKey: props.rowKey })
  );

  function handleChange(value: string | number | undefined, option: UniqueRowOption | UniqueRowOption[] | undefined) {
    emit('update:modelValue', value);
    emit('change', value, option);
  }
</script>

<style lang="less" scoped>
  .unique-row-select {
    width: 100%;

    :deep(.ant-select) {
      width: 100%;
    }

    &__error {
      margin-top: 4px;
      color: @error-color;
      font-size: 12px;
      line-height: 1.4;
    }
  }
</style>
