<template>
  <div class="implement-detail" :class="{ 'implement-detail--embedded': embedded }">
    <a-card class="implement-detail__card">
      <div v-if="!embedded" class="implement-detail__header">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="emit('back')">返回</a-button>
        <div>
          <div class="implement-detail__title">实施记录详情</div>
          <div class="implement-detail__subtitle">查看本次实施的人员、现场、行车和实际用料</div>
        </div>
      </div>

      <a-spin :spinning="loading">
        <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="implement-detail__error">
          <template #action>
            <a-button size="small" @click="load">重新加载</a-button>
          </template>
        </a-alert>

        <template v-else-if="hasLog">
          <a-descriptions :column="2" bordered size="middle" class="implement-detail__section">
            <a-descriptions-item label="项目名称">{{ project.projectName || '—' }}</a-descriptions-item>
            <a-descriptions-item label="工序名称">{{ getProcessName(process.processName) }}</a-descriptions-item>
            <a-descriptions-item label="提交人">{{ log.submitterName || log.owner || '—' }}</a-descriptions-item>
            <a-descriptions-item label="工时">{{ workHoursText }}</a-descriptions-item>
            <a-descriptions-item label="签到时间">{{ log.signInTime || '—' }}</a-descriptions-item>
            <a-descriptions-item label="签退时间">{{ log.signOutTime || '—' }}</a-descriptions-item>
            <a-descriptions-item label="实施位置" :span="2"
              ><div class="implement-detail__text">{{
                log.implementLocationName || log.locationName || log.position || '—'
              }}</div></a-descriptions-item
            >
            <a-descriptions-item label="实施内容" :span="2"
              ><div class="implement-detail__text">{{ log.workContent || log.content || '—' }}</div></a-descriptions-item
            >
            <a-descriptions-item label="备注" :span="2">{{ log.remark || '—' }}</a-descriptions-item>
          </a-descriptions>

          <a-alert v-if="leaderLookupFailed" type="warning" show-icon message="工序负责人信息加载失败，无法确认是否展示参与人员，请重新加载" />
          <div v-if="isSiteLeaderLog" class="implement-detail__section">
            <div class="implement-detail__section-title">参与人员</div>
            <a-alert v-if="peopleLookupFailed" type="warning" show-icon message="部分人员或外协名称加载失败，请重新加载；本次参与记录仍保留" />
            <h4>参与人员信息</h4>
            <a-table
              :columns="memberColumns"
              :data-source="participantRecords"
              :pagination="{ pageSize: 10, hideOnSinglePage: true }"
              :locale="{ emptyText: '本条日志没有其他参与人员' }"
              :row-key="(record, index) => record.id || record.userId || index"
              size="small"
              bordered
            />
            <h4 class="implement-detail__subheading">外协参与记录</h4>
            <a-table
              :columns="outsourceColumns"
              :data-source="outsourceRecords"
              :pagination="{ pageSize: 10, hideOnSinglePage: true }"
              :row-key="(_, index) => index"
              :locale="{ emptyText: '本条日志没有外协参与记录' }"
              size="small"
              bordered
            />
          </div>

          <div v-if="getPhotos().length" class="implement-detail__section">
            <div class="implement-detail__section-title">现场照片</div>
            <a-image-preview-group>
              <div class="implement-detail__photos">
                <a-image
                  v-for="(img, index) in getPhotos()"
                  :key="`${img}-${index}`"
                  :src="img"
                  :width="104"
                  :height="104"
                  class="implement-detail__photo"
                />
              </div>
            </a-image-preview-group>
          </div>

          <div class="implement-detail__section">
            <div class="implement-detail__section-title">行车记录</div>
            <a-descriptions :column="2" bordered size="middle">
              <a-descriptions-item label="使用车辆">{{ log.vehicleNo || log.vehicle || '—' }}</a-descriptions-item>
              <a-descriptions-item label="公里数">{{ formatMileage(log.mileage ?? log.vehicleKm) }}</a-descriptions-item>
            </a-descriptions>
          </div>

          <div class="implement-detail__section">
            <div class="implement-detail__section-title">实际用料</div>
            <a-table
              :columns="materialColumns"
              :data-source="materialRecords"
              :pagination="false"
              :row-key="(record, index) => record.id || record.materialPlanId || index"
              :locale="{ emptyText: '本次实施没有用料记录' }"
              size="small"
              bordered
            />
          </div>
        </template>

        <a-empty v-else description="暂无日志数据" />
      </a-spin>
    </a-card>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
  import { getFileAccessHttpUrl } from '/@/utils/common/compUtils';
  import { implementProcessDetail, implementProjectDetail, logDetail } from '../Implement.api';
  import { loadProjectWorkTypeOptions } from '../../project/Project.data';
  import { getPlanMembers, getPlanOutsources } from '../../project/plan/Plan.api';

  import { formatLogHours } from '../logDisplay';
  defineOptions({ name: 'ImplementLogDetailContent' });

  const props = defineProps<{ periodId: string; logId: string; processId?: string; embedded?: boolean }>();
  const { periodId, logId } = props;
  const emit = defineEmits(['back']);
  let loadSequence = 0;
  onBeforeUnmount(() => {
    loadSequence += 1;
  });

  const loading = ref(false);
  const loadError = ref('');
  const log = ref<Recordable>({});
  const project = ref<Recordable>({});
  const process = ref<Recordable>({});
  const workTypeMeta = ref<Record<string, string>>({});
  const hasLog = computed(() => Object.keys(log.value || {}).length > 0);
  const members = ref<Recordable[]>([]);
  const outsources = ref<Recordable[]>([]);
  const peopleLookupFailed = ref(false);
  const leaderLookupFailed = ref(false);
  // 根据日志提交人与其工序负责人比较，与当前登录查看人无关。
  const isSiteLeaderLog = computed(
    () => !!log.value.submitterId && !!process.value.siteLeaderId && String(log.value.submitterId) === String(process.value.siteLeaderId)
  );
  const participantRecords = computed<Recordable[]>(() => {
    const ids = Array.isArray(log.value.internalParticipantIds)
      ? log.value.internalParticipantIds
      : String(log.value.internalParticipantIds || '').split(',');
    return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))].map((id) => ({
      userId: id,
      userName: members.value.find((item) => String(item.userId) === id)?.userName || '姓名暂不可用',
    }));
  });
  const outsourceRecords = computed<Recordable[]>(() =>
    (Array.isArray(log.value.outsources) ? log.value.outsources : []).filter(Boolean).map((item) => ({
      ...item,
      unitName: item.unitName || outsources.value.find((unit) => String(unit.id) === String(item.outsourceMemberId))?.unitName || '单位名称暂不可用',
    }))
  );
  const workHoursText = computed(() => formatLogHours(log.value));
  const materialRecords = computed<Recordable[]>(() => (Array.isArray(log.value?.materials) ? log.value.materials : []));

  const memberColumns = [{ title: '参与人员', dataIndex: 'userName', key: 'userName' }];
  const outsourceColumns = [
    { title: '外协单位', dataIndex: 'unitName' },
    { title: '实际人数', dataIndex: 'headcount', customRender: ({ text }) => formatPeople(text) },
    { title: '实际工时', dataIndex: 'workHours', customRender: ({ text }) => formatHours(text) },
    { title: '备注', dataIndex: 'remark' },
  ];

  async function loadAll(api: (params: Recordable) => Promise<any>, targetPeriodId: string) {
    const records: Recordable[] = [];
    let pageNo = 1;
    let pages = 1;
    do {
      const result = await api({ periodId: targetPeriodId, pageNo, pageSize: 100 });
      const rows = Array.isArray(result) ? result : result?.records || [];
      records.push(...rows.filter(Boolean));
      pages = Array.isArray(result) ? 1 : Number(result?.pages || Math.ceil(Number(result?.total || 0) / Number(result?.size || 100)) || 1);
      pageNo += 1;
    } while (pageNo <= pages);
    return records;
  }

  const materialColumns = [
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', ellipsis: true },
    { title: '品牌', dataIndex: 'brand', key: 'brand', width: 130, ellipsis: true },
    { title: '规格型号', dataIndex: 'model', key: 'model', width: 150, ellipsis: true },
    { title: '实际用量', dataIndex: 'usedQty', key: 'usedQty', width: 110, align: 'center' },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 90, align: 'center' },
  ];

  async function load() {
    if (!logId) {
      loadError.value = '缺少日志 ID，无法加载实施记录详情';
      return;
    }
    const sequence = ++loadSequence;
    loading.value = true;
    log.value = {};
    project.value = {};
    process.value = {};
    loadError.value = '';
    members.value = [];
    outsources.value = [];
    peopleLookupFailed.value = false;
    leaderLookupFailed.value = false;
    try {
      const [data, workTypeOptions]: any[] = await Promise.all([logDetail({ id: logId }), loadProjectWorkTypeOptions()]);
      if (sequence !== loadSequence) return;
      if (data?.periodId && String(data.periodId) !== periodId) throw new Error('日志不属于当前项目分期');
      log.value = data || {};
      workTypeMeta.value = Object.fromEntries(workTypeOptions.map((item: Recordable) => [String(item.value), String(item.label)]));

      if (periodId) {
        const [projectResult, planResult] = await Promise.allSettled([implementProjectDetail({ periodId }), implementProcessDetail({ periodId })]);
        if (sequence !== loadSequence) return;
        project.value = projectResult.status === 'fulfilled' ? projectResult.value || {} : {};
        const processRecords = planResult.status === 'fulfilled' && Array.isArray(planResult.value?.records) ? planResult.value.records : [];
        const processId = String(log.value?.processId || props.processId || '');
        process.value = processRecords.find((item: Recordable) => String(item.id) === processId) || {};
        leaderLookupFailed.value = planResult.status === 'rejected' || !process.value.siteLeaderId;
        if (isSiteLeaderLog.value) {
          const [memberResult, outsourceResult] = await Promise.allSettled([
            log.value.internalParticipantIds?.length ? loadAll(getPlanMembers, periodId) : Promise.resolve([]),
            log.value.outsources?.length ? loadAll(getPlanOutsources, periodId) : Promise.resolve([]),
          ]);
          if (sequence !== loadSequence) return;
          members.value = memberResult.status === 'fulfilled' ? memberResult.value : [];
          outsources.value = outsourceResult.status === 'fulfilled' ? outsourceResult.value : [];
          peopleLookupFailed.value = memberResult.status === 'rejected' || outsourceResult.status === 'rejected';
        }
      }
    } catch (error) {
      if (sequence !== loadSequence) return;
      log.value = {};
      project.value = {};
      process.value = {};
      loadError.value = '实施记录详情加载失败，请重新加载';
    } finally {
      if (sequence === loadSequence) loading.value = false;
    }
  }

  function getProcessName(value: unknown) {
    const key = String(value ?? '');
    return workTypeMeta.value[key] || key || '—';
  }

  function formatHours(value: unknown) {
    return value === null || value === undefined || value === '' ? '—' : `${value}h`;
  }

  function formatPeople(value: unknown) {
    return value === null || value === undefined || value === '' ? '—' : `${value}人`;
  }

  function formatMileage(value: unknown) {
    return value === null || value === undefined || value === '' ? '—' : `${value}km`;
  }

  function getPhotos(): string[] {
    const value = log.value?.photos;
    const paths = Array.isArray(value)
      ? value
      : String(value || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
    return paths.map((path) => (/^(https?:|blob:|data:)/i.test(String(path)) ? String(path) : getFileAccessHttpUrl(String(path))));
  }

  onMounted(load);
</script>

<style lang="less" scoped>
  .implement-detail {
    padding: 16px;

    &--embedded {
      padding: 0;
      .implement-detail__card {
        min-height: 0;
      }
    }

    &__card {
      min-height: calc(100vh - 132px);
      background: #fff;
      border-radius: 4px;
    }

    &__header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 20px;
    }

    &__title {
      color: #262626;
      font-size: 18px;
      font-weight: 600;
      line-height: 1.5;
    }

    &__subtitle {
      color: #8c8c8c;
      font-size: 13px;
      line-height: 1.6;
    }

    &__error,
    &__section {
      margin-bottom: 20px;
    }

    &__section-title {
      margin-bottom: 10px;
      color: #262626;
      font-size: 15px;
      font-weight: 600;
    }

    &__photos {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    &__text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    &__subheading {
      margin-top: 16px;
    }

    &__photo {
      overflow: hidden;
      border-radius: 4px;
      object-fit: cover;
    }
  }

  :deep(.ant-table-cell) {
    font-variant-numeric: tabular-nums;
  }
</style>
