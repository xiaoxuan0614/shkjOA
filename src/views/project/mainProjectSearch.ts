import { ref } from 'vue';

type Option = { value: string; label: string };
type Page = { records: { projectId?: string; projectName?: string }[]; total: number };

/** The endpoint pages periods; selector identity is always the parent projectId. */
export function useMainProjectSearch(fetchPage: (params: { pageNo: number; pageSize: number; keyword?: string }) => Promise<Page>, selected: () => string | undefined) {
  const options = ref<Option[]>([]), loading = ref(false), error = ref(''), hasMore = ref(false);
  let version = 0, page = 0, keyword = '', active = false, loaded = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function load(append = false) {
    if (!active || (append && (loading.value || !hasMore.value))) return;
    const current = ++version;
    const nextPage = append ? page + 1 : 1;
    loading.value = true;
    error.value = '';
    try {
      const data = await fetchPage({ pageNo: nextPage, pageSize: 20, ...(keyword ? { keyword } : {}) });
      if (!active || current !== version) return;
      if (!Array.isArray(data?.records) || !Number.isFinite(Number(data.total))) throw new Error('主项目列表响应异常');
      const keep = append ? options.value : options.value.filter((item) => item.value === selected());
      const merged = new Map(keep.map((item) => [item.value, item]));
      for (const item of data.records) {
        const id = String(item.projectId || '').trim();
        if (id) merged.set(id, { value: id, label: item.projectName?.trim() || '未命名主项目' });
      }
      options.value = [...merged.values()];
      page = nextPage;
      hasMore.value = data.records.length > 0 && page * 20 < Number(data.total);
      loaded = true;
    } catch (e) {
      if (active && current === version) error.value = e instanceof Error ? e.message : '主项目加载失败，请重试';
    } finally {
      if (active && current === version) loading.value = false;
    }
  }
  function close() { active = false; version++; clearTimeout(timer); timer = undefined; loading.value = false; }
  function reset() {
    close(); active = true; page = 0; keyword = ''; loaded = false;
    options.value = []; error.value = ''; hasMore.value = false;
  }
  function search(value: string) {
    if (!active) return;
    keyword = value.trim(); version++; clearTimeout(timer);
    loaded = false; page = 0; hasMore.value = false; error.value = '';
    options.value = options.value.filter((item) => item.value === selected());
    loading.value = true;
    timer = setTimeout(() => { timer = undefined; void load(); }, 300);
  }
  function open(visible: boolean) { if (visible && !loaded && !loading.value) void load(); }
  function retry() { clearTimeout(timer); timer = undefined; return load(page > 0); }
  return { options, loading, error, hasMore, reset, close, search, open, retry, loadMore: () => load(true) };
}
