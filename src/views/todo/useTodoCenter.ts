import { computed, ref } from 'vue';
import { initDictOptions } from '/@/utils/dict/index';
import { getMyTodoPage, getMyTodoSummary } from './Todo.api';

export interface SystemTodo extends Recordable {
  id: string;
  bizId: string;
  bizSubId?: string;
  todoType: string;
  title: string;
  summary?: string | null;
  applyUserName?: string | null;
  realName?: string | null;
  scope: string;
  actionKey: string;
  actionParams: Recordable | string;
  projectName?: string;
  periodName?: string;
  submitterId?: string;
  submitterName?: string;
}

const todos = ref<SystemTodo[]>([]);
const total = ref(0);
const byType = ref<Recordable>({});
const loading = ref(false);
let pendingRequest: Promise<void> | null = null;

interface TodoTypeMeta {
  text: string;
  color?: string;
}

export const TODO_TYPE_DICT_CODE = 'todo_type';

const TODO_TYPE_FALLBACKS: Record<string, TodoTypeMeta> = {
  PROJECT_MEMBER_INVITATION: { text: '项目成员邀请', color: '#13c2c2' },
  PROJECT_PERIOD_APPROVAL: { text: '分期计划审批', color: '#1677ff' },
  PROJECT_PLAN_APPROVAL: { text: '历史方案审批', color: '#1677ff' },
  PROJECT_CANDIDATE_APPROVAL: { text: '报价审批', color: '#722ed1' },
  PROJECT_CONTRACT_APPROVAL: { text: '项目合同审批', color: '#722ed1' },
  PROJECT_MATERIAL_APPLY_APPROVAL: { text: '项目用料申请审批', color: '#fa8c16' },
  PROJECT_DELAY_APPROVAL: { text: '项目延期审批', color: '#faad14' },
  PROJECT_REWORK_APPROVAL: { text: '项目返工审批', color: '#fa541c' },
  PROJECT_ACCEPTANCE_FAILED: { text: '验收驳回提醒', color: '#ff4d4f' },
  PROJECT_ACCEPTANCE_FAILED_HANDLE: { text: '验收驳回提醒', color: '#ff4d4f' },
  PROJECT_ACCEPTANCE_PENDING: { text: '待验收', color: '#1677ff' },
  PROJECT_INTERNAL_ACCEPTANCE: { text: '项目内部验收', color: '#08979c' },
  PROJECT_EXTERNAL_ACCEPTANCE: { text: '项目外部验收', color: '#531dab' },
  STOCK_IN_APPROVAL: { text: '入库申请审批', color: '#2f54eb' },
  STOCK_IN_EXECUTE: { text: '入库执行待办，等待库管入库', color: '#52c41a' },
  STOCK_OUT_APPROVAL: { text: '出库申请审批', color: '#2f54eb' },
  STOCK_OUT_EXECUTE: { text: '出库执行待办，等待库管出库', color: '#52c41a' },
};

const todoTypeMap = ref<Record<string, TodoTypeMeta>>({ ...TODO_TYPE_FALLBACKS });
let todoTypeDictLoaded = false;
let pendingTodoTypeDict: Promise<void> | null = null;

async function loadTodoTypeDict() {
  if (todoTypeDictLoaded) return;
  if (pendingTodoTypeDict) return pendingTodoTypeDict;
  pendingTodoTypeDict = (async () => {
    try {
      const items: any[] = (await initDictOptions(TODO_TYPE_DICT_CODE)) || [];
      const configured: Record<string, TodoTypeMeta> = {};
      items.forEach((item) => {
        const value = String(item.value ?? '').trim();
        const text = String(item.text ?? item.label ?? '').trim();
        if (value && text) configured[value] = { text, color: item.color || TODO_TYPE_FALLBACKS[value]?.color };
      });
      todoTypeMap.value = { ...TODO_TYPE_FALLBACKS, ...configured };
      todoTypeDictLoaded = true;
    } catch {
      // 字典暂时不可用时保留与后端 todoType 同值的完整展示兜底。
      todoTypeMap.value = { ...TODO_TYPE_FALLBACKS };
    } finally {
      pendingTodoTypeDict = null;
    }
  })();
  return pendingTodoTypeDict;
}

