<template>
  <div class="implement-log">
    <a-card class="implement-log__card">
      <!-- 顶部工序信息 -->
      <div class="implement-log__header">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="goBack">返回</a-button>
        <span class="implement-log__title">{{ work.projectName || '工序日志' }}</span>
      </div>
      <div v-if="work.workName" class="implement-log__work">
        <div class="implement-log__work-line">
          <span>工序：{{ work.workName }}</span>
          <span>状态：<a-tag :color="getStatusColor(work.status)">{{ work.status }}</a-tag></span>
          <span>剩余工期：{{ work.remainingDays }} 天</span>
        </div>
        <div class="implement-log__work-line">
          计划开始时间：{{ work.planStart }} &nbsp; 计划完成时间：{{ work.planEnd }} &nbsp; 计划工时：{{ work.planHours }}
        </div>
        <!-- 已延期时显示延期原因 -->
        <div v-if="work.status === '已延期'" class="implement-log__delay">
          <span>延期原因：{{ work.delayReason || '—' }}</span>
          <span>预计延期完成时间：{{ work.delayEndTime || '—' }}</span>
        </div>
      </div>

      <!-- 日志列表 -->
      <div class="implement-log__body">
        <div class="implement-log__body-title">实施日志</div>
        <BasicTable @register="registerTable">
          <template #action="{ record }">
            <TableAction :actions="[{ label: '详情', onClick: handleDetail.bind(null, record) }]" />
          </template>
        </BasicTable>
      </div>
    </a-card>
  </div>
</template>

<script lang="ts" name="implement-log" setup>
  import { ref, reactive, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { BasicTable, TableAction } from '/@/components/Table';
  import { useListPage } from '/@/hooks/system/useListPage';
  import { logList } from '../Implement.api';
  import { defHttp } from '/@/utils/http/axios';

  const route = useRoute();
  const router = useRouter();
  const workId = route.params.id as string;

  const work = ref<any>({});
  const queryParam = reactive({ workId });

  // 墨刀日志列: 实施日期/提交人/工时/实施位置/实施内容/现场照片/操作
  const columns = [
    { title: '实施日期', align: 'center', dataIndex: 'implementDate' },
    { title: '提交人', align: 'center', dataIndex: 'submitBy' },
    { title: '工时', align: 'center', dataIndex: 'workHours' },
    { title: '实施位置', align: 'center', dataIndex: 'position' },
    { title: '实施内容', align: 'center', dataIndex: 'content' },
    { title: '现场照片', align: 'center', dataIndex: 'photos', customRender: ({ text }) => (text ? '查看' : '—') },
  ];

  const { tableContext } = useListPage({
    tableProps: {
      title: '实施日志',
      api: logList,
      columns,
      showIndexColumn: false,
      actionColumn: {
        width: 100,
        fixed: 'right',
      },
      beforeFetch: (params) => {
        return Object.assign(params, queryParam);
      },
    },
  });

  const [registerTable] = tableContext;

  /**
   * 加载工序信息(顶部)
   */
  async function loadWork() {
    const data = await defHttp.get({ url: '/implement/work/detail', params: { id: workId } });
    work.value = data || {};
  }

  function goBack() {
    router.push('/implement/list');
  }

  function handleDetail(record: any) {
    router.push({ path: `/implement/log/${workId}/detail/${record.id}` });
  }

  function getStatusColor(status: string): string {
    const map: Recordable = {
      未开始: 'default',
      进行中: 'processing',
      已延期: 'error',
      已完成: 'success',
    };
    return map[status] || 'default';
  }

  onMounted(() => {
    loadWork();
  });
</script>

<style lang="less" scoped>
  .implement-log {
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
      margin-bottom: 12px;
    }

    &__title {
      font-weight: 600;
      font-size: 16px;
      color: #333;
    }

    &__work {
      background: #fafafa;
      border: 1px solid #f0f0f0;
      border-radius: 4px;
      padding: 12px 16px;
      margin-bottom: 16px;

      &-line {
        color: #555;
        line-height: 2;
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
    }

    &__delay {
      color: #cf1322;
      line-height: 2;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    &__body-title {
      font-weight: 600;
      font-size: 15px;
      color: #333;
      margin-bottom: 12px;
    }
  }
</style>
