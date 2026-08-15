<template>
  <div class="implement-detail">
    <a-card class="implement-detail__card">
      <div class="implement-detail__header">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="goBack">返回</a-button>
        <span class="implement-detail__title">实施记录详情</span>
      </div>

      <a-spin :spinning="loading">
        <template v-if="log.workName">
          <!-- 实施记录信息 -->
          <a-descriptions :column="2" bordered size="middle" style="margin-bottom: 16px">
            <a-descriptions-item label="工序名称">{{ log.workName }}</a-descriptions-item>
            <a-descriptions-item label="实施日期">{{ log.implementDate }}</a-descriptions-item>
            <a-descriptions-item label="实施位置">{{ log.position }}</a-descriptions-item>
            <a-descriptions-item label="工时">{{ log.workHours }}</a-descriptions-item>
            <a-descriptions-item label="实施内容">{{ log.content }}</a-descriptions-item>
            <a-descriptions-item label="现场负责人">{{ log.owner }}</a-descriptions-item>
            <a-descriptions-item label="外协工时">{{ log.outsourcingHours || '—' }}</a-descriptions-item>
          </a-descriptions>

          <!-- 参与人员 -->
          <div v-if="(log.members || []).length" class="implement-detail__section">
            <div class="implement-detail__section-title">参与人员</div>
            <a-table
              :columns="memberColumns"
              :data-source="log.members"
              :pagination="false"
              size="small"
              bordered
            />
          </div>

          <!-- 现场照片 -->
          <div v-if="getPhotos().length" class="implement-detail__section">
            <div class="implement-detail__section-title">现场照片</div>
            <a-image
              v-for="(img, i) in getPhotos()"
              :key="i"
              :src="img"
              :width="90"
              :height="90"
              style="margin-right: 8px; object-fit: cover; border-radius: 4px"
            />
          </div>

          <!-- 行车/用料记录 -->
          <a-descriptions :column="2" bordered size="middle">
            <a-descriptions-item label="行车记录">
              <template v-if="log.vehicle">
                车辆：{{ log.vehicle }} ｜ 公里数：{{ log.vehicleKm }}
              </template>
              <template v-else>—</template>
            </a-descriptions-item>
            <a-descriptions-item label="用料记录">{{ log.materialBrief || '—' }}</a-descriptions-item>
          </a-descriptions>
        </template>
        <a-empty v-else description="暂无日志数据" />
      </a-spin>
    </a-card>
  </div>
</template>

<script lang="ts" name="implement-detail" setup>
  import { ref, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { logDetail } from '../Implement.api';

  const route = useRoute();
  const router = useRouter();
  const id = route.params.id as string;

  const loading = ref(false);
  const log = ref<any>({});

  const memberColumns = [
    { title: '内协人员', dataIndex: 'name' },
    { title: '签到时间', dataIndex: 'checkIn' },
    { title: '签退时间', dataIndex: 'checkOut' },
    { title: '工作内容', dataIndex: 'content' },
    { title: '评分', dataIndex: 'score', width: 70, align: 'center' },
  ];

  async function load() {
    loading.value = true;
    try {
      const data = await logDetail({ id });
      log.value = data || {};
    } finally {
      loading.value = false;
    }
  }

  function goBack() {
    router.back();
  }

  function getPhotos(): string[] {
    const val = log.value?.photos;
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return String(val)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  onMounted(() => {
    load();
  });
</script>

<style lang="less" scoped>
  .implement-detail {
    padding: 16px;

    &__card {
      background: #fff;
      border-radius: 4px;
      padding: 16px;
    }

    &__header {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 16px;
    }

    &__title {
      font-weight: 600;
      font-size: 16px;
      color: #333;
    }

    &__section {
      margin-bottom: 16px;

      &-title {
        font-weight: 600;
        font-size: 15px;
        color: #333;
        margin-bottom: 8px;
      }
    }
  }
</style>
