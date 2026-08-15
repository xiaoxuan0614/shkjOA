<template>
  <div class="vehicle-detail">
    <!-- 顶部返回 + 车辆信息 -->
    <a-card class="vehicle-detail__header">
      <div class="vehicle-detail__header-top">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="goBack">返回</a-button>
        <span class="vehicle-detail__plate">{{ vehicle.plateNo || '—' }}</span>
        <a-tag :color="getStatusColor(vehicle.status)">{{ vehicle.status }}</a-tag>
        <span class="vehicle-detail__owner">负责人：{{ vehicle.owner || '—' }}</span>
      </div>
    </a-card>

    <!-- 记录 tabs -->
    <a-card class="vehicle-detail__body">
      <a-tabs v-model:activeKey="activeKey" @change="handleTabChange">
        <a-tab-pane key="drive" tab="使用记录">
          <RecordTable
            :columns="driveColumns"
            :load-fn="driveList"
            :query="driveQuery"
            :params="{ vehicleId }"
            title="行车记录"
            @detail="openDriveDetail"
          />
        </a-tab-pane>
        <a-tab-pane key="fuel" tab="加油记录">
          <RecordTable
            :columns="fuelColumns"
            :load-fn="fuelList"
            :query="fuelQuery"
            :params="{ vehicleId }"
            title="加油记录"
            @detail="openFuelDetail"
          />
        </a-tab-pane>
        <a-tab-pane key="maintenance" tab="保养记录">
          <RecordTable
            :columns="maintenanceColumns"
            :load-fn="maintenanceList"
            :query="maintenanceQuery"
            :params="{ vehicleId }"
            title="保养记录"
            @detail="openMaintenanceDetail"
          />
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 记录详情弹窗 -->
    <RecordDetailModal
      @register="registerRecordModal"
      :record-title="recordTitle"
      :record-fields="recordFields"
    />
  </div>
</template>

<script lang="ts" name="resource-vehicle-detail" setup>
  import { ref, reactive, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useModal } from '/@/components/Modal';
  import { queryById, driveList, fuelList, maintenanceList } from '../Vehicle.api';
  import { driveColumns, fuelColumns, maintenanceColumns } from '../Vehicle.data';
  import RecordTable from './components/RecordTable.vue';
  import RecordDetailModal from './components/RecordDetailModal.vue';

  const route = useRoute();
  const router = useRouter();
  const vehicleId = route.params.id as string;

  // 车辆基本信息
  const vehicle = ref<any>({});
  const activeKey = ref<string>('drive');

  // 三个 tab 各自的查询条件(RangePicker 区间)
  const driveQuery = reactive<any>({});
  const fuelQuery = reactive<any>({});
  const maintenanceQuery = reactive<any>({});

  // 记录详情弹窗
  const [registerRecordModal, { openModal }] = useModal();
  const recordTitle = ref('');
  const recordFields = ref<any[]>([]);

  /**
   * 加载车辆详情
   */
  async function loadVehicle() {
    const data = await queryById({ id: vehicleId });
    vehicle.value = data || {};
  }

  /**
   * 返回列表
   */
  function goBack() {
    router.push('/resource/vehicle');
  }

  /**
   * 状态颜色
   */
  function getStatusColor(status: string): string {
    const map: Recordable = {
      可用: 'success',
      保养中: 'processing',
      维修中: 'warning',
      停用: 'default',
    };
    return map[status] || 'default';
  }

  /**
   * tab 切换: 什么都不做, RecordTable 内部按 visible 懒加载
   */
  function handleTabChange() {}

  /* ============ 打开各记录详情弹窗 ============ */
  function openDriveDetail(record: any) {
    recordTitle.value = '行车记录详情';
    recordFields.value = [
      { label: '车牌号', value: vehicle.value.plateNo },
      { label: '用车原因', value: record.reason },
      { label: '驾驶员', value: record.driver },
      { label: '驾车时间', value: record.driveTime },
      { label: '驾驶时长', value: record.duration },
      { label: '行驶公里', value: record.mileage },
      { label: '目的地', value: record.destination },
      { label: '照片', value: record.photos, type: 'images' },
    ];
    openModal(true);
  }

  function openFuelDetail(record: any) {
    recordTitle.value = '加油记录详情';
    recordFields.value = [
      { label: '车牌号', value: vehicle.value.plateNo },
      { label: '驾驶员', value: record.driver },
      { label: '加油量', value: record.fuelAmount },
      { label: '金额', value: record.amount },
      { label: '付款方式', value: record.payType },
      { label: '加油地点', value: record.location },
      { label: '加油时间', value: record.fuelTime },
      { label: '照片', value: record.photos, type: 'images' },
    ];
    openModal(true);
  }

  function openMaintenanceDetail(record: any) {
    recordTitle.value = '保养记录详情';
    recordFields.value = [
      { label: '车牌号', value: vehicle.value.plateNo },
      { label: '提交人', value: record.submitBy },
      { label: '保养日期', value: record.maintenanceDate },
      { label: '下次保养时间', value: record.nextMaintenanceTime },
      { label: '价格', value: record.price },
      { label: '说明', value: record.remark },
      { label: '保养地点', value: record.location },
      { label: '照片', value: record.photos, type: 'images' },
    ];
    openModal(true);
  }

  onMounted(() => {
    loadVehicle();
  });
</script>

<style lang="less" scoped>
  .vehicle-detail {
    padding: 16px;

    &__header {
      margin-bottom: 16px;

      &-top {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    }

    &__plate {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    &__owner {
      color: #666;
    }
  }
</style>
