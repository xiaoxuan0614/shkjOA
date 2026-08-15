<template>
  <BasicModal v-bind="$attrs" @register="register" destroyOnClose title="实施日志" :width="760" :footer="null">
    <a-spin :spinning="loading">
      <template v-if="log?.workName">
        <!-- 记录基本信息 -->
        <a-descriptions :column="3" size="small" bordered style="margin-bottom: 16px">
          <a-descriptions-item label="工序名称">{{ log.workName }}</a-descriptions-item>
          <a-descriptions-item label="现场负责人">{{ log.owner }}</a-descriptions-item>
          <a-descriptions-item label="实施日期">{{ log.implementDate }}</a-descriptions-item>
          <a-descriptions-item label="实施工时">{{ log.workHours }}</a-descriptions-item>
          <a-descriptions-item label="实施位置">{{ log.position }}</a-descriptions-item>
          <a-descriptions-item label="提交人">{{ log.submitBy }}</a-descriptions-item>
        </a-descriptions>

        <!-- 时间线日志 -->
        <a-timeline class="log-modal__timeline">
          <a-timeline-item v-for="(item, idx) in log.timeline || []" :key="idx" color="blue">
            <div class="log-modal__tl-text">{{ item.content }}</div>
            <div class="log-modal__tl-time">{{ item.time }}</div>
          </a-timeline-item>
        </a-timeline>

        <!-- 参与人员 -->
        <div v-if="(log.members || []).length" class="log-modal__section">
          <div class="log-modal__section-title">参与人员</div>
          <a-table
            :columns="memberColumns"
            :data-source="log.members"
            :pagination="false"
            size="small"
            bordered
          />
        </div>

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

        <!-- 行车记录 / 用料记录 -->
        <a-descriptions :column="2" size="small" bordered style="margin-top: 16px">
          <a-descriptions-item label="行车记录">
            <template v-if="log.vehicle">
              车辆：{{ log.vehicle }} ｜ 公里数：{{ log.vehicleKm }}
            </template>
            <template v-else>—</template>
          </a-descriptions-item>
          <a-descriptions-item label="用料记录">
            {{ log.materialBrief || '—' }}
          </a-descriptions-item>
        </a-descriptions>
      </template>
      <a-empty v-else description="暂无日志数据" />
    </a-spin>
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref } from 'vue';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { getImplementLog } from '../ProjectDetail.api';

  const props = defineProps<{
    projectId: string;
  }>();

  const loading = ref(false);
  const log = ref<any>({});

  const memberColumns = [
    { title: '内协人员', dataIndex: 'name' },
    { title: '签到时间', dataIndex: 'checkIn' },
    { title: '签退时间', dataIndex: 'checkOut' },
    { title: '工作内容', dataIndex: 'content' },
    { title: '评分', dataIndex: 'score', width: 70, align: 'center' },
  ];

  const [register, { setModalProps }] = useModalInner(async (data) => {
    log.value = {};
    if (!data?.record) return;
    setModalProps({ confirmLoading: false });
    loading.value = true;
    try {
      const res = await getImplementLog({
        projectId: props.projectId,
        id: data.record.id,
      });
      log.value = res || {};
    } finally {
      loading.value = false;
    }
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
    &__timeline {
      margin-top: 8px;
    }

    &__tl-text {
      color: #333;
    }

    &__tl-time {
      color: #999;
      font-size: 12px;
      margin-top: 2px;
    }

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
