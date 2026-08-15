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

  const columns = [
    { title: '成员名称', dataIndex: 'name' },
    { title: '成员角色', dataIndex: 'role' },
  ];

  async function load() {
    const data = await getMembers({ projectId: props.projectId });
    members.value = data || [];
  }

  watch(
    () => props.projectId,
    () => load(),
    { immediate: true }
  );
</script>
