import { defHttp } from '/@/utils/http/axios';

export interface TransferPerson { value: string; label: string }
export async function transferPeople(): Promise<TransferPerson[]> {
  const data = await defHttp.get({ url: '/repair/options', params: { type: 'internal' } });
  if (!Array.isArray(data) || data.some(item => typeof item?.value !== 'string' || !item.value.trim() || typeof item.label !== 'string')) {
    throw new Error('接收人候选数据异常，请重新读取');
  }
  return data;
}

export function transferReviewFields(approve: boolean, selected: string, original: string, people: TransferPerson[]) {
  if (!approve) return {};
  if (!selected || !people.some(person => person.value === selected)) throw new Error('请选择有效的接收人');
  return selected === original ? {} : { transferTargetUserId: selected };
}
