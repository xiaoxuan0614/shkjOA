<template>
  <div class="vehicle-detail">
    <!-- 顶部返回 + 车辆信息 -->
    <a-card class="vehicle-detail__header">
      <div class="vehicle-detail__header-top">
        <a-button type="link" preIcon="ant-design:arrow-left-outlined" @click="goBack">返回</a-button>
        <span class="vehicle-detail__plate">{{ vehicle.plateNumber || '—' }}</span>
        <a-tag :color="getStatusColor(vehicle.status)">{{ vehicle.status }}</a-tag>
        <span class="vehicle-detail__owner">负责人：{{ vehicle.principal || '—' }}</span>
      </div>
    </a-card>

    <!-- 记录 tabs -->
    <a-alert v-if="loadFailed" type="error" message="车辆信息加载失败"
      ><template #action><a-button @click="loadVehicle">重试</a-button></template></a-alert
    >
    <a-card v-if="vehicle.vehicleId != null" :key="vehicleId" class="vehicle-detail__body">
      <a-tabs v-model:activeKey="activeKey">
        <a-tab-pane key="drive" tab="使用记录">
          <RecordTable
            :columns="driveColumns"
            :load-fn="driveList"
            row-key="driveId"
            show-date
            date-field="driveStartTime"
            :params="{ vehicleId }"
            title="行车记录"
            @detail="openDriveDetail"
          />
        </a-tab-pane>
        <a-tab-pane key="fuel" tab="加油记录">
          <RecordTable
            :columns="fuelColumns"
            :load-fn="fuelList"
            row-key="refuelId"
            show-date
            date-field="refuelTime"
            :params="{ vehicleId }"
            title="加油记录"
            @detail="openFuelDetail"
          />
        </a-tab-pane>
        <a-tab-pane key="maintenance" tab="保养记录">
          <RecordTable
            :columns="maintenanceColumns"
            :load-fn="maintenanceList"
            row-key="maintainId"
            show-date
            date-field="maintainDate"
            :params="{ vehicleId }"
            title="保养记录"
            @detail="openMaintenanceDetail"
          />
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 记录详情弹窗 -->
    <RecordDetailModal @register="registerRecordModal" :record-title="recordTitle" :record-fields="recordFields" />
  </div>
</template>

<script lang="ts" name="resource-vehicle-detail" setup>
  import { ref, computed, watch, onBeforeUnmount } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useModal } from '/@/components/Modal';
  import { queryById, driveList, fuelList, maintenanceList, driveDetail, fuelDetail, maintenanceDetail } from '../Vehicle.api';
  import { driveColumns, fuelColumns, maintenanceColumns, getStatusColor } from '../Vehicle.data';
  import RecordTable from './components/RecordTable.vue';
  import RecordDetailModal from './components/RecordDetailModal.vue';

  const route = useRoute();
  const router = useRouter();
  const vehicleId = computed(() => String(route.params.id || ''));
  const vehicle = ref<any>({});
  const activeKey = ref('drive');
  const loadFailed = ref(false);
  let sequence = 0;
  let recordSequence = 0;
  const [registerRecordModal, { openModal, closeModal, setModalProps }] = useModal();
  const recordTitle = ref('');
  const recordFields = ref<any[]>([]);
  async function loadVehicle() {
    const request = ++sequence;
    vehicle.value = {};
    loadFailed.value = false;
    try {
      if (!vehicleId.value) throw new Error('缺少车辆ID');
      const data = await queryById({ vehicleId: vehicleId.value });
      if (request !== sequence) return;
      if (data?.vehicleId == null) throw new Error('车辆不存在');
      vehicle.value = data;
    } catch {
      if (request === sequence) loadFailed.value = true;
    }
  }
  function goBack() {
    router.push('/resource/vehicle');
  }
  async function openRecord(record, title, columns, api, idField, images = true) {
    const request = ++recordSequence;
    recordTitle.value = title;
    recordFields.value = [];
    openModal(true);
    setModalProps({ loading: true });
    try {
      const data = await api({ [idField]: record[idField] });
      if (request !== recordSequence) return;
      if (!data) throw new Error('记录不存在');
      recordFields.value = [
        { label: '车牌号', value: vehicle.value.plateNumber },
        ...columns.map((column) => ({ label: column.title, value: data[column.dataIndex] })),
        ...(images ? [{ label: '照片', value: data.photoUrls, type: 'images' }] : []),
      ];
    } catch {
      if (request === recordSequence) closeModal();
    } finally {
      if (request === recordSequence) setModalProps({ loading: false });
    }
  }
  function openDriveDetail(record) {
    return openRecord(record, '行车记录详情', driveColumns, driveDetail, 'driveId');
  }
  function openFuelDetail(record) {
    return openRecord(record, '加油记录详情', fuelColumns, fuelDetail, 'refuelId');
  }
  function openMaintenanceDetail(record) {
    return openRecord(record, '保养记录详情', maintenanceColumns, maintenanceDetail, 'maintainId', false);
  }
  watch(
    vehicleId,
    () => {
      ++recordSequence;
      activeKey.value = 'drive';
      loadVehicle();
    },
    { immediate: true }
  );
  onBeforeUnmount(() => {
    ++sequence;
    ++recordSequence;
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
