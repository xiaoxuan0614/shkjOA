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
        <template v-else-if="column.key === 'locationName'">
          <AMapLocationSelect
            :value="record.locationName"
            :lng="record.longitude"
            :lat="record.latitude"
            :disabled="!editable"
            placeholder="点击地图选点"
            @update:value="(v: string) => (record.locationName = v)"
            @select="(poi: AmapPoi | null) => onSelectPoi(record, poi)"
          />
        </template>
        <template v-else-if="column.key === 'longitude'">
          <a-input-number v-model:value="record.longitude" :disabled="!editable" placeholder="经度" style="width: 100%" />
        </template>
        <template v-else-if="column.key === 'latitude'">
          <a-input-number v-model:value="record.latitude" :disabled="!editable" placeholder="纬度" style="width: 100%" />
        </template>
        <template v-else-if="column.key === 'description'">
          <a-input v-model:value="record.description" :disabled="!editable" placeholder="位置描述" />
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
  import AMapLocationSelect from '/@/components/jeecg/AMapLocationSelect.vue';
  import { AmapPoi } from '/@/components/jeecg/AMapPlaceSearch.vue';

  // 属性: editable 控制是否可编辑
  defineProps<{
    editable?: boolean;
  }>();

  // 地图搜索选中后填充行内经纬度/描述
  function onSelectPoi(record: any, poi: AmapPoi | null) {
    if (!poi) {
      record.longitude = undefined;
      record.latitude = undefined;
      record.description = '';
      return;
    }
    record.locationName = poi.address || poi.name;
    record.longitude = poi.lng;
    record.latitude = poi.lat;
    record.description = poi.address || poi.name;
  }

  // 字段对齐后端 project_location: locationName/longitude/latitude/description
  const columns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '实施位置', key: 'locationName', width: 160 },
    { title: '经度', key: 'longitude', width: 120 },
    { title: '纬度', key: 'latitude', width: 120 },
    { title: '位置描述', key: 'description' },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const positionList = ref<any[]>([]);
  let positionSeed = 0;

  // 暴露给父级(行数组, 父级映射为 project_location 实体 + periodId)
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
    positionList.value.push({ _key: ++positionSeed, locationName: '', longitude: undefined, latitude: undefined, description: '' });
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
