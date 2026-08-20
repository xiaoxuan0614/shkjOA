<template>
  <div class="plan-implement">
    <!-- 标题1: 计划信息 -->
    <div class="plan-implement__group">
      <div class="plan-implement__group-title">计划信息</div>
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="计划验收日期">
              <a-tooltip title="全部验收完成的预估时间">
                <a-date-picker
                  v-model:value="planInfo.acceptanceDate"
                  :disabled="!editable"
                  value-format="YYYY-MM-DD"
                  style="width: 100%"
                  placeholder="请选择计划验收日期"
                />
              </a-tooltip>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-textarea v-model:value="planInfo.remark" :disabled="!editable" placeholder="请输入备注" :rows="2" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <!-- 标题2: 工序计划 -->
    <div class="plan-implement__group">
      <div class="plan-implement__group-title">
        <span>工序计划</span>
        <a-button v-if="editable" type="primary" size="small" preIcon="ant-design:plus-outlined" @click="addProcess">添加</a-button>
      </div>
      <a-table
        :columns="processColumns"
        :data-source="processList"
        :row-key="(record) => record._key"
        :pagination="false"
        size="middle"
        bordered
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">
            {{ record._key }}
          </template>
          <template v-else-if="column.key === 'name'">
            <a-select v-model:value="record.name" :disabled="!editable" placeholder="请选择工序" style="width: 100%" :options="workTypeOptions" />
          </template>
          <template v-else-if="column.key === 'leader'">
            <a-select
              v-model:value="record.leader"
              :disabled="!editable"
              placeholder="请选择现场负责人"
              style="width: 100%"
              show-search
              option-filter-prop="label"
              :options="leaderOptions"
            />
          </template>
          <template v-else-if="column.key === 'startTime'">
            <a-date-picker v-model:value="record.startTime" :disabled="!editable" value-format="YYYY-MM-DD" style="width: 100%" placeholder="计划开始" />
          </template>
          <template v-else-if="column.key === 'endTime'">
            <a-date-picker v-model:value="record.endTime" :disabled="!editable" value-format="YYYY-MM-DD" style="width: 100%" placeholder="计划完成" />
          </template>
          <template v-else-if="column.key === 'hours'">
            <a-input v-model:value="record.hours" :disabled="!editable" placeholder="计划工时" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="editable" type="link" danger size="small" @click="removeProcess(record._key)">删除</a-button>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, unref, onMounted } from 'vue';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { uploadFile } from '/@/api/common/api';
  import { getPlanMembers } from './Plan.api';
  import { initDictOptions } from '/@/utils/dict/index';

  const { createMessage } = useMessage();

  // 属性: editable 控制是否可编辑; periodId 用于现场负责人(已接收成员)
  const props = defineProps<{
    editable?: boolean;
    periodId?: string;
  }>();

  // 工序名称下拉(字典 work_type: 施工/调试)
  const workTypeOptions = ref<{ label: string; value: string }[]>([]);
  // 现场负责人下拉(接口: 分期 + 邀请状态=1)
  const leaderOptions = ref<{ label: string; value: string }[]>([]);

  onMounted(async () => {
    workTypeOptions.value = (await initDictOptions('work_type')) || [];
    await loadLeaders();
  });

  /** 现场负责人 = 该项目已接收邀请的成员(inviteStatus=1) */
  async function loadLeaders() {
    if (!props.periodId) return;
    try {
      const res: any = await getPlanMembers({ periodId: props.periodId, inviteStatus: 1, pageNo: 1, pageSize: 100 });
      const records = res?.records || res || [];
      leaderOptions.value = (records || []).map((m: any) => ({ label: m.memberName || m.userName || m.realname, value: m.memberName || m.userName || m.realname }));
    } catch {
      leaderOptions.value = [];
    }
  }

  // 计划信息(计划验收日期 + 实施计划文件 + 备注)
  const planInfo = reactive<any>({
    acceptanceDate: undefined,
    fileId: '',
    fileName: '',
    remark: '',
  });

  // 工序计划表
  const processColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '工序名称', key: 'name', width: 140 },
    { title: '现场负责人', key: 'leader', width: 160 },
    { title: '计划开始时间', key: 'startTime', width: 150 },
    { title: '计划完成时间', key: 'endTime', width: 150 },
    { title: '计划工时', key: 'hours', width: 110 },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const processList = ref<any[]>([]);
  let processSeed = 0;

  // 暴露给父级(计划信息 + 工序表行)
  defineExpose({
    getData() {
      return { ...unref(planInfo), processList: unref(processList) };
    },
    setData(data: any) {
      if (data) {
        Object.assign(planInfo, {
          acceptanceDate: data.acceptanceDate,
          fileId: data.fileId || '',
          fileName: data.fileName || '',
          remark: data.remark ?? '',
        });
      }
      processList.value = (data?.processList || []).map((item) => ({ ...item, _key: ++processSeed }));
    },
  });

  // 添加工序
  function addProcess() {
    processList.value.push({ _key: ++processSeed, name: undefined, leader: undefined, startTime: undefined, endTime: undefined, hours: '' });
  }

  // 移除工序
  function removeProcess(key: number) {
    processList.value = processList.value.filter((p) => p._key !== key);
  }
</script>

<style lang="less" scoped>
  .plan-implement {
    &__group {
      margin-bottom: 16px;

      &-title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin-bottom: 12px;
      }
    }
  }
</style>
