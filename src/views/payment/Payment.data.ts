import { BasicColumn } from '/@/components/Table';
import { FormSchema } from '/@/components/Table';
import { loadDictOptions } from '../project/Project.data';

/**
 * 回款管理 - 常量选项(字段对齐后端 /project/contract 合同管理)
 * ⚠️ 原则: 类型/状态类下拉统一走字典(contract_type / payback_type), 不再硬编码
 */

// 合同类型(字典 contract_type)
export const loadContractTypeOptions = () => loadDictOptions('contract_type');

// 回款类型(字典 payback_type)
export const loadPaybackTypeOptions = () => loadDictOptions('payback_type');

/**
 * 合同列表列(后端 project_contract 字段)
 */
export const columns: BasicColumn[] = [
  { title: '合同编号', align: 'center', dataIndex: 'contractNo' },
  { title: '合同名称', align: 'center', dataIndex: 'contractName' },
  { title: '合同类型', align: 'center', dataIndex: 'contractType' },
  { title: '合同签订日期', align: 'center', dataIndex: 'contractSignedDate' },
  { title: '合同金额', align: 'center', dataIndex: 'contractAmount' },
  { title: '已回款金额', align: 'center', dataIndex: 'receivedAmount' },
  {
    title: '未回款金额',
    align: 'center',
    dataIndex: 'unpaidAmount',
    customRender: ({ record }) => {
      const total = Number(record.contractAmount) || 0;
      const paid = Number(record.receivedAmount) || 0;
      return total - paid;
    },
  },
  { title: '状态', align: 'center', dataIndex: 'status' },
];

/**
 * 合同列表搜索(后端支持字段)
 */
export const searchFormSchema: FormSchema[] = [
  {
    label: '合同编号',
    field: 'contractNo',
    component: 'Input',
    componentProps: { placeholder: '请输入合同编号' },
  },
  {
    label: '合同名称',
    field: 'contractName',
    component: 'Input',
    componentProps: { placeholder: '请输入合同名称' },
  },
  {
    label: '合同类型',
    field: 'contractType',
    component: 'ApiSelect',
    componentProps: { api: loadContractTypeOptions, placeholder: '请选择合同类型' },
  },
];
