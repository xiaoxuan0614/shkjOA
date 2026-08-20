<template>
  <div class="detail-acceptance">
    <!-- 验收阶段说明 -->
    <a-alert
      type="info"
      show-icon
      message="验收阶段：内部验收与客户验收同步进行，顺序不分先后；两者均需上传验收报告，全部完成后项目进入质保期"
      style="margin-bottom: 16px"
    />

    <div class="detail-acceptance__grid">
      <!-- 内部验收 -->
      <a-card title="内部验收" size="small" class="accept-card">
        <template #extra>
          <a-button type="primary" size="small" :loading="internalLoading" @click="handleSaveInternal">保存</a-button>
        </template>
        <a-form layout="vertical">
          <a-form-item label="验收负责人" required>
            <a-select
              v-model:value="internal.acceptLeaderId"
              show-search
              option-filter-prop="label"
              placeholder="请选择内部验收负责人"
              :options="leaderOptions"
            />
          </a-form-item>
          <a-form-item label="验收日期">
            <a-date-picker v-model:value="internal.acceptDate" value-format="YYYY-MM-DD" style="width: 100%" />
          </a-form-item>
          <a-form-item label="实施完成日期">
            <a-date-picker v-model:value="internal.implementCompleteDate" value-format="YYYY-MM-DD" style="width: 100%" />
          </a-form-item>
          <a-form-item label="验收报告" required>
            <div class="file-field">
              <a-upload :show-upload-list="false" :before-upload="(f) => onReportUpload('internal', f)">
                <a-button type="primary" size="small" preIcon="ant-design:file-upload-outlined">上传验收报告</a-button>
              </a-upload>
              <a-tag v-if="internal.reportFileId" closable @close="internal.reportFileId = ''" class="file-tag">
                {{ fileName(internal.reportFileId) }}
              </a-tag>
            </div>
          </a-form-item>
          <a-form-item label="验收结果">
            <a-select v-model:value="internal.result" placeholder="请选择验收结果" :options="resultOptions" allow-clear />
          </a-form-item>
          <a-form-item label="备注">
            <a-textarea v-model:value="internal.remark" placeholder="请输入备注" :rows="2" />
          </a-form-item>
        </a-form>
      </a-card>

      <!-- 客户验收 -->
      <a-card title="客户验收" size="small" class="accept-card">
        <template #extra>
          <a-button type="primary" size="small" :loading="customerLoading" @click="handleSaveCustomer">保存</a-button>
        </template>
        <a-form layout="vertical">
          <a-form-item label="验收日期">
            <a-date-picker v-model:value="customer.acceptDate" value-format="YYYY-MM-DD" style="width: 100%" />
          </a-form-item>
          <a-form-item label="实施完成日期">
            <a-date-picker v-model:value="customer.implementCompleteDate" value-format="YYYY-MM-DD" style="width: 100%" />
          </a-form-item>
          <a-form-item label="验收单位负责人">
            <a-input v-model:value="customer.acceptUnitLeader" placeholder="请输入验收单位负责人" />
          </a-form-item>
          <a-form-item label="验收单位联系电话">
            <a-input v-model:value="customer.acceptUnitPhone" placeholder="请输入验收单位联系电话" />
          </a-form-item>
          <a-form-item label="验收负责人">
            <a-select
              v-model:value="customer.acceptLeaderId"
              show-search
              option-filter-prop="label"
              placeholder="请选择客户验收负责人"
              :options="leaderOptions"
            />
          </a-form-item>
          <a-form-item label="竣工报告（验收报告）" required>
            <div class="file-field">
              <a-upload :show-upload-list="false" :before-upload="(f) => onReportUpload('customer', f)">
                <a-button type="primary" size="small" preIcon="ant-design:file-upload-outlined">上传竣工报告</a-button>
              </a-upload>
              <a-tag v-if="customer.completionReportFileId" closable @close="customer.completionReportFileId = ''" class="file-tag">
                {{ fileName(customer.completionReportFileId) }}
              </a-tag>
            </div>
          </a-form-item>
          <a-form-item label="验收单">
            <div class="file-field">
              <a-upload :show-upload-list="false" :before-upload="(f) => onReportUpload('acceptForm', f)">
                <a-button type="primary" size="small" preIcon="ant-design:file-upload-outlined">上传验收单</a-button>
              </a-upload>
              <a-tag v-if="customer.acceptanceFormFileId" closable @close="customer.acceptanceFormFileId = ''" class="file-tag">
                {{ fileName(customer.acceptanceFormFileId) }}
              </a-tag>
            </div>
          </a-form-item>
          <a-form-item label="验收结果">
            <a-select v-model:value="customer.result" placeholder="请选择验收结果" :options="resultOptions" allow-clear />
          </a-form-item>
          <a-form-item label="备注">
            <a-textarea v-model:value="customer.remark" placeholder="请输入备注" :rows="2" />
          </a-form-item>
        </a-form>
      </a-card>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, watch } from 'vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import {
    getInternalAcceptance,
    addInternalAcceptance,
    editInternalAcceptance,
    getAcceptance,
    addAcceptance,
    editAcceptance,
  } from '../ProjectDetail.api';
  import { loadUserOptions } from '/@/views/resource/userOptions';
  import { uploadFile } from '/@/api/common/api';
  import { loadDictOptions } from '../../Project.data';

  const props = defineProps<{
    projectId: string; // 分期ID periodId
  }>();

  const { createMessage } = useMessage();

  const internalLoading = ref(false);
  const customerLoading = ref(false);

  // 负责人下拉(用户选择器)
  const leaderOptions = ref<{ label: string; value: string }[]>([]);

  // 验收结果选项(兜底: 字典 acceptance_result 加载失败时用)
  const acceptanceResultFallback = [
    { label: '通过', value: '通过' },
    { label: '不通过', value: '不通过' },
    { label: '整改', value: '整改' },
  ];
  const resultOptions = ref<{ label: string; value: string }[]>(acceptanceResultFallback);
  loadDictOptions('acceptance_result', acceptanceResultFallback).then((opts) => {
    resultOptions.value = opts || [];
  });

  // 内部验收记录(id 存在=编辑)
  const internal = reactive<any>({ acceptLeaderId: undefined, acceptDate: '', implementCompleteDate: '', reportFileId: '', result: '', remark: '' });
  // 客户验收记录
  const customer = reactive<any>({ acceptDate: '', implementCompleteDate: '', acceptUnitLeader: '', acceptUnitPhone: '', acceptLeaderId: undefined, completionReportFileId: '', acceptanceFormFileId: '', result: '', remark: '' });

  /** 上传文件(a-upload before-upload) -> 后端返回文件路径, 存入对应 fileId 字段(路径/fileId 语义待与后端确认) */
  async function onReportUpload(target: string, file: any): Promise<boolean> {
    if (!file) return false;
    try {
      const res: any = await uploadFile({ file }, undefined);
      const path = res?.url || res?.result || res?.filename || file.name;
      if (target === 'internal') internal.reportFileId = path;
      else if (target === 'customer') customer.completionReportFileId = path;
      else customer.acceptanceFormFileId = path;
      createMessage.success('文件上传成功');
    } catch (err) {
      // 上传接口异常时降级存文件名，保证联调流程可走通
      if (target === 'internal') internal.reportFileId = file.name;
      else if (target === 'customer') customer.completionReportFileId = file.name;
      else customer.acceptanceFormFileId = file.name;
      createMessage.warning('上传失败，已暂存文件名');
    }
    return false; // 阻止 a-upload 默认上传
  }

  /** 展示上传的文件名(路径取最后一段) */
  function fileName(path?: string): string {
    if (!path) return '';
    const parts = String(path).split('/');
    return parts[parts.length - 1] || path;
  }

  /** 保存内部验收(无记录=新增, 有 id=编辑) */
  async function handleSaveInternal() {
    if (!internal.acceptLeaderId) return createMessage.warning('请选择内部验收负责人');
    if (!internal.reportFileId) return createMessage.warning('内部验收必须上传验收报告');
    internalLoading.value = true;
    try {
      const payload = { ...internal, periodId: props.projectId };
      if (internal.id) {
        await editInternalAcceptance(payload);
      } else {
        await addInternalAcceptance(payload);
      }
      createMessage.success('内部验收保存成功');
      await loadInternal();
    } finally {
      internalLoading.value = false;
    }
  }

  /** 保存客户验收(无记录=新增, 有 id=编辑) */
  async function handleSaveCustomer() {
    if (!customer.completionReportFileId) return createMessage.warning('客户验收必须上传竣工报告（验收报告）');
    customerLoading.value = true;
    try {
      const payload = { ...customer, periodId: props.projectId };
      if (customer.id) {
        await editAcceptance(payload);
      } else {
        await addAcceptance(payload);
      }
      createMessage.success('客户验收保存成功');
      await loadCustomer();
    } finally {
      customerLoading.value = false;
    }
  }

  /** 加载内部验收记录(取最近一条) */
  async function loadInternal() {
    const res: any = await getInternalAcceptance({ periodId: props.projectId, pageNo: 1, pageSize: 1 });
    const records = res?.records || res || [];
    const record = records[0] || {};
    Object.assign(internal, {
      id: record.id,
      acceptLeaderId: record.acceptLeaderId,
      acceptDate: record.acceptDate || '',
      implementCompleteDate: record.implementCompleteDate || '',
      reportFileId: record.reportFileId || '',
      result: record.result || '',
      remark: record.remark || '',
    });
  }

  /** 加载客户验收记录(取最近一条) */
  async function loadCustomer() {
    const res: any = await getAcceptance({ periodId: props.projectId, pageNo: 1, pageSize: 1 });
    const records = res?.records || res || [];
    const record = records[0] || {};
    Object.assign(customer, {
      id: record.id,
      acceptDate: record.acceptDate || '',
      implementCompleteDate: record.implementCompleteDate || '',
      acceptUnitLeader: record.acceptUnitLeader || '',
      acceptUnitPhone: record.acceptUnitPhone || '',
      acceptLeaderId: record.acceptLeaderId,
      completionReportFileId: record.completionReportFileId || '',
      acceptanceFormFileId: record.acceptanceFormFileId || '',
      result: record.result || '',
      remark: record.remark || '',
    });
  }

  async function load() {
    await loadInternal();
    await loadCustomer();
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );

  // 负责人下拉预载
  loadUserOptions().then((opts) => {
    leaderOptions.value = opts || [];
  });
</script>

<style lang="less" scoped>
  .detail-acceptance {
    &__grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;

      @media (max-width: 1200px) {
        grid-template-columns: 1fr;
      }
    }

    .accept-card {
      &:deep(.ant-card-head) {
        background: #fafafa;
      }
    }

    .file-field {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;

      .file-tag {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
</style>
