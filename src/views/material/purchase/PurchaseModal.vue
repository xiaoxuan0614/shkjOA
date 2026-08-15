<template>
  <BasicModal v-bind="$attrs" @register="register" :title="modalTitle" :width="820" @ok="handleSubmit">
    <BasicForm @register="registerForm" />

    <!-- 采购明细 -->
    <div class="purchase-modal__section">
      <div class="purchase-modal__section-title">
        <span>采购明细</span>
        <a-button type="link" size="small" @click="handleAddMaterial">+ 添加物料</a-button>
      </div>
      <a-table :columns="detailColumns" :data-source="detailList" :row-key="(r) => r._key" :pagination="false" size="small" bordered>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'quantity'">
            <a-input-number v-model:value="record.quantity" :min="1" placeholder="采购数量" style="width: 100%" />
          </template>
          <template v-else-if="column.key === 'unitPrice'">
            <a-input-number v-model:value="record.unitPrice" :min="0" :precision="2" placeholder="单价" style="width: 100%" />
          </template>
          <template v-else-if="column.key === 'unit'">
            <a-select v-model:value="record.unit" :options="record.unitOptions || []" placeholder="单位" style="width: 100%" />
          </template>
          <template v-else-if="column.key === 'amount'">
            {{ calcAmount(record) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" danger size="small" @click="removeDetail(record._key)">移除</a-button>
          </template>
        </template>
      </a-table>
      <div class="purchase-modal__total">采购总价：<b>{{ totalAmount.toFixed(2) }}</b></div>
    </div>

    <!-- 选物料抽屉 -->
    <MaterialSelectDrawer @register="registerDrawer" @success="handleDrawerSuccess" />
  </BasicModal>
</template>

<script lang="ts" setup>
  import { ref, computed } from 'vue';
  import { useDebounceFn } from '@vueuse/core';
  import { BasicModal, useModalInner } from '/@/components/Modal';
  import { BasicForm, useForm } from '/@/components/Form/index';
  import { useDrawer } from '/@/components/Drawer';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { purchaseFormSchema } from './Purchase.data';
  import { addOrder, editOrder, getSuppliers, searchProjectPeriod, queryOrderById } from './Purchase.api';
  import MaterialSelectDrawer from '../apply/components/MaterialSelectDrawer.vue';

  const { createMessage } = useMessage();
  const emit = defineEmits(['register', 'success']);

  // 新增/编辑模式（待采购可修改，编辑后仍为「待采购」）
  const isUpdate = ref(false);
  const editId = ref('');
  // 编辑时回填的采购单号（后端 edit 缺 orderNo 会重生成单号，须原样带回）
  const editOrderNo = ref('');
  const modalTitle = computed(() => (isUpdate.value ? '编辑采购订单' : '新增采购订单'));

  // 供应商下拉(/project/supplier/list)：初次点击不展示，输入后模糊过滤
  const supplierOptions = ref<any[]>([]); // 展示用(输入后过滤)
  const supplierAll = ref<any[]>([]); // 全量池(只读过滤用)
  const supplierIdRef = ref('');
  async function loadSuppliers() {
    const data: any = await getSuppliers({ pageNo: 1, pageSize: 100 });
    const list = data?.records || data || [];
    supplierAll.value = list.map((s: any) => ({ label: s.supplierName, value: s.supplierName, id: s.id }));
  }
  const onSupplierSearch = useDebounceFn((keyword: string) => {
    if (!keyword) {
      supplierOptions.value = [];
      return;
    }
    const kw = keyword.toLowerCase();
    supplierOptions.value = supplierAll.value.filter((o) => String(o.label).toLowerCase().includes(kw));
  }, 300);
  /** 编辑回显：把当前供应商选项塞回 options(值=名称，保证可显示) */
  function preselectSupplier(value?: string) {
    const hit = supplierAll.value.find((o) => o.value === value);
    if (hit && !supplierOptions.value.some((o) => o.value === value)) {
      supplierOptions.value = [hit, ...supplierOptions.value];
    }
  }

  // 表单
  const [registerForm, { resetFields, validate, updateSchema, setFieldsValue }] = useForm({
    labelWidth: 100,
    schemas: purchaseFormSchema,
    showActionButtonGroup: false,
    baseColProps: { span: 12 },
  });

  // 项目分期下拉(远程模糊搜索 /project/period/searchByName，防抖 300ms)
  const projectOptions = ref<any[]>([]);
  const projectIdRef = ref('');
  const onProjectSearch = useDebounceFn(async (keyword: string) => {
    if (!keyword) {
      projectOptions.value = [];
      return;
    }
    const data: any = await searchProjectPeriod({ keyword, pageNo: 1, pageSize: 20 });
    projectOptions.value = (data?.records || data || []).map((r: any) => ({
      label: r.periodName,
      value: r.periodId || r.periodNo,
      projectId: r.projectId,
      projectName: r.projectName,
      periodName: r.periodName,
    }));
  }, 300);

  function onProjectSelect(periodId: string, option: any) {
    projectIdRef.value = option?.projectId || '';
    setFieldsValue({ projectName: option?.projectName || '' });
  }

  function onSupplierSelect(_name: string, option: any) {
    supplierIdRef.value = option?.id || '';
  }

  const [registerDrawer, { openDrawer }] = useDrawer();

  // 明细列
  const detailColumns = [
    { title: '物料名称', dataIndex: 'materialName', key: 'materialName', width: 150 },
    { title: '类别', dataIndex: 'materialCategory', key: 'materialCategory', width: 100 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 130 },
    { title: '*采购数量', key: 'quantity', width: 120 },
    { title: '*单价', key: 'unitPrice', width: 120 },
    { title: '*单位', key: 'unit', width: 100 },
    { title: '金额', key: 'amount', width: 110 },
    { title: '操作', key: 'action', width: 70, align: 'center' },
  ];

  const detailList = ref<any[]>([]);
  let detailKeySeed = 0;

  const totalAmount = computed(() =>
    detailList.value.reduce((sum, d) => sum + Number(d.quantity || 0) * Number(d.unitPrice || 0), 0)
  );

  function calcAmount(record: any): string {
    return (Number(record.quantity || 0) * Number(record.unitPrice || 0)).toFixed(2);
  }

  function handleAddMaterial() {
    openDrawer(true);
  }

  function handleDrawerSuccess(selected: any[]) {
    if (!selected?.length) return;
    selected.forEach((m: any) => {
      if (detailList.value.some((d) => d.id === m.id)) {
        createMessage.warning(`「${m.materialName}」已在明细中`);
        return;
      }
      detailList.value.push({
        _key: ++detailKeySeed,
        id: m.id,
        materialName: m.materialName,
        materialCategory: m.materialCategory,
        model: m.model,
        brand: m.brand,
        quantity: 1,
        unitPrice: m.unitPrice || 0,
        unit: m.unit,
        unitOptions: (m.unitList || []).map((u: any) => ({ label: u.unitName, value: u.unitName })),
      });
    });
  }

  function removeDetail(key: number) {
    detailList.value = detailList.value.filter((d) => d._key !== key);
  }

  // 打开时重置 + 加载供应商 + 注入项目搜索(表单挂载后再注入)；编辑模式回填订单头与明细
  const [register, { closeModal }] = useModalInner(async (data) => {
    const record = data?.record || {};
    isUpdate.value = !!data?.isUpdate;
    editId.value = record.id || '';
    editOrderNo.value = record.orderNo || '';
    detailList.value = [];
    supplierIdRef.value = '';
    projectIdRef.value = '';
    // 先加载供应商(表单重置可能未就绪，供应商加载独立不阻塞)
    try {
      await loadSuppliers();
    } catch (e) {
      createMessage.error('供应商数据加载失败');
    }
    resetFields().catch(() => {});
    updateSchema([
      {
        field: 'supplierName',
        componentProps: { options: supplierOptions, onSearch: onSupplierSearch, onSelect: onSupplierSelect },
      },
      {
        field: 'periodId',
        componentProps: { options: projectOptions, onSearch: onProjectSearch, onSelect: onProjectSelect },
      },
    ]);

    // 编辑：queryById 回填订单头 + 明细
    if (isUpdate.value && editId.value) {
      try {
        const detail: any = await queryOrderById({ id: editId.value });
        if (!detail) return;
        // 采购单号以后端详情为准（编辑提交时原样带回，避免后端重生成）
        editOrderNo.value = detail.orderNo || editOrderNo.value;
        // 分期选项注入当前项，保证 value 能回显名称
        projectOptions.value = detail.periodId
          ? [{ label: detail.periodName || detail.periodId, value: detail.periodId, projectId: detail.projectId, projectName: detail.projectName }]
          : [];
        supplierIdRef.value = detail.supplierId || '';
        projectIdRef.value = detail.projectId || '';
        preselectSupplier(detail.supplierName);
        setFieldsValue({
          supplierName: detail.supplierName,
          periodId: detail.periodId,
          projectName: detail.projectName,
          orderDate: detail.orderDate,
          expectedArrivalDate: detail.expectedArrivalDate,
          remark: detail.remark,
        });
        detailList.value = (detail.itemList || []).map((it: any) => ({
          _key: ++detailKeySeed,
          id: it.materialId,
          materialName: it.materialName,
          materialCategory: it.materialCategory,
          model: it.model,
          brand: it.brand,
          quantity: it.quantity,
          unitPrice: it.unitPrice || 0,
          unit: it.unit,
          unitOptions: [{ label: it.unit, value: it.unit }],
        }));
      } catch (e) {
        createMessage.error('采购单详情加载失败');
      }
    }
  });

  /** 提交采购订单(订单头 + itemList 明细) */
  async function handleSubmit() {
    const values = await validate();
    if (!detailList.value.length) {
      createMessage.warning('请添加采购物料');
      return;
    }
    const invalid = detailList.value.find((d) => !d.quantity || d.unitPrice == null || !d.unit);
    if (invalid) {
      createMessage.warning('请填写完整的采购数量/单价/单位');
      return;
    }
    const payload = {
      supplierId: supplierIdRef.value,
      supplierName: values.supplierName,
      projectId: projectIdRef.value,
      periodId: values.periodId,
      projectName: values.projectName,
      orderDate: values.orderDate,
      expectedArrivalDate: values.expectedArrivalDate,
      remark: values.remark,
      // 订单状态=数据字典数字码（purchase_order_status：1待采购/2采购中/3已到货/4已入库/0关闭）
      status: '1',
      totalAmount: Number(totalAmount.value.toFixed(2)),
      itemList: detailList.value.map((d) => ({
        materialId: d.id,
        materialName: d.materialName,
        materialCategory: d.materialCategory,
        brand: d.brand,
        model: d.model,
        unit: d.unit,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        amount: Number(calcAmount(d)),
      })),
    };
    if (isUpdate.value) {
      // 编辑补带 orderNo，防止后端 edit 缺单号时重生成
      await editOrder({ id: editId.value, orderNo: editOrderNo.value, ...payload });
      createMessage.success('采购订单已更新');
    } else {
      await addOrder(payload);
      createMessage.success('采购订单已提交(待采购)');
    }
    emit('success');
    closeModal();
  }
</script>

<style lang="less" scoped>
  .purchase-modal {
    &__section {
      margin-top: 12px;

      &-title {
        font-weight: 600;
        font-size: 15px;
        color: #333;
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    }

    &__total {
      text-align: right;
      margin-top: 8px;
      color: #333;
    }
  }
</style>
