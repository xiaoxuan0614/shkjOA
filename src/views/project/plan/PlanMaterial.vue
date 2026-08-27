<template>
  <div class="project-plan-material">
    <div v-if="editable" class="project-plan-material__toolbar">
      <a-button preIcon="ant-design:import-outlined" @click="openImportModal">导入清单</a-button>
      <span>可上传 Excel，或导入当前分期已锁定的报价单；导入后点击“保存本页”才会提交。</span>
    </div>
    <a-alert
      v-if="hasContractDraft"
      class="project-plan-material__notice"
      type="info"
      show-icon
      message="已载入本分期的计划用料清单"
      description="筹备阶段仍可继续增加、调整或移除物料。"
    />
    <MaterialPlanTable ref="tableRef" :period-id="periodId" :editable="editable" @loaded="handleLoaded" />

    <a-modal
      v-model:open="importModalOpen"
      title="导入用料清单"
      ok-text="导入"
      cancel-text="取消"
      :confirm-loading="importing"
      :ok-button-props="{ disabled: importMode === 'file' ? !uploadFile : !selectedCandidateId }"
      @ok="handleImport"
    >
      <a-radio-group v-model:value="importMode" button-style="solid">
        <a-radio-button value="file">上传文件</a-radio-button>
        <a-radio-button value="quotation">选择已锁定报价单</a-radio-button>
      </a-radio-group>

      <div v-if="importMode === 'file'" class="project-plan-material__import-content">
        <a-upload-dragger accept=".xlsx" :before-upload="handleBeforeUpload" :file-list="uploadFileList" :max-count="1" @remove="handleRemoveFile">
          <p class="ant-upload-drag-icon"><Icon icon="ant-design:file-excel-outlined" /></p>
          <p class="ant-upload-text">点击或拖拽 Excel 文件到此处</p>
          <p class="ant-upload-hint">支持 .xlsx；表格需包含“物料编码”和“计划数量”或“数量”列，仅匹配物料库中已有物料。</p>
        </a-upload-dragger>
      </div>

      <div v-else class="project-plan-material__import-content">
        <a-select
          v-model:value="selectedCandidateId"
          show-search
          allow-clear
          option-filter-prop="label"
          :options="candidateOptions"
          :loading="candidateLoading"
          placeholder="请选择当前分期已锁定的报价单"
          style="width: 100%"
        />
        <a-empty v-if="!candidateLoading && !candidateOptions.length" description="当前分期暂无已锁定报价单" />
      </div>
      <a-alert type="info" show-icon message="导入规则" description="清单中已有的同一物料会更新数量、单位和备注，其他物料会追加。" />
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { Icon } from '/@/components/Icon';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { loadMaterialMap } from '/@/views/material/material.util';
  import MaterialPlanTable from '/@/views/plan/components/MaterialPlanTable.vue';
  import { getMaterialCandidateItemList, getMaterialCandidateList, QUOTATION_STATUS_SUBMITTED } from '/@/views/plan/Plan.api';
  import { parseMaterialPlanExcel } from '/@/views/plan/materialExcel';

  const props = defineProps<{
    periodId?: string;
    editable?: boolean;
  }>();
  const emit = defineEmits<{ 'persisted-change': [persisted: boolean] }>();

  const { createMessage } = useMessage();
  const tableRef = ref();
  const hasContractDraft = ref(false);
  const importModalOpen = ref(false);
  const importMode = ref<'file' | 'quotation'>('file');
  const uploadFile = ref<File>();
  const uploadFileList = ref<any[]>([]);
  const selectedCandidateId = ref<string>();
  const candidateOptions = ref<{ label: string; value: string }[]>([]);
  const candidateLoading = ref(false);
  const importing = ref(false);

  function handleLoaded(count: number) {
    hasContractDraft.value = count > 0;
    if (!importing.value) emit('persisted-change', count > 0);
  }

  async function openImportModal() {
    if (!props.editable) return;
    importMode.value = 'file';
    uploadFile.value = undefined;
    uploadFileList.value = [];
    selectedCandidateId.value = undefined;
    importModalOpen.value = true;
    await loadLockedCandidates();
  }

  async function loadLockedCandidates() {
    if (!props.periodId) {
      candidateOptions.value = [];
      return;
    }
    candidateLoading.value = true;
    try {
      const result: any = await getMaterialCandidateList({ periodId: props.periodId, pageNo: 1, pageSize: 1000 });
      const records = result?.records || result || [];
      candidateOptions.value = records
        .filter((item: any) => String(item.status) === QUOTATION_STATUS_SUBMITTED)
        .map((item: any) => ({ label: item.candidateName || `报价单 ${item.id}`, value: String(item.id) }));
    } catch (error: any) {
      candidateOptions.value = [];
      createMessage.error(error?.message || '已锁定报价单加载失败');
    } finally {
      candidateLoading.value = false;
    }
  }

  function handleBeforeUpload(file: any) {
    uploadFile.value = file;
    uploadFileList.value = [file];
    return false;
  }

  function handleRemoveFile() {
    uploadFile.value = undefined;
    uploadFileList.value = [];
    return true;
  }

  async function resolveExcelMaterials(file: File) {
    const excelRows = await parseMaterialPlanExcel(file);
    const materialMap = await loadMaterialMap();
    const byCode = new Map<string, any>();
    Object.values(materialMap).forEach((material: any) => {
      const code = String(material.materialCode || '')
        .trim()
        .toLowerCase();
      if (code) byCode.set(code, material);
    });
    const missing: string[] = [];
    const rows = excelRows.map((item) => {
      const material = byCode.get(String(item.materialCode).trim().toLowerCase());
      if (!material) {
        missing.push(`第 ${item._excelRowNumber} 行：${item.materialCode}`);
        return undefined;
      }
      return { ...item, materialId: material.id, ...material, plannedQty: item.plannedQty, unit: item.unit, remark: item.remark };
    });
    if (missing.length) throw new Error(`以下物料编码不在物料库中：${missing.slice(0, 5).join('；')}${missing.length > 5 ? '……' : ''}`);
    return rows.filter(Boolean);
  }

  async function resolveQuotationMaterials(candidateId: string) {
    const result: any = await getMaterialCandidateItemList({ candidateId, pageNo: 1, pageSize: 1000 });
    const rows = result?.records || result || [];
    if (!rows.length) throw new Error('所选报价单没有物料明细');
    return rows.map((item: any) => ({
      materialId: item.materialId,
      materialCode: item.materialCode,
      materialCategory: item.materialCategory,
      materialName: item.materialName,
      brand: item.brand,
      model: item.model,
      plannedQty: item.quantity,
      unit: item.unit,
      remark: item.remark,
    }));
  }

  async function handleImport() {
    if (importing.value) return;
    importing.value = true;
    try {
      const records =
        importMode.value === 'file'
          ? await resolveExcelMaterials(uploadFile.value as File)
          : await resolveQuotationMaterials(selectedCandidateId.value as string);
      const result = await tableRef.value?.importRows?.(records);
      importModalOpen.value = false;
      createMessage.success(`导入完成：新增 ${result?.added || 0} 条，更新 ${result?.updated || 0} 条；请保存本页`);
    } catch (error: any) {
      createMessage.error(error?.message || '清单导入失败，请重试');
    } finally {
      importing.value = false;
    }
  }

  defineExpose({
    getData: () => tableRef.value?.getData?.() || [],
    reload: () => tableRef.value?.reload?.(),
  });
</script>

<style lang="less" scoped>
  .project-plan-material__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    color: #595959;
  }

  .project-plan-material__notice {
    margin-bottom: 16px;
  }

  .project-plan-material__import-content {
    min-height: 150px;
    margin: 20px 0 16px;
  }
</style>
