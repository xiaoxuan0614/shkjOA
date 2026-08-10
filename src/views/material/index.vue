<template>
  <div>
    <!--引用表格-->
   <BasicTable @register="registerTable" :rowSelection="rowSelection">
     <!--插槽:table标题-->
      <template #tableTitle>
          <a-button type="primary"   @click="handleAdd" preIcon="ant-design:plus-outlined"> 新增</a-button>
          <a-button type="primary" preIcon="ant-design:file-add-outlined" @click="handleApply"> 发起申请</a-button>
          <a-button
type="primary"
          preIcon="ant-design:export-outlined" @click="onExportXls"> 导出</a-button>
          <j-upload-button type="primary" v-auth="'materiallist:importExcel'" preIcon="ant-design:import-outlined" @click="onImportXls">导入</j-upload-button>

          <a-dropdown v-if="selectedRowKeys.length > 0">
              <template #overlay>
                <a-menu>
                  <a-menu-item key="1" @click="batchHandleDelete">
                    <Icon icon="ant-design:delete-outlined"></Icon>
                    删除
                  </a-menu-item>
                </a-menu>
              </template>
              <a-button v-auth="'materiallist:deleteBatch'">批量操作
                <Icon icon="mdi:chevron-down"></Icon>
              </a-button>
        </a-dropdown>
        <!-- 高级查询 -->
        <!-- <super-query :config="superQueryConfig" @search="handleSuperQuery" /> -->
      </template>
       <!--操作栏-->
      <template #action="{ record }">
        <TableAction :actions="getTableAction(record)" :dropDownActions="getDropDownAction(record)"/>
      </template>
      <!--字段回显插槽-->
      <template #bodyCell="{ column, record, index, text }">
      </template>
    </BasicTable>
    <!-- 表单区域 -->
    <MateriallistModal @register="registerModal" @success="handleSuccess"></MateriallistModal>
  </div>
</template>

<script lang="ts" name="mtl-materiallist" setup>
  import {ref, reactive, onMounted} from 'vue';
  import { useRouter } from 'vue-router';
  import {BasicTable, TableAction} from '/@/components/Table';
  import {useModal} from '/@/components/Modal';
  import { useListPage } from '/@/hooks/system/useListPage'
  import MateriallistModal from './components/MateriallistModal.vue'
  import {columns, searchFormSchema, superQuerySchema} from './Materiallist.data';
  import {list, deleteOne, batchDelete, getImportUrl,getExportUrl} from './Materiallist.api';
  // import { useUserStore } from '/@/store/modules/user';
  import { useMessage } from '/@/hooks/web/useMessage';
  import { getDateByPicker } from '/@/utils';
  const router = useRouter();
  //日期个性化选择
  const fieldPickers = reactive({
  });
  const queryParam = reactive<any>({});
  // const checkedKeys = ref<Array<string | number>>([]);
  // const userStore = useUserStore();
  // const { createMessage } = useMessage();
  //注册model
  const [registerModal, {openModal}] = useModal();
  //注册table数据
  const { prefixCls,tableContext,onExportXls,onImportXls } = useListPage({
      tableProps:{
           title: '物料',
           api: list,
           columns,
           canResize:true,
           formConfig: {
              //labelWidth: 120,
              schemas: searchFormSchema,
              autoSubmitOnEnter:true,
              showAdvancedButton:true,
              fieldMapToNumber: [
              ],
              fieldMapToTime: [
              ],
            },
           actionColumn: {
               width: 120,
               fixed:'right'
            },
            beforeFetch: (params) => {
              if (params && fieldPickers) {
                for (let key in fieldPickers) {
                  if (params[key]) {
                    params[key] = getDateByPicker(params[key], fieldPickers[key]);
                  }
                }
              }
              return Object.assign(params, queryParam);
            },
      },
       exportConfig: {
            name:"物料",
            url: getExportUrl,
            params: queryParam,
          },
          importConfig: {
            url: getImportUrl,
            success: handleSuccess
          },
  })

  const [registerTable, {reload},{ rowSelection, selectedRowKeys }] = tableContext

  // 高级查询配置
  const superQueryConfig = reactive(superQuerySchema);

  /**
   * 高级查询事件
   */
  function handleSuperQuery(params) {
    Object.keys(params).map((k) => {
      queryParam[k] = params[k];
    });
    reload();
  }
   /**
    * 新增事件
    */
  function handleAdd() {
     openModal(true, {
       isUpdate: false,
       showFooter: true,
     });
  }
   /**
    * 发起申请事件: 跳转物料申请页
    */
  function handleApply() {
     router.push('/material/apply');
  }
   /**
    * 编辑事件
    */
  function handleEdit(record: Recordable) {
     openModal(true, {
       record,
       isUpdate: true,
       showFooter: true,
     });
   }
   /**
    * 详情
   */
  function handleDetail(record: Recordable) {
     openModal(true, {
       record,
       isUpdate: true,
       showFooter: false,
     });
   }
   /**
    * 删除事件
    */
  async function handleDelete(record) {
     await deleteOne({id: record.id}, handleSuccess);
   }
   /**
    * 批量删除事件
    */
  async function batchHandleDelete() {
     await batchDelete({ids: selectedRowKeys.value}, handleSuccess);
   }
   /**
    * 成功回调
    */
  function handleSuccess() {
      (selectedRowKeys.value = []) && reload();
   }
   /**
      * 操作栏
      */
  function getTableAction(record){
       return [
         {
           label: '编辑',
           onClick: handleEdit.bind(null, record),
           auth: 'mtl:materiallist:edit'
         }
       ]
   }
     /**
        * 下拉操作栏
        */
  function getDropDownAction(record){
       return [
         {
           label: '详情',
           onClick: handleDetail.bind(null, record),
         }, {
           label: '删除',
           popConfirm: {
             title: '是否确认删除',
             confirm: handleDelete.bind(null, record),
             placement: 'topLeft',
           },
           auth: 'mtl:materiallist:delete'
         }
       ]
   }

onMounted(() => {
  console.log('物料列表页面加载完成');
  // userStore.getUserInfo();
})


</script>

<style lang="less" scoped>
  :deep(.ant-picker),:deep(.ant-input-number){
    width: 100%;
  }
</style>