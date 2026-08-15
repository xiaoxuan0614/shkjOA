import { ref } from 'vue';

export interface FuzzyOption {
  label: string;
  value: string;
  [key: string]: any;
}

/**
 * 「初次点击不展示、输入后模糊」下拉统一（供应商/用户/品牌，与分期远程搜索行为一致）
 *
 * 用法：
 *   const fz = useFuzzySelect();
 *   fz.setAll(全量候选);                     // 打开时加载全量池(只做过滤，不塞进 options)
 *   updateSchema({ componentProps: { options: fz.options, onSearch: fz.onSearch, filterOption: false, ... } });
 *   编辑回显：fz.preselect(record.userId)     // 把当前值对应选项塞回，保证显示 label
 *
 * 行为：options 初始为空(初次点击不展示下拉)，输入后按全量池模糊过滤(onSearch)。
 */
export function useFuzzySelect() {
  const options = ref<FuzzyOption[]>([]);
  const full = ref<FuzzyOption[]>([]);

  /** 设置全量候选池(只读，供过滤用，不直接进 options) */
  function setAll(list: FuzzyOption[]) {
    full.value = list || [];
  }

  /** 输入后模糊过滤(空输入清空，保证初次点击不展示) */
  function onSearch(keyword: string) {
    if (!keyword) {
      options.value = [];
      return;
    }
    const kw = String(keyword).toLowerCase();
    options.value = full.value.filter((o) => String(o.label).toLowerCase().includes(kw));
  }

  /** 编辑回显：把指定值的选项塞回 options(否则 value 只显示原始 id 不显示姓名) */
  function preselect(value?: any) {
    if (value == null || value === '') return;
    const hit = full.value.find((o) => String(o.value) === String(value));
    if (hit && !options.value.some((o) => String(o.value) === String(value))) {
      options.value = [hit, ...options.value];
    }
  }

  return { options, onSearch, preselect, setAll };
}
