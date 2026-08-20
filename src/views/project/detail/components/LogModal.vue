<template>
  <BasicModal v-bind="$attrs" @register="register" destroyOnClose title="实施记录详情" :width="760" :footer="null">
    <a-descriptions v-if="log" :column="2" size="small" bordered>
      <a-descriptions-item label="实施日期">{{ log.logDate || '—' }}</a-descriptions-item>
      <a-descriptions-item label="提交人">{{ log.submitterName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="工作内容" :span="2">{{ log.workContent || '—' }}</a-descriptions-item>
      <a-descriptions-item label="工时">{{ log.hours || '—' }}</a-descriptions-item>
      <a-descriptions-item label="实施位置">{{ log.locationName || '—' }}</a-descriptions-item>
      <a-descriptions-item label="签到时间">{{ log.signInTime || '—' }}</a-descriptions-item>
      <a-descriptions-item label="签退时间">{{ log.signOutTime || '—' }}</a-descriptions-item>
      <a-descriptions-item label="车辆">{{ log.vehicleNo || '—' }}</a-descriptions-item>
      <a-descriptions-item label="公里数">{{ log.mileage || '—' }}</a-descriptions-item>
      <a-descriptions-item label="外协单位">{{ log.outsourcingUnit || '—' }}</a-descriptions-item>
      <a-descriptions-item label="外协人数">{{ log.outsourcingPeople || '—' }}</a-descriptions-item>
      <a-descriptions-item label="外协工时">{{ log.outsourcingHours || '—' }}</a-descriptions-item>
      <a-descriptions-item label="备注">{{ log.remark || '—' }}</a-descriptions-item>
    </a-descriptions>

    <!-- 现场照片 -->
    <div v-if="getPhotos().length" class="log-modal__section">
      <div class="log-modal__section-title">现场照片</div>
      <a-image
        v-for="(img, i) in getPhotos()"
        :key="i"
        :src="img"
        :width="90"
        :height="90"
        style="margin-right: 8px; object-fit: cover; border-radius: 4px"
      />
    </div>
    <a-empty v-if="!log || !Object.keys(log).length" description="暂无日志数据" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';

  const log = ref<any>({});

  const [register] = useModalInner(async (data) => {
    log.value = data?.record || {};
  });

  function getPhotos(): string[] {
    const val = log.value?.photos;
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return String(val)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
</script>

<style lang="less" scoped>
  .log-modal {
    &__section {
      margin-top: 16px;

      &-title {
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin-bottom: 8px;
      }
    }
  }
</style>
