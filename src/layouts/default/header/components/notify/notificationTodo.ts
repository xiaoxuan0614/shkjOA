import type { SystemTodo } from '/@/views/todo/useTodoCenter';
import type { NotificationRecord } from './notification.api';

/** Only typed business metadata; never forward arbitrary server routes. */
export function notificationTodo(item: NotificationRecord | null): SystemTodo | null {
  try {
    const meta = JSON.parse(item?.msgAbstract || '{}');
    if (meta.businessType !== 'TODO' || !meta.todoId || !meta.bizId || !meta.todoType) return null;
    const raw = typeof meta.actionParams === 'string' ? JSON.parse(meta.actionParams || '{}') : meta.actionParams;
    const params: Record<string, string> = {};
    for (const key of ['periodId', 'projectId', 'applyId', 'candidateId', 'approvalId', 'acceptanceId', 'sourceAcceptanceId', 'acceptType', 'reworkId', 'id']) {
      if (typeof raw?.[key] === 'string') params[key] = raw[key];
    }
    return { id: String(meta.todoId), bizId: String(meta.bizId), bizSubId: String(meta.bizSubId || ''),
      todoType: String(meta.todoType), actionKey: String(meta.actionKey || ''), actionParams: params,
      title: item?.titile || '业务通知', scope: '', summary: '' };
  } catch {
    return null;
  }
}
