<template>
  <div class="project-apply" @input.capture="scheduleDraft" @change.capture="scheduleDraft">
    <!-- 申请信息 -->
    <div class="project-apply__card">
      <a-alert v-if="!editId" type="info" show-icon class="project-apply__mode">
        <template #message>{{ createModeTitle }}</template>
        <template #description>
          <span v-if="isPeriodCreate">所属主项目：{{ selectedMainProjectName || '加载中…' }}</span>
          <span v-else>请填写新的主项目及首个分期信息，保存后将一次创建完成。</span>
        </template>
      </a-alert>
      <BasicForm @register="registerForm">
        <template #attachment>
          <div class="project-apply__attachment">
            <a-upload
              :accept="PROJECT_ATTACHMENT_ACCEPT"
              :file-list="attachmentFileList"
              :multiple="false"
              :max-count="1"
              :before-upload="handleBeforeAttachmentUpload"
              @preview="handleAttachmentPreview"
              @remove="handleRemoveAttachment"
            >
              <a-button v-if="!attachmentFileList.length">选择文件</a-button>
            </a-upload>
          </div>
        </template>
      </BasicForm>
    </div>

    <!-- 底部操作 -->
    <div class="project-apply__footer">
      <a-button type="primary" preIcon="ant-design:save-outlined" :loading="saving" @click="handleSave">保存</a-button>
      <a-button @click="handleCancel">取消</a-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref, onMounted, onBeforeUnmount, onDeactivated, onActivated } from 'vue';
  import type { UploadFile } from 'ant-design-vue';
  import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { AmapPoi } from '/@/components/jeecg/AMapPlaceSearch.vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { useUserStore } from '/@/store/modules/user';
  import { PROJECT_ATTACHMENT_ACCEPT, isProjectAttachmentFile, projectFormSchema } from '../Project.data';
  import { addProject, editProject, projectDetail, getCustomerList, getMainProjectList } from '../Project.api';
  import { loadUserOptions } from '/@/views/resource/userOptions';
  import { previewFileInModal } from '/@/utils/filePreview';
  import { projectCreateDraftKey, readProjectCreateDraft, saveProjectCreateDraft, removeProjectCreateDraft } from '/@/utils/projectCreateDraft';

  const router = useRouter();
  const route = useRoute();
  const { createMessage } = useMessage();
  const userStore = useUserStore();
  const saving = ref(false);
  const selectedAttachment = ref<File>();
  const attachmentFileList = ref<UploadFile[]>([]);
  const existingAttachmentPath = ref('');
  const attachmentReplacementRequired = ref(false);

  // 编辑模式(带 id 时为编辑回显, id 即分期ID)
  const editId = ref<string | undefined>(route.query?.id as string | undefined);
  const createMode = computed(() => (route.query?.mode === 'period' ? 'period' : 'project'));
  const isPeriodCreate = computed(() => !editId.value && createMode.value === 'period');
  const selectedParentProjectId = computed(() => String(route.query?.parentProjectId || ''));
  const selectedMainProjectName = ref('');
  const createModeTitle = computed(() => (isPeriodCreate.value ? '已有主项目下新增分期' : '新建主项目'));

  // 客户列表(甲方选择带出)
  let customerMap: Recordable = {};

  // 主项目列表(分期: 选择所属主项目带出主项目名称)
  let mainProjectMap: Recordable = {};

  // 项目对接人: id → 姓名
  let liaisonNameMap: Recordable = {};

  // 注册表单
  const [registerForm, { setFieldsValue, getFieldsValue, resetFields, validate, updateSchema }] = useForm({
    labelWidth: 120,
    schemas: projectFormSchema.map((schema) =>
      schema.field === 'projectName' ? { ...schema, dynamicDisabled: () => isPeriodCreate.value } : schema
    ),
    showActionButtonGroup: false,
    baseColProps: { span: 12 },
    baseRowStyle: { padding: '0 20px' },
  });

  const draftToken = userStore.getToken;
  const draftUser: any = userStore.getUserInfo;
  const draftKey = projectCreateDraftKey(String(draftUser.id || draftUser.userId || ''), String(draftUser.loginTenantId || ''), createMode.value, selectedParentProjectId.value);
  let draftReady = false;
  let disposed = false;
  let draftFinished = false;
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  let storageWarningShown = false;
  function persistDraft() {
    if (editId.value || !draftReady || draftFinished || userStore.getToken !== draftToken) return;
    try { saveProjectCreateDraft(draftKey, getFieldsValue(), selectedAttachment.value); }
    catch {
      if (!storageWarningShown) createMessage.warning('浏览器草稿缓存不可用，请保存后再离开页面');
      storageWarningShown = true;
    }
  }
  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(persistDraft, 250);
  }
  function clearDraft() {
    draftFinished = true;
    clearTimeout(draftTimer);
    removeProjectCreateDraft(draftKey);
  }
  onBeforeRouteLeave(() => { persistDraft(); });
  onActivated(async () => {
    if (!draftFinished || editId.value) return;
    await resetFields();
    selectedAttachment.value = undefined;
    attachmentFileList.value = [];
    await loadMainProjects();
    await loadLiaisons();
    draftFinished = false;
  });
  onDeactivated(persistDraft);
  onBeforeUnmount(() => {
    persistDraft();
    disposed = true;
    clearTimeout(draftTimer);
    window.removeEventListener('pagehide', persistDraft);
  });

  /**
   * 加载主项目列表, 注入「所属主项目」下拉(未选/不选则为新建主项目)
   */
  async function loadMainProjects() {
    const res: any = await getMainProjectList({ pageNo: 1, pageSize: 1000 });
    const data = res?.records || res || [];
    mainProjectMap = (data || []).reduce((map, p) => {
      map[p.id] = p;
      return map;
    }, {});
    await updateSchema({
      field: 'projectId',
      ifShow: () => !!editId.value,
      componentProps: {
        options: (data || []).map((p) => ({ label: p.projectName, value: p.id })),
        showSearch: true,
        optionFilterProp: 'label',
        placeholder: '不选则本记录作为主项目',
        onChange: handleParentChange,
      },
    });
    if (isPeriodCreate.value) {
      const parent = mainProjectMap[selectedParentProjectId.value];
      if (!parent) {
        createMessage.error('所选主项目不存在或已失效，请重新选择');
        await router.replace('/project/list');
        return;
      }
      selectedMainProjectName.value = parent.projectName || '';
      await setFieldsValue({ projectId: parent.id, projectName: parent.projectName || '' });
    }
  }

  /**
   * 选择所属主项目后, 带出主项目名称(只读)
   */
  async function handleParentChange(id: any) {
    const p = mainProjectMap[id];
    await setFieldsValue({ projectName: p ? p.projectName : '' });
  }

  /**
   * 加载客户列表, 注入甲方名称下拉
   */
  async function loadCustomers() {
    const res: any = await getCustomerList();
    const data = res?.records || res || [];
    customerMap = (data || []).reduce((map, c) => {
      map[c.id] = c;
      return map;
    }, {});
    await updateSchema({
      field: 'customerId',
      componentProps: {
        options: (data || []).map((c) => ({ label: c.customerName || c.name, value: c.id })),
        showSearch: true,
        optionFilterProp: 'label',
        placeholder: '请选择客户',
        onChange: handleCustomerChange,
      },
    });
  }

  /**
   * 选客户后带出联系人/电话/甲方信息
   */
  async function handleCustomerChange(id: any) {
    const c = customerMap[id];
    if (!c) return;
    await setFieldsValue({
      contactPerson: c.contactPerson || c.contact,
      contactPhone: c.contactPhone || c.phone,
      customerInfo: c.customerInfo || c.info,
    });
  }

  /**
   * 加载项目对接人用户下拉；新增时默认当前操作人。
   */
  async function loadLiaisons() {
    const users = await loadUserOptions();
    liaisonNameMap = (users || []).reduce((map, u) => {
      map[u.value] = u.label;
      return map;
    }, {});
    await updateSchema({
      field: 'projectLiaisonUserId',
      componentProps: { options: users || [], showSearch: true, optionFilterProp: 'label', placeholder: '请选择项目对接人' },
    });
    if (!editId.value) {
      const user: any = userStore.getUserInfo;
      const currentUserId = String(user?.id ?? user?.userId ?? '');
      if (currentUserId) await setFieldsValue({ projectLiaisonUserId: currentUserId });
    }
  }

  /**
   * 编辑回显
   * ⚠️ 多选字段(业务属性/涉及产品清单)后端存逗号分隔字符串, 表单需要数组 → 拆分回显
   */
  async function loadDetail() {
    if (!editId.value) return;
    const data = await projectDetail({ periodId: editId.value });
    const user: any = userStore.getUserInfo;
    const currentUserId = String(user?.id ?? user?.userId ?? '');
    if (!currentUserId || String(data?.projectLiaisonUserId ?? '') !== currentUserId) {
      createMessage.warning('仅指定的项目对接人可以修改项目基本信息');
      await router.replace(`/project/detail/${editId.value}`);
      return;
    }
    const values: Recordable = { ...data };
    existingAttachmentPath.value = String(data?.attachmentFileId || '');
    attachmentReplacementRequired.value = false;
    attachmentFileList.value = existingAttachmentPath.value
      ? [
          {
            uid: `existing-${editId.value}`,
            name: getAttachmentName(existingAttachmentPath.value),
            status: 'done',
            url: existingAttachmentPath.value,
          },
        ]
      : [];
    ['businessAttribute', 'involvedProducts'].forEach((f) => {
      if (typeof values[f] === 'string' && values[f]) {
        values[f] = values[f].split(',').filter(Boolean);
      }
    });
    await setFieldsValue(values);
    // 回显经纬度到地图选点组件(打开弹窗时地图定位到该点)
    await updateSchema({
      field: 'projectAddress',
      componentProps: { lng: data.longitude ?? null, lat: data.latitude ?? null },
    });
  }

  /**
   * 高德搜索选中地址后, 把经纬度写入隐藏字段随保存提交
   */
  async function loadAddressSelect() {
    await updateSchema({
      field: 'projectAddress',
      componentProps: {
        onSelect: (poi: AmapPoi | null) => {
          setFieldsValue(poi ? { longitude: poi.lng, latitude: poi.lat } : { longitude: undefined, latitude: undefined });
        },
      },
    });
  }

  function handleBeforeAttachmentUpload(file: File & { uid?: string }) {
    if (!isProjectAttachmentFile(file)) {
      createMessage.warning('只能上传 Word、PPT、Excel、PDF 或图片文件');
      return false;
    }
    selectedAttachment.value = file;
    attachmentReplacementRequired.value = false;
    attachmentFileList.value = [
      {
        uid: file.uid || `${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        originFileObj: file as any,
      },
    ];
    scheduleDraft();
    return false;
  }

  function handleRemoveAttachment() {
    selectedAttachment.value = undefined;
    attachmentFileList.value = [];
    attachmentReplacementRequired.value = !!existingAttachmentPath.value;
    scheduleDraft();
    return true;
  }

  function handleAttachmentPreview(file: UploadFile) {
    previewFileInModal(file);
  }

  function getAttachmentName(path: string) {
    return decodeURIComponent(path.split('/').pop() || path);
  }

  /**
   * 保存：有新附件时先公共上传，再将路径随业务 JSON 保存。
   */
  async function handleSave() {
    try {
      saving.value = true;
      const values = await validate();
      if (isPeriodCreate.value && !selectedParentProjectId.value) {
        createMessage.warning('缺少所属主项目，请返回项目列表重新选择');
        return;
      }
      if (attachmentReplacementRequired.value && !selectedAttachment.value) {
        createMessage.warning('已移除原附件，请先选择新文件后再保存');
        return;
      }
      // 附件路径由 API 封装在公共上传成功后填入，避免提交表单中的旧值。
      delete values.attachmentFileId;
      const { projectId: _projectId, projectName, periodName, ...rest } = values;
      // 多选字段: 数组 → 逗号分隔字符串(对齐后端存储格式)
      const submitValues: Recordable = { ...rest };
      ['businessAttribute', 'involvedProducts'].forEach((f) => {
        if (Array.isArray(submitValues[f])) {
          submitValues[f] = submitValues[f].join(',');
        }
      });
      const base = {
        ...submitValues,
        projectLiaisonUserName: liaisonNameMap[rest.projectLiaisonUserId] || '',
        customerName: customerMap[rest.customerId]?.customerName || customerMap[rest.customerId]?.name || '',
      };
      if (editId.value) {
        // 编辑主项目+分期
        await editProject({ ...base, projectName, periodId: editId.value, periodName }, selectedAttachment.value);
      } else {
        // parentProjectId 为空时新建主项目，存在时给已有主项目新增分期。
        await addProject(
          {
            ...base,
            parentProjectId: isPeriodCreate.value ? selectedParentProjectId.value : undefined,
            projectName,
            periodName,
          },
          selectedAttachment.value
        );
      }
      createMessage.success('保存成功');
      clearDraft();
      router.push('/project/list');
    } catch (error) {
      // 校验失败/接口异常
    } finally {
      saving.value = false;
    }
  }

  /**
   * 取消
   */
  function handleCancel() {
    clearDraft();
    router.push('/project/list');
  }

  onMounted(async () => {
    await loadCustomers();
    await loadMainProjects();
    await loadLiaisons();
    await loadAddressSelect();
    if (disposed) return;
    if (editId.value) {
      await loadDetail();
    } else if (userStore.getToken === draftToken) {
      const draft = readProjectCreateDraft(draftKey);
      if (draft) {
        const values = { ...draft.values };
        for (const field of ['businessAttribute', 'involvedProducts']) {
          if (typeof values[field] === 'string') values[field] = values[field].split(',').filter(Boolean);
        }
        if (isPeriodCreate.value) {
          values.projectId = selectedParentProjectId.value;
          values.projectName = selectedMainProjectName.value;
        }
        await setFieldsValue(values);
        await updateSchema({ field: 'projectAddress', componentProps: { lng: values.longitude ?? null, lat: values.latitude ?? null } });
        if (draft.file) handleBeforeAttachmentUpload(draft.file);
        else if (draft.attachmentName) createMessage.warning(`表单草稿已恢复，请重新选择附件：${draft.attachmentName}`);
      }
      draftReady = true;
    }
    window.addEventListener('pagehide', persistDraft);
  });
</script>

<style lang="less" scoped>
  .project-apply {
    padding: 16px;

    &__card {
      background: #fff;
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 16px;
    }

    &__mode {
      margin: 0 20px 20px;
    }

    &__footer {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 8px 0 24px;
    }

    &__attachment-existing {
      margin-top: 8px;
      color: #595959;
      line-height: 22px;
    }
  }
</style>
