<template>
  <div class="detail-member">
    <a-table :columns="columns" :data-source="members" :pagination="false" size="middle" bordered />
  </div>
</template>

<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { getMembers } from '../ProjectDetail.api';

  const props = defineProps<{
    projectId: string;
  }>();

  const members = ref<any[]>([]);

  // 后端 project_member 字段: userName / memberRole / outsourcingFlag / outsourcingUnit
  const columns = [
    { title: '成员名称', dataIndex: 'userName' },
    { title: '成员角色', dataIndex: 'memberRole' },
    { title: '是否外协', dataIndex: 'outsourcingFlag', customRender: ({ text }) => (text ? '是' : '否') },
    { title: '外协单位', dataIndex: 'outsourcingUnit' },
  ];

  async function load() {
    const res: any = await getMembers({ periodId: props.projectId, pageNo: 1, pageSize: 100 });
    const list = res?.records || res || [];
    members.value = list || [];
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>