export function unwrapTodoPage(payload: any) {
  let page = payload;
  for (let depth = 0; depth < 3 && page?.result && !Array.isArray(page.records); depth += 1) page = page.result;
  return {
    records: (Array.isArray(page) ? page : page?.records || []) as SystemTodo[],
    total: Number(page?.total ?? (Array.isArray(page) ? page.length : page?.records?.length) ?? 0),
  };
}

function unwrapSummary(payload: any) {
  let summary = payload;
  for (let depth = 0; depth < 3 && summary?.result; depth += 1) summary = summary.result;
  return summary || {};
}

export function parseTodoActionParams(value: unknown): Recordable {
  if (value && typeof value === 'object') return value as Recordable;
  const text = String(value || '').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const query = text.startsWith('?') ? text.slice(1) : text;
    return Object.fromEntries(new URLSearchParams(query));
  }
}

export function normalizeTodoRecord(todo: SystemTodo): SystemTodo {
  const params = parseTodoActionParams(todo.actionParams);
  return {
    ...todo,
    actionParams: params,
    projectName: todo.projectName || params.projectName || params.mainProjectName || '',
    periodName: todo.periodName || params.periodName || params.projectPeriodName || '',
    submitterId: todo.submitterId || params.submitterId || params.applyUserId || params.createUserId || '',
    submitterName: todo.submitterName || params.submitterName || params.applyUserName || params.createUserName || params.inviterName || '',
  };
}

function memberInvitationIdentity(todo: SystemTodo) {
  const identity = [todo.todoType, todo.actionKey, todo.title].filter(Boolean).join('|');
  if (!/MEMBER.*INVIT|PROJECT_MEMBER|成员邀请/i.test(identity)) return '';
  const params = parseTodoActionParams(todo.actionParams);
  const periodId = String(params.periodId || params.projectPeriodId || todo.periodId || '');
  return `member-invitation:${periodId || todo.bizId || todo.id}`;
}

function dedupeMemberInvitations(records: SystemTodo[]) {
  const seen = new Set<string>();
  const duplicatesByType: Record<string, number> = {};
  const deduped = records.filter((todo) => {
    const key = memberInvitationIdentity(todo);
    if (!key || !seen.has(key)) {
      if (key) seen.add(key);
      return true;
    }
    const type = String(todo.todoType || '');
    if (type) duplicatesByType[type] = (duplicatesByType[type] || 0) + 1;
    return false;
  });
  return { records: deduped, duplicateCount: records.length - deduped.length, duplicatesByType };
}

export function todoTypeText(type: unknown) {
  const value = String(type || '').trim();
  return todoTypeMap.value[value]?.text || value || '业务待办';
}

export function todoTypeColor(type: unknown) {
  const value = String(type || '').trim();
  return todoTypeMap.value[value]?.color || 'default';
}

export async function refreshTodos(_force = false) {
  if (pendingRequest) return pendingRequest;
  pendingRequest = (async () => {
    loading.value = true;
    try {
      const [pageResult, summaryResult] = await Promise.allSettled([
        getMyTodoPage({ pageNo: 1, pageSize: 100 }),
        getMyTodoSummary(),
        loadTodoTypeDict(),
      ]);
      if (pageResult.status === 'rejected') throw pageResult.reason;
      const page = unwrapTodoPage(pageResult.value);
      const deduped = dedupeMemberInvitations(page.records.map(normalizeTodoRecord));
      todos.value = deduped.records;
      if (summaryResult.status === 'fulfilled') {
        const summary = unwrapSummary(summaryResult.value);
        total.value = Math.max(deduped.records.length, Number(summary.total ?? page.total) - deduped.duplicateCount);
        byType.value = Object.fromEntries(
          Object.entries(summary.byType || {}).map(([type, count]) => [type, Math.max(0, Number(count) - (deduped.duplicatesByType[type] || 0))])
        );
      } else {
        total.value = Math.max(deduped.records.length, page.total - deduped.duplicateCount);
        byType.value = {};
      }
    } finally {
      loading.value = false;
      pendingRequest = null;
    }
  })();
  return pendingRequest;
}

export function useTodoCenter() {
  return {
    todos,
    todoTotal: computed(() => total.value),
    todoByType: computed(() => byType.value),
    todoLoading: loading,
    refreshTodos,
  };
}
