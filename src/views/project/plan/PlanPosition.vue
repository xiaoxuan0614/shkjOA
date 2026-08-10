<template>
  <div class="plan-position">
    <!-- 实施位置 -->
    <div class="plan-position__group-title">
      <span>实施位置</span>
      <a-button v-if="editable" type="primary" size="small" preIcon="ant-design:plus-outlined" @click="addPosition">添加</a-button>
    </div>
    <a-table
      :columns="columns"
      :data-source="positionList"
      :row-key="(record) => record._key"
      :pagination="false"
      size="middle"
      bordered
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'index'">
          {{ record._key }}
        </template>
        <template v-else-if="column.key === 'place'">
          <a-input v-model:value="record.place" :disabled="!editable" placeholder="请输入实施位置" />
        </template>
        <template v-else-if="column.key === 'lng'">
          <a-input-number v-model:value="record.lng" :disabled="!editable" placeholder="经度" style="width: 100%" />
        </template>
        <template v-else-if="column.key === 'lat'">
          <a-input-number v-model:value="record.lat" :disabled="!editable" placeholder="纬度" style="width: 100%" />
        </template>
        <template v-else-if="column.key === 'desc'">
          <a-input v-model:value="record.desc" :disabled="!editable" placeholder="位置描述" />
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button v-if="editable" type="link" danger size="small" @click="removePosition(record._key)">删除</a-button>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
  import { ref, unref } from 'vue';

  // 属性: editable 控制是否可编辑
  defineProps<{
    editable?: boolean;
  }>();

  const columns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '实施位置', key: 'place', width: 160 },
    { title: '经度', key: 'lng', width: 120 },
    { title: '纬度', key: 'lat', width: 120 },
    { title: '位置描述', key: 'desc' },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const positionList = ref<any[]>([]);
  let positionSeed = 0;

  // 暴露给父级
  defineExpose({
    getData() {
      return unref(positionList);
    },
    setData(list: any[]) {
      positionList.value = (list || []).map((item) => ({ ...item, _key: ++positionSeed }));
    },
  });

  // 添加位置
  function addPosition() {
    positionList.value.push({ _key: ++positionSeed, place: '', lng: undefined, lat: undefined, desc: '' });
  }

  // 移除位置
  function removePosition(key: number) {
    positionList.value = positionList.value.filter((p) => p._key !== key);
  }
</script>

<style lang="less" scoped>
  .plan-position {
    &__group-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      font-size: 14px;
      color: #333;
      margin-bottom: 12px;
    }
  }
</style>
