import type { Ref } from 'vue';
import { computed, unref, type ComputedRef } from 'vue';

export interface UniqueRowOption {
  label: string;
  value: string | number;
  [key: string]: unknown;
}

export interface UniqueRowConfig {
  field: string;
  rowKey?: string;
}

export interface EditableRowRule<Row extends Record<string, any> = Record<string, any>> {
  field: keyof Row & string;
  label: string;
  required?: boolean;
  validate?: (value: unknown, row: Row, index: number) => true | string;
}

export interface EditableRowValidationConfig<Row extends Record<string, any> = Record<string, any>> {
  selectorField: keyof Row & string;
  selectorLabel: string;
  rules?: EditableRowRule<Row>[];
  unique?: boolean;
  optionLabel?: (value: unknown) => string;
}

export interface EditableRowValidationIssue<Row extends Record<string, any> = Record<string, any>> {
  row: Row;
  rowIndex: number;
  field: keyof Row & string;
  message: string;
}

function normalizeValue(value: unknown) {
  return value == null ? '' : String(value).trim();
}

function isSameRow(row: Record<string, any>, currentRow: Record<string, any>, rowKey = '_key') {
  if (row === currentRow) return true;
  const rowValue = normalizeValue(row?.[rowKey]);
  const currentValue = normalizeValue(currentRow?.[rowKey]);
  return !!rowValue && !!currentValue && rowValue === currentValue;
}

export function isEditableRowValueEmpty(value: unknown) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** 当前行保留自己的值，同时隐藏其他行已经选择的选项。 */
export function getAvailableUniqueRowOptions(
  rows: Record<string, any>[],
  currentRow: Record<string, any>,
  options: UniqueRowOption[],
  config: UniqueRowConfig
) {
  const rowKey = config.rowKey || '_key';
  const currentValue = normalizeValue(currentRow?.[config.field]);
  const selectedByOtherRows = new Set(
    (rows || [])
      .filter((row) => !isSameRow(row, currentRow, rowKey))
      .map((row) => normalizeValue(row?.[config.field]))
      .filter(Boolean)
  );
  return (options || []).filter((option) => normalizeValue(option.value) === currentValue || !selectedByOtherRows.has(normalizeValue(option.value)));
}

export function useUniqueRowOptions(
  rows: Ref<Record<string, any>[]>,
  options: Ref<UniqueRowOption[]>,
  config: UniqueRowConfig
): { canAdd: ComputedRef<boolean>; selectedValues: ComputedRef<Set<string>> } {
  const selectedValues = computed(() => new Set((unref(rows) || []).map((row) => normalizeValue(row?.[config.field])).filter(Boolean)));
  const canAdd = computed(() => (unref(options) || []).some((option) => !selectedValues.value.has(normalizeValue(option.value))));
  return { canAdd, selectedValues };
}

/**
 * 可编辑行表格的统一提交校验：行存在时名称必选；名称选中后，校验该业务配置的所有必填和格式规则。
 */
export function validateEditableRows<Row extends Record<string, any>>(
  rows: Row[],
  config: EditableRowValidationConfig<Row>
): EditableRowValidationIssue<Row>[] {
  const issues: EditableRowValidationIssue<Row>[] = [];
  const seen = new Map<string, number>();

  (rows || []).forEach((row, index) => {
    const selectorValue = row?.[config.selectorField];
    if (isEditableRowValueEmpty(selectorValue)) {
      issues.push({
        row,
        rowIndex: index,
        field: config.selectorField,
        message: `第 ${index + 1} 行：请选择${config.selectorLabel}`,
      });
      return;
    }

    const normalizedSelector = normalizeValue(selectorValue);
    if (config.unique !== false) {
      const previousIndex = seen.get(normalizedSelector);
      if (previousIndex != null) {
        const label = config.optionLabel?.(selectorValue) || normalizedSelector;
        issues.push({
          row,
          rowIndex: index,
          field: config.selectorField,
          message: `第 ${index + 1} 行：${config.selectorLabel}「${label}」已在第 ${previousIndex + 1} 行选择`,
        });
      } else {
        seen.set(normalizedSelector, index);
      }
    }

    (config.rules || []).forEach((rule) => {
      const value = row?.[rule.field];
      if (rule.required && isEditableRowValueEmpty(value)) {
        issues.push({ row, rowIndex: index, field: rule.field, message: `第 ${index + 1} 行：请填写${rule.label}` });
        return;
      }
      if (rule.validate && !isEditableRowValueEmpty(value)) {
        const result = rule.validate(value, row, index);
        if (result !== true) issues.push({ row, rowIndex: index, field: rule.field, message: `第 ${index + 1} 行：${result}` });
      }
    });
  });

  return issues;
}
