<template>
  <div class="plan-file-mgmt">
    <div class="plan-file-mgmt__toolbar">
      <a-button type="primary" preIcon="ant-design:plus-outlined" :disabled="!editable" @click="addRow">添加</a-button>
      <span class="plan-file-mgmt__tip">方案文件逐个上传，一个项目可有多个方案文件</span>
    </div>

    <a-table
      :columns="columns"
      :data-source="list"
      :row-key="(record) => record._key"
      :pagination="false"
      size="middle"
      bordered
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'index'">
          {{ record._key }}
        </template>
        <template v-else-if="column.key === 'planName'">
          <a-input v-model:value="record.planName" :disabled="!editable" placeholder="请输入方案名称" />
        </template>
        <template v-else-if="column.key === 'planType'">
          <a-select v-model:value="record.planType" :disabled="!editable" placeholder="请选择方案类型" style="width: 100%" :options="planTypeOptions" />
        </template>
        <template v-else-if="column.key === 'planFileId'">
          <a-upload :show-upload-list="false" :before-upload="(file) => handleUpload(record, file)">
            <a-button :disabled="!editable" preIcon="ant-design:cloud-upload-outlined">{{ record._fileText || '选择方案文件' }}</a-button>
          </a-upload>
        </template>
        <template v-else-if="column.key === 'remark'">
          <a-input v-model:value="record.remark" :disabled="!editable" placeholder="备注" />
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button v-if="editable" type="link" danger size="small" @click="removeRow(record._key)">删除</a-button>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
  import { ref, unref, onMounted } from 'vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { uploadFile } from '/@/api/common/api';
  import { loadDictOptions } from '../Project.data';

  const { createMessage } = useMessage();

  const props = defineProps<{
    editable?: boolean;
  }>();

  // 方案类型下拉(兜底: 字典 plan_type 加载失败时用)
  const planTypeFallback = [
    { label: '实施计划', value: '实施计划' },
    { label: '技术方案', value: '技术方案' },
    { label: '施工方案', value: '施工方案' },
  ];
  const planTypeOptions = ref<{ label: string; value: string }[]>(planTypeFallback);
  onMounted(async () => {
    planTypeOptions.value = await loadDictOptions('plan_type', planTypeFallback);
  });

  const columns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '方案名称', key: 'planName', width: 200 },
    { title: '方案类型', key: 'planType', width: 140 },
    { title: '方案文件', key: 'planFileId', width: 180 },
    { title: '备注', key: 'remark' },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];

  // 方案文件列表(每个文档一个 project_plan 记录)
  const list = ref<any[]>([]);
  let seed = 0;

  /** 上传方案文件 → 存返回路径到该行 planFileId */
  async function handleUpload(record: any, file: any): Promise<boolean> {
    if (!file) return false;
    try {
      const res: any = await uploadFile({ file }, undefined);
      const path = res?.url || res?.result || res?.filename || file.name;
      record.planFileId = path;
      record._fileText = file.name;
      createMessage.success(`文件「${file.name}」上传成功`);
    } catch (err) {
      createMessage.warning('上传失败，请重试');
    }
    return false;
  }

  function addRow() {
    if (!props.editable) return;
    list.value.push({ _key: ++seed, planName: '', planType: undefined, planFileId: '', _fileText: '', remark: '' });
  }

  function removeRow(key: number) {
    list.value = list.value.filter((r) => r._key !== key);
  }

  // 暴露给父级: 校验每行名称/类型, 返回方案文档数组
  defineExpose({
    getData() {
      const rows = unref(list);
      if (!rows.length) {
        createMessage.warning('请至少添加一个方案文件');
        throw new Error('plan-empty');
      }
      for (const r of rows) {
        if (!r.planName) {
          createMessage.warning('请填写方案名称');
          throw new Error('plan-name-empty');
        }
        if (!r.planType) {
          createMessage.warning('请选择方案类型');
          throw new Error('plan-type-empty');
        }
      }
      return rows.map((r) => ({ planName: r.planName, planType: r.planType, planFileId: r.planFileId, remark: r.remark }));
    },
    setData(docs: any[]) {
      list.value = (docs || []).map((d) => ({
        ...d,
        _key: ++seed,
        _fileText: d.planFileId ? d.planFileId.split('/').pop() : '',
      }));
    },
  });
</script>

<style lang="less" scoped>
  .plan-file-mgmt {
    &__toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    &__tip {
      color: #999;
      font-size: 13px;
    }
  }
</style>
