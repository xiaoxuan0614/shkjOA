<template>
  <a-form layout="vertical">
    <template v-for="field in fields" :key="field.key">
      <a-form-item v-if="permissions[field.key] !== 'HIDDEN'" :label="field.name" :required="field.required">
        <a-input v-if="kind(field) === 'string'" :value="value[field.key]" :disabled="locked(field)" @update:value="(v) => set(field.key, v)" />
        <a-input-number
          v-else-if="kind(field) === 'number'"
          :value="value[field.key]"
          :disabled="locked(field)"
          @update:value="(v) => set(field.key, v)"
        />
        <a-radio-group
          v-else-if="kind(field) === 'boolean'"
          :value="value[field.key]"
          :disabled="locked(field)"
          @update:value="(v) => set(field.key, v)"
          ><a-radio :value="true">是</a-radio><a-radio :value="false">否</a-radio></a-radio-group
        >
        <a-date-picker
          v-else-if="kind(field) === 'date'"
          :value="value[field.key]"
          value-format="YYYY-MM-DD"
          :disabled="locked(field)"
          @update:value="(v) => set(field.key, v)"
        />
        <template v-else-if="kind(field) === 'attachment'">
          <a-upload :show-upload-list="false" :disabled="locked(field) || uploading" :before-upload="(file) => upload(field.key, file)"
            ><a-button :loading="uploading" :disabled="locked(field)"><UploadOutlined />选择附件</a-button></a-upload
          >
          <span v-if="value[field.key]" class="attachment-name">{{ names[field.key] || '已上传附件' }}</span>
          <p class="hint">单个文件最大10MB，上传后保存不可变附件引用。</p>
        </template>
        <a-alert v-else type="warning" message="此字段类型暂不支持填写，请使用支持该表单的客户端。" />
      </a-form-item>
    </template>
    <a-alert v-if="error" type="error" :message="error" show-icon />
  </a-form>
</template>
<script setup lang="ts">
  import { ref } from 'vue';
  import { UploadOutlined } from '@ant-design/icons-vue';
  import { uploadAttachment } from '../Workflow.api';
  import type { FieldPermission, FormField } from '../workflow.types';
  const props = defineProps<{ fields: FormField[]; permissions: Record<string, FieldPermission>; value: Record<string, any>; disabled?: boolean }>();
  const emit = defineEmits<{ (e: 'update:value', value: Record<string, any>): void; (e: 'uploading', value: boolean): void }>();
  const names = ref<Record<string, string>>({}),
    uploading = ref(false),
    error = ref('');
  const kind = (field: FormField) => (/[.\[\]]/.test(field.key) ? 'unsupported' : field.type.toLowerCase());
  const locked = (field: FormField) => !!props.disabled || props.permissions[field.key] === 'READ_ONLY';
  function set(key: string, value: unknown) {
    emit('update:value', { ...props.value, [key]: value });
  }
  async function upload(key: string, file: File) {
    uploading.value = true;
    emit('uploading', true);
    error.value = '';
    try {
      const result = await uploadAttachment(file);
      set(key, result.id);
      names.value[key] = result.fileName;
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      uploading.value = false;
      emit('uploading', false);
    }
    return false;
  }
</script>
<style scoped>
  .ant-input-number,
  .ant-picker {
    width: 100%;
  }
  .hint {
    color: #595959;
    font-size: 12px;
    margin-top: 8px;
  }
  .attachment-name {
    margin-left: 12px;
    overflow-wrap: anywhere;
  }
</style>
