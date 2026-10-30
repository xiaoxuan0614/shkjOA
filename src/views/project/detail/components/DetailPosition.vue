<template>
  <div class="detail-position">
    <p>每个项目至少保留1个位置，最多3个。</p>
    <div class="detail-position__toolbar">
      <a-button :disabled="loading || !positions.length" @click="openMap()">查看全部位置</a-button>
      <a-button type="primary" preIcon="ant-design:plus-outlined" :disabled="loading || !!loadError || positions.length >= 3" @click="openAdd">新增位置</a-button>
    </div>
    <a-alert v-if="loadError" type="error" :message="loadError" show-icon />
    <a-table :loading="loading" :columns="columns" :data-source="positions" :pagination="false" size="middle" bordered>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-button
            type="link"
            size="small"
            :disabled="!validCoordinates(record)"
            :title="validCoordinates(record) ? '在地图上查看位置' : '该位置缺少有效经纬度'"
            @click="openMap(record)"
            >查看地图</a-button
          >
          <a-button type="link" size="small" @click="openEdit(record)">编辑</a-button>
          <a-popconfirm :disabled="positions.length <= 1 || deleting" title="是否确认删除" @confirm="handleDelete(record)">
            <a-button type="link" size="small" danger :disabled="positions.length <= 1 || deleting">删除</a-button>
          </a-popconfirm>
        </template>
      </template>
    </a-table>

    <LocationViewModal v-model:open="mapOpen" :records="positions" :selected-id="mapRecord?.id" title="实施位置总览" />

    <!-- 新增/编辑弹窗 -->
    <PositionModal v-model:open="editorOpen" :project-id="projectId" :record="editingRecord" @success="load" />
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch, onBeforeUnmount } from 'vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getPositions, deletePosition } from '../ProjectDetail.api';
  import PositionModal from './PositionModal.vue';
  import LocationViewModal from '/@/components/jeecg/LocationViewModal.vue';

  const props = defineProps<{
    projectId: string;
  }>();

  const { createMessage } = useMessage();
  const positions = ref<any[]>([]);
  const mapOpen = ref(false);
  const mapRecord = ref<any | null>(null);
  const editorOpen = ref(false);
  const editingRecord = ref<any | null>(null);

  // 后端 project_location 字段
  const columns = [
    { title: '实施位置', dataIndex: 'locationName' },
    { title: '经度', dataIndex: 'longitude' },
    { title: '纬度', dataIndex: 'latitude' },
    { title: '位置描述', dataIndex: 'description' },
    { title: '操作', key: 'action', width: 210, align: 'center' },
  ];

  const loading=ref(false), loadError=ref(''), deleting=ref(false);
  let loadSequence=0;
  async function load() {
    const seq=++loadSequence, periodId=props.projectId;
    positions.value=[];mapOpen.value=false;mapRecord.value=null;loading.value=true;loadError.value='';
    try {
      const all:any[]=[];
      for(let pageNo=1;pageNo<=1000;pageNo++) {
        const result:any=await getPositions({periodId,pageNo,pageSize:100});
        if(seq!==loadSequence)return;
        const total=Number(result?.total);
        if(!Array.isArray(result?.records)||!Number.isSafeInteger(total)||total<0)throw new Error('位置分页信息异常，请刷新重试');
        all.push(...result.records);
        if(all.length>=total){positions.value=all;return;}
        if(!result.records.length)throw new Error('位置未读取完整，请刷新重试');
      }
      throw new Error('位置数量超出读取范围，请联系管理员');
    }catch(e){if(seq===loadSequence)loadError.value=(e as Error).message;}
    finally{if(seq===loadSequence)loading.value=false;}
  }
  onBeforeUnmount(()=>{++loadSequence;});

  function coordinate(raw: unknown): number | null {
    if (raw == null || String(raw).trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function validCoordinates(record: any): boolean {
    const lng = coordinate(record.longitude);
    const lat = coordinate(record.latitude);
    return lng != null && lat != null && Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
  }

  function openMap(record?: any) {
    mapRecord.value = record ? { ...record } : null;
    mapOpen.value = true;
  }

  function openAdd() {
    if(loading.value || loadError.value || positions.value.length>=3)return;
    editingRecord.value = null;
    editorOpen.value = true;
  }

  function openEdit(record: any) {
    editingRecord.value = { ...record };
    editorOpen.value = true;
  }

  async function handleDelete(record: any) {
    if(deleting.value)return;
    deleting.value=true;
    try {
      const latest:any=await getPositions({periodId:props.projectId,pageNo:1,pageSize:1});
      const count=Number(latest?.total);
      if(!Number.isSafeInteger(count)||count<0)throw new Error('无法确认位置数量，请刷新重试');
      if(count<=1)throw new Error('每个项目至少保留1个位置，不能删除最后一个');
      await deletePosition({ id: record.id });
      createMessage.success(`删除位置「${record.locationName}」成功`);
      await load();
    }catch(e){createMessage.error((e as Error).message);}finally{deleting.value=false;}
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>

<style lang="less" scoped>
  .detail-position {
    &__toolbar {
      margin-bottom: 12px;
      display: flex;
      gap: 12px;
    }
  }
</style>
