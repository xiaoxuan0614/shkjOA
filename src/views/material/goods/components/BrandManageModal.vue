<template>
  <BasicModal v-bind="$attrs" @register="register" :title="`${itemLabel}管理`" :width="720" :showOkBtn="false" cancelText="关闭">
    <a-alert v-if="error" type="error" :message="error" show-icon style="margin-bottom: 12px" />
    <a-space style="margin-bottom: 12px">
      <a-button type="primary" :disabled="!dictId || loading || !!error" @click="openItem(true, { isUpdate: false })">新增{{ itemLabel }}</a-button>
      <a-button :loading="loading" @click="load">刷新</a-button>
      <a-input v-model:value="keyword" :placeholder="`搜索${itemLabel}名称`" :aria-label="`搜索${itemLabel}名称`" allow-clear />
    </a-space>
    <a-table :columns="columns" :data-source="filteredRows" row-key="id" :loading="loading" :pagination="withPagination({ pageSize: 10 })" size="small" />
  </BasicModal>
  <DictItemModal :dictId="dictId" @register="registerItem" @created="handleCreated" />
</template>
<script setup lang="ts">
  import { withPagination } from '/@/components/Pagination/config';
  import { ref, computed } from 'vue';
  import { BasicModal, useModal, useModalInner } from '/@/components/Modal';
  import DictItemModal from '/@/views/system/dict/components/DictItemModal.vue';
  import { list, itemList } from '/@/views/system/dict/dict.api';
  import { useMessage } from '/@/hooks/web/useMessage';
  const props = withDefaults(defineProps<{ dictCode?: string; itemLabel?: string }>(), { dictCode: 'material_brand', itemLabel: '品牌' });
  const emit = defineEmits(['register', 'updated', 'created']);
  const { createMessage } = useMessage();
  const dictId = ref('');
  const rows = ref<any[]>([]);
  const loading = ref(false);
  const error = ref('');
  const keyword = ref('');
  const filteredRows = computed(() => rows.value.filter(row => String(row.itemText || '').toLowerCase().includes(keyword.value.trim().toLowerCase())));
  const columns = computed(() => [
    { title: `${props.itemLabel}名称`, dataIndex: 'itemText' },
    { title: `${props.itemLabel}编码`, dataIndex: 'itemValue' },
    { title: '状态', dataIndex: 'status', customRender: ({ text }) => String(text) === '1' ? '启用' : '停用' },
  ]);
  const [registerItem, { openModal: openItem }] = useModal();
  const [register] = useModalInner(async () => {
    keyword.value = '';
    dictId.value = '';
    rows.value = [];
    await load();
  });
  async function readAll(api, params) {
    const result: any[] = [];
    for (let pageNo = 1; ; pageNo++) {
      const data = await api({ ...params, pageNo, pageSize: 100 });
      if (!Array.isArray(data?.records)) throw new Error(`${props.itemLabel}字典返回格式异常`);
      const page = data.records;
      if (page.length && page.every(row => result.some(previous => previous.id === row.id))) throw new Error(`${props.itemLabel}字典分页异常`);
      result.push(...page);
      if (!page.length || (data.total != null ? result.length >= Number(data.total) : page.length < 100)) return result;
    }
  }
  async function load() {
    if (loading.value) return;
    loading.value = true;
    error.value = '';
    try {
      const dictionaries = (await readAll(list, { dictCode: props.dictCode })).filter(row => row.dictCode === props.dictCode);
      if (dictionaries.length !== 1) throw new Error(`未找到唯一的${props.itemLabel}字典，请联系管理员`);
      dictId.value = dictionaries[0].id;
      rows.value = await readAll(itemList, { dictId: dictId.value });
      emit('updated', rows.value);
    } catch (e: any) {
      error.value = e?.message || `${props.itemLabel}加载失败，请检查字典访问权限后重试`;
    } finally {
      loading.value = false;
    }
  }
  async function openCreate() {
    if (loading.value) return;
    await load();
    if (error.value || !dictId.value) {
      createMessage.error(error.value || `${props.itemLabel}字典加载失败`);
      return;
    }
    openItem(true, { isUpdate: false });
  }
  defineExpose({ openCreate });
  async function handleCreated(values: any) {
    createMessage.success(`${props.itemLabel}已创建`);
    await load();
    if (error.value) createMessage.warning(`${props.itemLabel}已创建，但刷新失败，请刷新页面后选择；不要重复新增`);
    else {
      const created = rows.value.find(row => String(row.itemValue) === String(values?.itemValue) && String(row.status) === '1');
      if (created) emit('created', String(created.itemValue), created);
      else createMessage.warning(`新增${props.itemLabel}未启用或尚未回显，请刷新后选择`);
    }
  }
</script>
