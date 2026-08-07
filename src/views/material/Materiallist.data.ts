import {BasicColumn} from '/@/components/Table';
import {FormSchema} from '/@/components/Table';
import { rules} from '/@/utils/helper/validator';
import { render } from '/@/utils/common/renderUtils';
import { getWeekMonthQuarterYear } from '/@/utils';
//列表数据
export const columns: BasicColumn[] = [
   {
    title: '关联号',
    align:"center",
    dataIndex: 'projectid_dictText'
   },
   {
    title: '项目名称',
    align:"center",
    dataIndex: 'projectname_dictText'
   },
   {
    title: '申请类型',
    align:"center",
    dataIndex: 'type'
   },
   {
    title: '状态',
    align:"center",
    dataIndex: 'status'
   },
   {
    title: '备注',
    align:"center",
    dataIndex: 'text'
   },
   {
    title: '创建人',
    align:"center",
    dataIndex: 'createBy'
   },
   {
    title: '创建日期',
    align:"center",
    dataIndex: 'createTime'
   },
   {
    title: '使用日期',
    align:"center",
    sorter: true,
    dataIndex: 'useTime'
   },
   {
    title: '所属部门',
    align:"center",
    dataIndex: 'sysOrgCode'
   },
];
//查询数据
export const searchFormSchema: FormSchema[] = [
	{
      label: "关联号",
      field: 'projectid',
      component: 'JSearchSelect',
      componentProps:{
         dict:""
      },
      //colProps: {span: 6},
 	},
	{
      label: "项目名称",
      field: 'projectname',
      component: 'JSearchSelect',
      componentProps:{
         dict:""
      },
      //colProps: {span: 6},
 	},
	{
      label: "申请类型",
      field: 'type',
      component: 'InputNumber',
      //colProps: {span: 6},
 	},
	{
      label: "状态",
      field: 'status',
      component: 'InputNumber',
      //colProps: {span: 6},
 	},
	{
      label: "使用日期",
      field: 'useTime',
      component: 'DatePicker',
      componentProps: {
         showTime:true,
         valueFormat: 'YYYY-MM-DD HH:mm:ss'
       },
      //colProps: {span: 6},
 	},
];
//表单数据
export const formSchema: FormSchema[] = [
  {
    label: '关联号',
    field: 'projectid',
    component: 'JSearchSelect',
    componentProps:{
       dict:""
    },
    dynamicRules: ({model,schema}) => {
          return [
                 { required: true, message: '请输入关联号!'},
          ];
     },
    dynamicDisabled:true
  },
  {
    label: '项目名称',
    field: 'projectname',
    component: 'JSearchSelect',
    componentProps:{
       dict:""
    },
    dynamicRules: ({model,schema}) => {
          return [
                 { required: true, message: '请输入项目名称!'},
          ];
     },
  },
  {
    label: '备注',
    field: 'text',
    component: 'InputNumber',
  },
  {
    label: '使用日期',
    field: 'useTime',
    component: 'DatePicker',
    componentProps: {
       showTime: true,
       valueFormat: 'YYYY-MM-DD HH:mm:ss'
     },
    dynamicRules: ({model,schema}) => {
          return [
                 { required: true, message: '请输入使用日期!'},
          ];
     },
  },
	// TODO 主键隐藏字段，目前写死为ID
	{
	  label: '',
	  field: 'id',
	  component: 'Input',
	  show: false
	},
];

// 高级查询数据
export const superQuerySchema = {
  projectid: {title: '关联号',order: 0,view: 'number', type: 'number',dictCode: '',},
  projectname: {title: '项目名称',order: 1,view: 'sel_search', type: 'string',dictCode: '',},
  type: {title: '申请类型',order: 2,view: 'number', type: 'number',},
  status: {title: '状态',order: 3,view: 'number', type: 'number',},
  text: {title: '备注',order: 4,view: 'number', type: 'number',},
  createBy: {title: '创建人',order: 5,view: 'text', type: 'string',},
  createTime: {title: '创建日期',order: 6,view: 'datetime', type: 'string',},
  useTime: {title: '使用日期',order: 7,view: 'datetime', type: 'string',},
  sysOrgCode: {title: '所属部门',order: 8,view: 'number', type: 'number',},
};

/**
* 流程表单调用这个方法获取formSchema
* @param param
*/
export function getBpmFormSchema(_formData): FormSchema[]{
  // 默认和原始表单保持一致 如果流程中配置了权限数据，这里需要单独处理formSchema
  return formSchema;
}