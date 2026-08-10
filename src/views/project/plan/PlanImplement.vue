<template>
  <div class="plan-implement">
    <!-- 实施基本信息 -->
    <div class="plan-implement__group">
      <div class="plan-implement__group-title">实施基本信息</div>
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="计划总工时" required>
              <a-input-number
                v-model:value="planInfo.totalHours"
                :disabled="!editable"
                placeholder="请输入计划总工时"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="实施开始时间" required>
              <a-date-picker
                v-model:value="planInfo.startTime"
                :disabled="!editable"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
                placeholder="请选择实施开始时间"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="预计结束时间" required>
              <a-date-picker
                v-model:value="planInfo.endTime"
                :disabled="!editable"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
                placeholder="请选择预计结束时间"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="实施计划">
              <a-upload :disabled="!editable" :before-upload="() => false" :max-count="1">
                <a-button preIcon="ant-design:upload-outlined">上传文件</a-button>
              </a-upload>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="备注">
              <a-textarea v-model:value="planInfo.remark" :disabled="!editable" placeholder="请输入备注" :rows="2" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <!-- 实施进度计划 -->
    <div class="plan-implement__group">
      <div class="plan-implement__group-title">
        <span>实施进度计划</span>
        <a-button v-if="editable" type="primary" size="small" preIcon="ant-design:plus-outlined" @click="addProgress">添加</a-button>
      </div>
      <a-table
        :columns="progressColumns"
        :data-source="progressList"
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
            <a-input v-model:value="record.name" :disabled="!editable" placeholder="请输入工序名称" />
          </template>
          <template v-else-if="column.key === 'leader'">
            <a-select v-model:value="record.leader" :disabled="!editable" placeholder="请选择现场负责人" style="width: 100%" :options="leaderOptions" />
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
            <a-button v-if="editable" type="link" danger size="small" @click="removeProgress(record._key)">删除</a-button>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { ref, reactive, unref } from 'vue';

  // 属性: editable 控制是否可编辑
  defineProps<{
    editable?: boolean;
  }>();

  // 现场负责人下拉
  const leaderOptions = [
    { label: '张三', value: '张三' },
    { label: '李四', value: '李四' },
    { label: '王五', value: '王五' },
    { label: '赵六', value: '赵六' },
  ];

  // 实施基本信息
  const planInfo = reactive<any>({
    totalHours: undefined,
    startTime: undefined,
    endTime: undefined,
    planFile: undefined,
    remark: '',
  });

  // 实施进度表
  const progressColumns = [
    { title: '序号', key: 'index', width: 60 },
    { title: '工序名称', key: 'name', width: 160 },
    { title: '现场负责人', key: 'leader', width: 140 },
    { title: '计划开始时间', key: 'startTime', width: 160 },
    { title: '计划完成时间', key: 'endTime', width: 160 },
    { title: '计划工时', key: 'hours', width: 120 },
    { title: '操作', key: 'action', width: 80, align: 'center' },
  ];
  const progressList = ref<any[]>([]);
  let progressSeed = 0;

  // 暴露给父级
  defineExpose({
    getData() {
      return { planInfo: { ...unref(planInfo) }, progressList: unref(progressList) };
    },
    setData(data: any) {
      if (data?.planInfo) {
        Object.assign(planInfo, data.planInfo);
      }
      progressList.value = (data?.progressList || []).map((item) => ({ ...item, _key: ++progressSeed }));
    },
  });

  // 添加工序
  function addProgress() {
    progressList.value.push({ _key: ++progressSeed, name: '', leader: undefined, startTime: undefined, endTime: undefined, hours: '' });
  }

  // 移除工序
  function removeProgress(key: number) {
    progressList.value = progressList.value.filter((p) => p._key !== key);
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
