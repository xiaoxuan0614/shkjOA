<template>
  <div class="project-plan-material">
    <div v-if="editable" class="project-plan-material__toolbar">
      <a-button preIcon="ant-design:import-outlined" @click="openImportModal">导入清单</a-button>
      <span>首次自动带入合同已采用报价，合同物料不可删除、数量只能在合同量上增加；可追加物料；保存本页后生效。</span>
    </div>
    <a-alert
      v-if="hasContractDraft"
      class="project-plan-material__notice"
      type="info"
      show-icon
      message="已载入本分期的计划用料清单"
      description="合同物料不可移除，计划数量不得低于合同量；追加物料可正常调整或移除。"
    />
    <a-spin :spinning="importing" tip="正在带入物料，请稍候">
      <MaterialPlanTable
        ref="tableRef"
        :period-id="periodId"
        :editable="editable"
        :contract-loading="importing || initializationFailed"
        :contract-items="contractItems"
        @loaded="handleLoaded"
      />
    </a-spin>

    <a-modal
      v-model:open="importModalOpen"
      title="导入用料清单"
      ok-text="导入"
      cancel-text="取消"
      :confirm-loading="importing"
      :ok-button-props="{ disabled: !uploadFile }"
      @ok="handleImport"
    >
      <div class="project-plan-material__import-content">
        <a-upload-dragger accept=".xlsx" :before-upload="handleBeforeUpload" :file-list="uploadFileList" :max-count="1" @remove="handleRemoveFile">
          <p class="ant-upload-drag-icon"><Icon icon="ant-design:file-excel-outlined" /></p>
          <p class="ant-upload-text">点击或拖拽 Excel 文件到此处</p>
          <p class="ant-upload-hint">支持 .xlsx；表格需包含“物料编码”和“计划数量”或“数量”列，仅匹配物料库中已有物料。</p>
        </a-upload-dragger>
      </div>

      <a-alert type="info" show-icon message="导入规则" description="清单中已有的同一物料会更新数量、单位和备注，其他物料会追加。" />
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch, nextTick } from 'vue';
  import { Icon } from '/@/components/Icon';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { loadMaterialMap } from '/@/views/material/material.util';
  import MaterialPlanTable from '/@/views/plan/components/MaterialPlanTable.vue';
  import { getAllMaterialCandidates, getAllMaterialCandidateItems, isQuotationAdopted } from '/@/views/plan/Plan.api';
  import { parseMaterialPlanExcel } from '/@/views/plan/materialExcel';

  const props = defineProps<{
    periodId?: string;
    editable?: boolean;
  }>();
  const emit = defineEmits<{ 'persisted-change': [persisted: boolean] }>();

  const { createMessage } = useMessage();
  const tableRef = ref();
  const hasContractDraft = ref(false);
  const contractItems = ref<Recordable[]>([]);
  const importModalOpen = ref(false);
  const uploadFile = ref<File>();
  const uploadFileList = ref<any[]>([]);
  const importing = ref(false);
  let initializationAttempted = false;
  const initializationFailed = ref(false);

  async function handleLoaded(count: number) {
    hasContractDraft.value = count > 0;
    if (!importing.value) emit('persisted-change', count > 0);
    await nextTick();
    if (!initializationAttempted && props.editable && props.periodId) void initializeFromAdoptedQuotation();
  }

  async function initializeFromAdoptedQuotation() {
    initializationAttempted = true;
    importing.value = true;
    initializationFailed.value = false;
    const periodId = props.periodId!;
    try {
      const candidates = await getAllMaterialCandidates(periodId);
      if (periodId !== props.periodId) return;
      const adopted = candidates.filter((item) => isQuotationAdopted(item));
      if (adopted.length > 1) throw new Error('当前分期存在多张已采用报价，无法自动带入');
      if (!adopted.length) return;
      const items = await getAllMaterialCandidateItems(String(adopted[0].id));
      if (periodId !== props.periodId) return;
      if (!items.length) throw new Error('已采用报价没有物料明细，请核对报价');
      contractItems.value = items;
      // 已有计划也必须识别合同来源；缺失的合同物料重新补入，不覆盖已有数量。
      const existingIds = tableRef.value?.getMaterialIds?.() || [];
      const missingItems = items.filter((item) => !existingIds.includes(String(item.materialId)));
      if (!missingItems.length) return;
      await tableRef.value?.importRows(
        missingItems.map((item) => ({
          materialId: item.materialId,
          unitId: item.unitId,
          unit: item.unit,
          plannedQty: item.quantity,
          remark: item.remark,
        }))
      );
      emit('persisted-change', false);
    } catch (error: any) {
      initializationFailed.value = true;
      createMessage.error(error?.message || '报价物料自动带入失败，请刷新重试');
    } finally {
      importing.value = false;
    }
  }

  function openImportModal() {
    if (!props.editable || importing.value || initializationFailed.value) return;
    uploadFile.value = undefined;
    uploadFileList.value = [];
    importModalOpen.value = true;
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

  async function handleImport() {
    if (!props.editable) return createMessage.warning('当前计划已锁定，无法再导入物料');
    if (importing.value) return;
    importing.value = true;
    try {
      const records = await resolveExcelMaterials(uploadFile.value as File);
      const result = await tableRef.value?.importRows?.(records);
      importModalOpen.value = false;
      createMessage.success(`导入完成：新增 ${result?.added || 0} 条，更新 ${result?.updated || 0} 条；请保存本页`);
    } catch (error: any) {
      createMessage.error(error?.message || '清单导入失败，请重试');
    } finally {
      importing.value = false;
    }
  }

  watch(
    () => props.periodId,
    () => {
      contractItems.value = [];
      initializationAttempted = false;
      initializationFailed.value = false;
    }
  );

  function getSubmissionState() {
    const tableState = tableRef.value?.getSubmissionState?.() || {
      loading: false,
      loaded: false,
      loadFailed: false,
      saving: false,
      dirty: false,
      hasData: false,
    };
    return {
      ...tableState,
      loadFailed: tableState.loadFailed || initializationFailed.value,
      loading: Boolean(tableState.loading || importing.value),
      saving: Boolean(tableState.saving || importing.value),
    };
  }

  defineExpose({
    getData: () => {
      if (importing.value || initializationFailed.value) throw new Error('报价物料尚未成功带入，请刷新重试');
      return tableRef.value?.getData?.() || [];
    },
    reload: () => tableRef.value?.reload?.(),
    getSubmissionState,
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
