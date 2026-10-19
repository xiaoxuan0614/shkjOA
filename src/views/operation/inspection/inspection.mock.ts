// Isolated demo domain: no business API, real customers, or real assignments.
export interface CheckItem {
  id: string;
  text: string;
}
export interface InspectionObject {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
  remark: string;
  items: CheckItem[];
}
export interface PointSelection {
  objectId: string;
  itemIds: string[];
}
export interface InspectionPoint {
  id: string;
  name: string;
  code: string;
  kind: '通用' | '定制';
  customer: string;
  remark: string;
  selections: PointSelection[];
}
export interface InspectionTask {
  id: string;
  code: string;
  customer: string;
  inspector: string;
  start: string;
  end: string;
  times: number;
  remark: string;
  points: { pointId: string; quantity: number }[];
}
export interface Evidence {
  name: string;
  url: string;
  type: string;
}
export interface Answer {
  id: string;
  objectName: string;
  text: string;
  result: '' | '正常' | '异常';
}
export interface Sheet {
  id: string;
  pointName: string;
  position: string;
  answers: Answer[];
  conclusion: string;
  files: Evidence[];
  submittedAt: string;
  closure: string;
  closedAt: string;
  closedBy: string;
  closureFiles: Evidence[];
}
export interface InspectionRun {
  id: string;
  taskId: string;
  code: string;
  customer: string;
  inspector: string;
  start: string;
  end: string;
  round: number;
  sheets: Sheet[];
}
export interface InspectionState {
  version: 1;
  objects: InspectionObject[];
  points: InspectionPoint[];
  tasks: InspectionTask[];
  runs: InspectionRun[];
}
export const MOCK_KEY = 'shkj:inspection:mock:v1:admin';
export const demoCustomers = ['示例客户·海港堆场', '示例客户·物流园区'];
export const demoInspectors = ['演示巡检员甲', '演示巡检员乙'];
export const uid = () => globalThis.crypto.randomUUID();
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function ensure(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function uniqueCode(rows: { id: string; code: string }[], row: { id: string; code: string }) {
  ensure(row.code.trim(), '请填写编号');
  ensure(!rows.some((x) => x.id !== row.id && x.code.trim() === row.code.trim()), '编号已存在，请更换');
}
export function saveObject(state: InspectionState, row: InspectionObject) {
  ensure(row.name.trim(), '请填写巡检对象名称');
  uniqueCode(state.objects, row);
  ensure(row.items.length && row.items.every((x) => x.text.trim()), '请至少添加一条检查项，并填写完整');
  ensure(new Set(row.items.map((x) => x.text.trim())).size === row.items.length, '检查项内容不能重复');
  const used = state.points.some((p) =>
    p.selections.some((s) => s.objectId === row.id && s.itemIds.some((id) => !row.items.some((i) => i.id === id)))
  );
  ensure(!used, '被巡检点引用的检查项不能删除，请先调整巡检点');
  upsert(state.objects, row);
}
export function savePoint(state: InspectionState, row: InspectionPoint) {
  ensure(row.name.trim(), '请填写巡检点名称');
  uniqueCode(state.points, row);
  ensure(row.kind !== '定制' || row.customer, '定制巡检点请选择客户');
  ensure(row.selections.length, '请选择至少一个检查项');
  row.selections.forEach((s) => {
    const obj = state.objects.find((o) => o.id === s.objectId);
    ensure(
      obj?.enabled && s.itemIds.length && s.itemIds.every((id) => obj.items.some((i) => i.id === id)),
      '所选对象已停用或检查项已失效，请重新选择'
    );
  });
  upsert(state.points, row);
}
export function saveTask(state: InspectionState, row: InspectionTask) {
  uniqueCode(state.tasks, row);
  ensure(row.customer && row.inspector, '请选择客户和演示巡检人');
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(row.start) && /^\d{4}-\d{2}-\d{2}$/.test(row.end) && row.start <= row.end, '请选择正确的起止日期');
  ensure(Number.isInteger(row.times) && row.times >= 1 && row.times <= 12, '每月次数应为1～12的整数');
  ensure(row.points.length, '请选择至少一个巡检点');
  ensure(new Set(row.points.map((p) => p.pointId)).size === row.points.length, '不能重复选择巡检点');
  row.points.forEach((p) => {
    const point = state.points.find((x) => x.id === p.pointId);
    ensure(point && (point.kind === '通用' || point.customer === row.customer), '巡检点不适用于当前客户');
    ensure(Number.isInteger(p.quantity) && p.quantity >= 1 && p.quantity <= 20, '巡检点数量应为1～20的整数');
    point.selections.forEach((s) => ensure(state.objects.find((o) => o.id === s.objectId)?.enabled, '巡检点包含停用对象，请先调整配置'));
  });
  ensure(months(row.start, row.end).length <= 24, '演示任务有效期最多24个月');
  ensure(
    months(row.start, row.end).length * row.times * row.points.reduce((n, p) => n + p.quantity, 0) <= 1000,
    '演示任务最多生成1000张巡检单，请缩小范围'
  );
  upsert(state.tasks, row);
}
function upsert<T extends { id: string }>(rows: T[], row: T) {
  const i = rows.findIndex((x) => x.id === row.id);
  if (i < 0) rows.push(clone(row));
  else rows[i] = clone(row);
}
function months(start: string, end: string) {
  const result: string[] = [];
  let [y, m] = start.slice(0, 7).split('-').map(Number);
  while (`${y}-${String(m).padStart(2, '0')}` <= end.slice(0, 7) && result.length <= 24) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) {
      y++;
      m = 1;
    }
  }
  return result;
}
export function generateRuns(state: InspectionState, task: InspectionTask) {
  // Validate without mutating the saved configuration. Stable key prevents duplicates.
  saveTask(clone(state), task);
  let created = 0;
  for (const month of months(task.start, task.end)) {
    const [y, m] = month.split('-').map(Number);
    const last = `${month}-${new Date(y, m, 0).getDate()}`;
    for (let round = 1; round <= task.times; round++) {
      const id = `${task.id}:${month}:${round}`;
      if (state.runs.some((r) => r.id === id)) continue;
      const sheets: Sheet[] = [];
      task.points.forEach((p) => {
        const point = state.points.find((x) => x.id === p.pointId)!;
        for (let i = 1; i <= p.quantity; i++) {
          const answers = point.selections.flatMap((s) => {
            const obj = state.objects.find((o) => o.id === s.objectId)!;
            return s.itemIds.map((itemId) => ({
              id: uid(),
              objectName: obj.name,
              text: obj.items.find((x) => x.id === itemId)!.text,
              result: '' as const,
            }));
          });
          sheets.push({
            id: uid(),
            pointName: point.name,
            position: `${point.name}-${i}`,
            answers,
            conclusion: '',
            files: [],
            submittedAt: '',
            closure: '',
            closedAt: '',
            closedBy: '',
            closureFiles: [],
          });
        }
      });
      state.runs.push({
        id,
        taskId: task.id,
        code: `${task.code}-${month.replace('-', '')}-${round}`,
        customer: task.customer,
        inspector: task.inspector,
        start: task.start > `${month}-01` ? task.start : `${month}-01`,
        end: task.end < last ? task.end : last,
        round,
        sheets,
      });
      created++;
    }
  }
  return created;
}
export const hasAbnormal = (sheet: Sheet) => sheet.answers.some((a) => a.result === '异常');
export function runSummary(run: InspectionRun) {
  const done = run.sheets.filter((s) => s.submittedAt).length;
  const started = run.sheets.some((s) => s.answers.some((a) => a.result));
  const abnormal = run.sheets.filter((s) => s.submittedAt && hasAbnormal(s));
  return {
    done,
    total: run.sheets.length,
    status: done === run.sheets.length ? '已完成' : started ? '进行中' : '未开始',
    result: abnormal.length ? '异常' : done === run.sheets.length ? '正常' : '待完成',
    closure: !abnormal.length ? '无需处理' : abnormal.every((s) => s.closedAt) ? '已办结' : '待处理',
  };
}
export function submitSheet(sheet: Sheet) {
  ensure(!sheet.submittedAt, '该巡检单已提交，不可重复提交');
  ensure(sheet.position.trim(), '请填写实际位置或编号');
  ensure(sheet.answers.length && sheet.answers.every((a) => a.result), '请完成全部检查项');
  ensure(sheet.conclusion.trim(), '请填写巡检结论');
  sheet.submittedAt = new Date().toISOString();
}
export function closeSheet(sheet: Sheet, actor: string) {
  ensure(sheet.submittedAt && hasAbnormal(sheet) && !sheet.closedAt, '只有已提交且未办结的异常巡检单可以办结');
  ensure(sheet.closure.trim(), '请填写办结说明');
  sheet.closedAt = new Date().toISOString();
  sheet.closedBy = actor;
}
export function removeConfig(state: InspectionState, type: 'objects' | 'points' | 'tasks', id: string) {
  if (type === 'objects') ensure(!state.points.some((p) => p.selections.some((s) => s.objectId === id)), '该对象已被巡检点引用，请停用或先解除引用');
  if (type === 'points') ensure(!state.tasks.some((t) => t.points.some((p) => p.pointId === id)), '该巡检点已被任务引用，不能删除');
  if (type === 'tasks') ensure(!state.runs.some((r) => r.taskId === id), '任务已生成记录，不能删除');
  state[type] = state[type].filter((row) => row.id !== id) as any;
}
export function seedState(): InspectionState {
  const state: InspectionState = {
    version: 1,
    objects: [
      {
        id: 'camera',
        code: 'DX001',
        name: '车牌摄像头',
        enabled: true,
        remark: '闸口摄像设备检查标准',
        items: [
          { id: 'c1', text: '摄像头外观是否完好' },
          { id: 'c2', text: '摄像头立柱是否牢固' },
          { id: 'c3', text: '摄像头是否正常抓拍' },
        ],
      },
      {
        id: 'barrier',
        code: 'DX002',
        name: '道闸',
        enabled: true,
        remark: '',
        items: [
          { id: 'b1', text: '道闸起落是否正常' },
          { id: 'b2', text: '防砸保护是否正常' },
        ],
      },
      {
        id: 'host',
        code: 'DX003',
        name: '后端主机',
        enabled: true,
        remark: '',
        items: [
          { id: 'h1', text: '主机能否正常开机' },
          { id: 'h2', text: '软件是否正常运行' },
        ],
      },
    ],
    points: [
      {
        id: 'gate',
        code: 'XJ001',
        name: '智能闸口',
        kind: '通用',
        customer: '',
        remark: '每个通道一张巡检单',
        selections: [
          { objectId: 'camera', itemIds: ['c1', 'c2', 'c3'] },
          { objectId: 'barrier', itemIds: ['b1', 'b2'] },
        ],
      },
      {
        id: 'room',
        code: 'XJ002',
        name: '机房',
        kind: '定制',
        customer: demoCustomers[1],
        remark: '',
        selections: [{ objectId: 'host', itemIds: ['h1', 'h2'] }],
      },
    ],
    tasks: [],
    runs: [],
  };
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const task: InspectionTask = {
    id: 'demo-task',
    code: 'RW001',
    customer: demoCustomers[0],
    inspector: demoInspectors[0],
    start: `${month}-01`,
    end: `${month}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`,
    times: 1,
    remark: '演示：两进一出，三张巡检单',
    points: [{ pointId: 'gate', quantity: 3 }],
  };
  saveTask(state, task);
  generateRuns(state, task);
  const [first, second, third] = state.runs[0].sheets;
  first.position = '入口一';
  first.answers.forEach((a) => (a.result = '正常'));
  first.conclusion = '设备运行正常';
  submitSheet(first);
  second.position = '入口二';
  second.answers.forEach((a) => (a.result = '正常'));
  second.answers[0].result = '异常';
  second.conclusion = '外壳松动，待紧固处理';
  submitSheet(second);
  third.position = '出口一';
  return state;
}
