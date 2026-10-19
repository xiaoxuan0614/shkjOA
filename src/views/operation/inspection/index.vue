<template>
  <a-result v-if="!allowed" status="403" title="仅 admin 可查看巡检 Mock 预览" />
  <div v-else class="inspection-page">
    <!-- THESIS: 四层配置与执行分离。OWN-WORLD: 沿用 OA 蓝白、公共表格。STORY: 配置、生成、填写、办结。
         FIRST VIEWPORT: 简洁页头、Mock边界、四层导航及列表。FORM: 用户确认的墨刀结构，不建立新视觉体系。
         FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->
    <header class="inspection-header">
      <div
        ><h1>巡检管理 <a-tag color="blue">Mock 预览</a-tag></h1
        ><p>配置检查标准，按周期执行巡检，跟进异常办结。</p></div
      >
    </header>
    <a-alert type="info" show-icon message="仅本浏览器演示数据，不连接真实客户、派单、审批或业务接口。" />
    <a-alert v-if="storageError" type="error" show-icon :message="storageError" />
    <section v-if="!editor && !activeRun" class="inspection-surface">
      <a-tabs
        v-model:activeKey="tab"
        @change="
          keyword = '';
          filterStatus = undefined;
        "
      >
        <a-tab-pane key="objects" tab="巡检对象" /><a-tab-pane key="points" tab="巡检点" /> <a-tab-pane key="tasks" tab="巡检任务" /><a-tab-pane
          key="runs"
          tab="巡检记录"
        />
      </a-tabs>
      <div class="inspection-tools">
        <a-input-search v-model:value="keyword" allow-clear placeholder="搜索名称、编号或客户" aria-label="搜索巡检数据" />
        <a-select
          v-if="tab === 'runs'"
          v-model:value="filterStatus"
          allow-clear
          placeholder="执行状态"
          :options="statusOptions"
          aria-label="执行状态"
        />
        <a-button
          @click="
            keyword = '';
            filterStatus = undefined;
          "
          >重置查询</a-button
        >
        <a-button v-if="tab !== 'runs'" type="primary" preIcon="ant-design:plus-outlined" @click="openEditor()">新增{{ labels[tab] }}</a-button>
      </div>
      <BasicTable
        :key="tab"
        :columns="columns"
        :data-source="rows"
        row-key="id"
        :show-index-column="false"
        :show-table-setting="true"
        :table-setting="{ redo: false, size: true, setting: true, fullScreen: false }"
        :can-resize="false"
        :pagination="{ pageSize: 10, showSizeChanger: true }"
        :scroll="{ x: 1050 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'name'"
            ><a @click="openEditor(record)">{{ record.name }}</a
            ><div class="secondary">{{ record.code }}</div></template
          >
          <template v-else-if="column.dataIndex === 'enabled'"
            ><a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '启用' : '停用' }}</a-tag></template
          >
          <template v-else-if="column.dataIndex === 'status'"
            ><a-tag :color="record.status === '已完成' ? 'green' : record.status === '进行中' ? 'blue' : 'default'">{{
              record.status
            }}</a-tag></template
          >
          <template v-else-if="column.dataIndex === 'result'"
            ><a-tag :color="record.result === '异常' ? 'red' : record.result === '正常' ? 'green' : 'default'">{{ record.result }}</a-tag></template
          >
          <template v-else-if="column.key === 'action'">
            <a-space wrap>
              <template v-if="tab === 'runs'"
                ><a-button type="link" @click="openRun(record.id)">查看 / 填写</a-button
                ><a-button type="link" @click="exportRun(record.id)">导出</a-button></template
              >
              <template v-else>
                <a-button type="link" @click="openEditor(record)">编辑</a-button
                ><a-button type="link" @click="openEditor(record, true)">复制</a-button>
                <a-button v-if="tab === 'tasks'" type="link" @click="generate(record.id)">生成记录</a-button>
                <a-popconfirm title="确定删除这条演示配置？已被引用的配置不能删除。" @confirm="removeRow(record.id)"
                  ><a-button type="link" danger>删除</a-button></a-popconfirm
                >
              </template>
            </a-space>
          </template>
        </template>
      </BasicTable>
    </section>

    <section v-if="editor" class="inspection-surface editor">
      <div class="section-header"
        ><h2>{{ editorTitle }}</h2
        ><a-space><a-button @click="leaveEditor">取消</a-button><a-button type="primary" @click="saveEditor">保存配置</a-button></a-space></div
      >
      <a-form layout="vertical">
        <div class="form-grid">
          <a-form-item v-if="tab !== 'tasks'" label="名称" required><a-input v-model:value="draft.name" :maxlength="80" /></a-form-item>
          <a-form-item label="编号" required><a-input v-model:value="draft.code" :maxlength="40" /></a-form-item>
          <a-form-item v-if="tab === 'objects'" label="启用状态"
            ><a-switch v-model:checked="draft.enabled" checked-children="启用" un-checked-children="停用"
          /></a-form-item>
          <a-form-item v-if="tab === 'points'" label="巡检类型" required
            ><a-radio-group v-model:value="draft.kind"
              ><a-radio value="通用">通用</a-radio><a-radio value="定制">定制</a-radio></a-radio-group
            ></a-form-item
          >
          <a-form-item v-if="tab === 'tasks' || (tab === 'points' && draft.kind === '定制')" label="客户（演示）" required
            ><a-select v-model:value="draft.customer" show-search :options="customerOptions"
          /></a-form-item>
          <a-form-item v-if="tab === 'tasks'" label="巡检人（演示）" required
            ><a-select v-model:value="draft.inspector" :options="inspectorOptions"
          /></a-form-item>
          <template v-if="tab === 'tasks'">
            <a-form-item label="有效期开始" required><a-date-picker v-model:value="draft.start" value-format="YYYY-MM-DD" /></a-form-item>
            <a-form-item label="有效期结束" required><a-date-picker v-model:value="draft.end" value-format="YYYY-MM-DD" /></a-form-item>
            <a-form-item label="每月巡检次数" required><a-input-number v-model:value="draft.times" :min="1" :max="12" :precision="0" /></a-form-item>
          </template>
        </div>
        <a-form-item label="备注"><a-textarea v-model:value="draft.remark" :maxlength="500" :rows="2" show-count /></a-form-item>
      </a-form>
      <template v-if="tab === 'objects'">
        <div class="section-header"><h3>检查项</h3><a-button @click="draft.items.push({ id: uid(), text: '' })">添加检查项</a-button></div>
        <a-empty v-if="!draft.items.length" description="添加该对象需要检查的内容" />
        <div v-for="(item, index) in draft.items" :key="item.id" class="check-row">
          <span>{{ index + 1 }}</span
          ><a-input v-model:value="item.text" :maxlength="200" :aria-label="`检查项${index + 1}`" placeholder="例如：摄像头是否正常抓拍" />
          <a-button :disabled="index === 0" @click="moveItem(index, -1)">上移</a-button
          ><a-button :disabled="index === draft.items.length - 1" @click="moveItem(index, 1)">下移</a-button>
          <a-button danger @click="draft.items.splice(index, 1)">删除</a-button>
        </div>
      </template>
      <template v-if="tab === 'points'">
        <div class="section-header"
          ><h3>巡检对象及检查项</h3
          ><a-button
            @click="
              picker = true;
              pickerSearch = '';
            "
            >选择巡检对象</a-button
          ></div
        >
        <a-empty v-if="!draft.selections.length" description="选择对象，并勾选适用于该巡检点的检查项" />
        <div v-for="selection in draft.selections" :key="selection.objectId" class="selection-block">
          <div class="section-header"
            ><strong>{{ objectName(selection.objectId) }}</strong
            ><a-button type="link" danger @click="draft.selections = draft.selections.filter((s) => s !== selection)">移除对象</a-button></div
          >
          <a-checkbox-group v-model:value="selection.itemIds" class="check-options" :options="objectItems(selection.objectId)" />
        </div>
      </template>
      <template v-if="tab === 'tasks'">
        <a-alert type="info" message="演示规则：按自然月生成，每月各次在月内完成；首尾月截取有效期。已生成记录保持原快照，重复生成不会覆盖。" />
        <div class="section-header"
          ><h3>巡检点配置</h3><a-button @click="draft.points.push({ pointId: undefined, quantity: 1 })">添加巡检点</a-button></div
        >
        <div v-for="(point, index) in draft.points" :key="index" class="point-row">
          <a-select
            v-model:value="point.pointId"
            show-search
            option-filter-prop="label"
            placeholder="选择巡检点"
            :options="pointOptions"
            aria-label="巡检点"
          />
          <label>巡检单数量 <a-input-number v-model:value="point.quantity" :min="1" :max="20" :precision="0" /></label>
          <a-button danger @click="draft.points.splice(index, 1)">移除</a-button>
        </div>
        <p class="preview-text"
          >每月 {{ draft.times || 0 }} 次，每次
          {{ draft.points.reduce((n, p) => n + (p.quantity || 0), 0) }} 张巡检单。保存后在列表点击“生成记录”。</p
        >
      </template>
    </section>

    <section v-if="activeRun" class="inspection-surface">
      <div class="section-header"
        ><div
          ><h2>{{ activeRun.customer }}</h2
          ><p class="secondary">{{ activeRun.code }} · {{ activeRun.start }} 至 {{ activeRun.end }} · {{ activeRun.inspector }}</p></div
        ><a-button
          @click="
            activeRunId = '';
            sheetId = '';
          "
          >返回记录</a-button
        ></div
      >
      <div class="run-summary"
        ><span>已提交 {{ runSummary(activeRun).done }}/{{ activeRun.sheets.length }} 张</span><a-tag>{{ runSummary(activeRun).status }}</a-tag
        ><a-tag :color="runSummary(activeRun).result === '异常' ? 'red' : 'blue'">{{ runSummary(activeRun).result }}</a-tag
        ><span>异常处理：{{ runSummary(activeRun).closure }}</span></div
      >
      <div class="execution-layout">
        <nav aria-label="巡检单列表"
          ><button v-for="sheet in activeRun.sheets" :key="sheet.id" :class="{ selected: sheetId === sheet.id }" @click="sheetId = sheet.id"
            ><strong>{{ sheet.position }}</strong
            ><span
              >{{ sheet.pointName }} ·
              {{ sheet.submittedAt ? (hasAbnormal(sheet) ? (sheet.closedAt ? '异常已办结' : '异常待处理') : '正常') : '待填写' }}</span
            ></button
          ></nav
        >
        <div v-if="activeSheet" class="execution-form">
          <a-form layout="vertical">
            <a-form-item label="位置 / 编号" required
              ><p v-if="activeSheet.submittedAt" class="readonly-text">{{ activeSheet.position }}</p>
              <a-input v-else v-model:value="activeSheet.position" :maxlength="80" @change="persist"
            /></a-form-item>
            <div v-for="group in answerGroups" :key="group.name" class="answer-group"
              ><h3>{{ group.name }}</h3>
              <div v-for="answer in group.answers" :key="answer.id" class="answer-row"
                ><span>{{ answer.text }}</span
                ><a-tag v-if="activeSheet.submittedAt" :color="answer.result === '异常' ? 'red' : 'green'">{{ answer.result }}</a-tag>
                <a-radio-group v-else v-model:value="answer.result" @change="persist"
                  ><a-radio value="正常">正常</a-radio><a-radio value="异常">异常</a-radio></a-radio-group
                ></div
              >
            </div>
            <a-form-item label="巡检结论" required
              ><p v-if="activeSheet.submittedAt" class="readonly-text">{{ activeSheet.conclusion }}</p
              ><a-textarea v-else v-model:value="activeSheet.conclusion" :maxlength="1000" :rows="3" show-count @change="persist"
            /></a-form-item>
            <a-form-item label="现场照片 / 视频（本地演示，单个不超过2MB）">
              <input
                v-if="!activeSheet.submittedAt"
                type="file"
                accept="image/*,video/*"
                aria-label="添加现场附件"
                @change="addFile($event, false)"
              />
              <div class="evidence"
                ><div v-for="(file, i) in activeSheet.files" :key="file.url"
                  ><img v-if="file.type.startsWith('image/')" :src="file.url" :alt="file.name" /><video v-else :src="file.url" controls /><span>{{
                    file.name
                  }}</span
                  ><a-button
                    v-if="!activeSheet.submittedAt"
                    type="link"
                    danger
                    @click="
                      activeSheet.files.splice(i, 1);
                      persist();
                    "
                    >移除</a-button
                  ></div
                ></div
              >
            </a-form-item>
          </a-form>
          <div v-if="!activeSheet.submittedAt" class="submit-bar"
            ><span class="secondary">填写后自动保存至本浏览器。剩余 {{ activeSheet.answers.filter((a) => !a.result).length }} 项未选。</span
            ><a-button
              type="primary"
              :disabled="activeSheet.answers.some((a) => !a.result) || !activeSheet.position.trim() || !activeSheet.conclusion.trim()"
              @click="submitCurrent"
              >提交巡检单</a-button
            ></div
          >
          <p v-else class="secondary">提交时间：{{ formatTime(activeSheet.submittedAt) }} · 已提交内容只读</p>
          <section v-if="activeSheet.submittedAt && hasAbnormal(activeSheet)" class="closure-section">
            <h3
              >异常处理 <a-tag :color="activeSheet.closedAt ? 'green' : 'orange'">{{ activeSheet.closedAt ? '已办结' : '待处理' }}</a-tag></h3
            >
            <p v-if="activeSheet.closedAt" class="readonly-text">{{ activeSheet.closure }}</p>
            <a-textarea
              v-else
              v-model:value="activeSheet.closure"
              :rows="3"
              :maxlength="1000"
              placeholder="填写处理过程和办结说明"
              aria-label="办结说明"
              @change="persist"
            />
            <div class="evidence"
              ><div v-for="(file, i) in activeSheet.closureFiles" :key="file.url"
                ><img v-if="file.type.startsWith('image/')" :src="file.url" :alt="file.name" /><video v-else :src="file.url" controls /><span>{{
                  file.name
                }}</span
                ><a-button
                  v-if="!activeSheet.closedAt"
                  type="link"
                  danger
                  @click="
                    activeSheet.closureFiles.splice(i, 1);
                    persist();
                  "
                  >移除</a-button
                ></div
              ></div
            >
            <input v-if="!activeSheet.closedAt" type="file" accept="image/*,video/*" aria-label="添加办结附件" @change="addFile($event, true)" />
            <p v-if="activeSheet.closedAt">{{ activeSheet.closedBy }} · {{ formatTime(activeSheet.closedAt) }} 办结，原异常结果保留。</p>
            <a-popconfirm v-else title="确认在本地演示中办结？不会创建维修工单或审批。" @confirm="closeCurrent"
              ><a-button type="primary" :disabled="!activeSheet.closure.trim()">确认办结</a-button></a-popconfirm
            >
          </section>
        </div>
      </div>
    </section>
    <a-modal v-model:open="picker" title="添加巡检对象" :footer="null" width="650px">
      <a-input-search v-model:value="pickerSearch" placeholder="搜索对象名称或编号" aria-label="搜索对象" />
      <div v-for="obj in availableObjects" :key="obj.id" class="picker-row"
        ><div
          ><strong>{{ obj.name }}</strong
          ><span class="secondary"> {{ obj.code }} · {{ obj.items.length }} 项</span></div
        ><a-button
          :disabled="draft.selections.some((s) => s.objectId === obj.id)"
          @click="draft.selections.push({ objectId: obj.id, itemIds: obj.items.map((i) => i.id) })"
          >{{ draft.selections.some((s) => s.objectId === obj.id) ? '已添加' : '添加' }}</a-button
        ></div
      >
      <a-empty v-if="!availableObjects.length" description="没有匹配的启用对象，请先到巡检对象中维护" />
      <div class="modal-footer"><a-button type="primary" @click="picker = false">完成选择</a-button></div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { onBeforeRouteLeave } from 'vue-router';
  import { Modal, message } from 'ant-design-vue';
  import { BasicTable } from '/@/components/Table';
  import { useUserStore } from '/@/store/modules/user';
  import {
    clone,
    uid,
    MOCK_KEY,
    demoCustomers,
    demoInspectors,
    seedState,
    saveObject,
    savePoint,
    saveTask,
    generateRuns,
    runSummary,
    hasAbnormal,
    submitSheet,
    closeSheet,
    removeConfig,
    type InspectionState,
  } from './inspection.mock';
  defineOptions({ name: 'InspectionMockPreview' });
  const userStore = useUserStore();
  const allowed = computed(() => !!userStore.getToken && userStore.getUserInfo.username === 'admin');
  const state = ref<InspectionState>({ version: 1, objects: [], points: [], tasks: [], runs: [] });
  const storageError = ref('');
  const tab = ref<'objects' | 'points' | 'tasks' | 'runs'>('objects');
  const keyword = ref('');
  const filterStatus = ref<string>();
  const editor = ref(false);
  const draft = ref<any>({});
  const original = ref('');
  const picker = ref(false);
  const pickerSearch = ref('');
  const activeRunId = ref('');
  const sheetId = ref('');
  const labels = { objects: '巡检对象', points: '巡检点', tasks: '巡检任务', runs: '巡检记录' };
  const editorTitle = computed(() => `${state.value[tab.value].some((x) => x.id === draft.value.id) ? '编辑' : '新增'}${labels[tab.value]}`);
  const customerOptions = demoCustomers.map((value) => ({ label: value, value }));
  const inspectorOptions = demoInspectors.map((value) => ({ label: value, value }));
  const statusOptions = ['未开始', '进行中', '已完成'].map((value) => ({ label: value, value }));
  watch(
    allowed,
    (value) => {
      editor.value = false;
      activeRunId.value = '';
      picker.value = false;
      if (!value) {
        state.value = { version: 1, objects: [], points: [], tasks: [], runs: [] };
        return;
      }
      try {
        const raw = localStorage.getItem(MOCK_KEY);
        const saved = raw ? JSON.parse(raw) : seedState();
        if (saved.version !== 1 || !['objects', 'points', 'tasks', 'runs'].every((k) => Array.isArray(saved[k])))
          throw new Error('Invalid mock data');
        state.value = saved;
      } catch {
        state.value = seedState();
        storageError.value = '本地演示数据无法读取，当前使用内存示例；不会自动覆盖原数据。';
      }
    },
    { immediate: true }
  );
  function persist() {
    if (!allowed.value) return false;
    try {
      localStorage.setItem(MOCK_KEY, JSON.stringify(state.value));
      storageError.value = '';
      return true;
    } catch {
      storageError.value = '本地保存失败（可能空间不足），当前内容仅保留在内存。请减少附件后重试，勿刷新页面。';
      return false;
    }
  }
  function action(fn: () => void, text: string) {
    if (!allowed.value) return;
    try {
      fn();
      if (persist()) message.success(text);
    } catch (e) {
      message.warning((e as Error).message);
    }
  }
  const rows = computed(() => {
    const list =
      tab.value === 'objects'
        ? state.value.objects.map((o) => ({ ...o, itemCount: o.items.length }))
        : tab.value === 'points'
          ? state.value.points.map((p) => ({
              ...p,
              itemCount: p.selections.reduce((n, s) => n + s.itemIds.length, 0),
              customer: p.kind === '通用' ? '全部客户' : p.customer,
            }))
          : tab.value === 'tasks'
            ? state.value.tasks.map((t) => ({
                ...t,
                period: `${t.start} 至 ${t.end}`,
                frequency: `每月 ${t.times} 次`,
                pointText: t.points
                  .map((p) => `${state.value.points.find((x) => x.id === p.pointId)?.name || '失效巡检点'} × ${p.quantity}`)
                  .join('、'),
              }))
            : state.value.runs.map((r) => ({
                ...r,
                ...runSummary(r),
                progress: `${runSummary(r).done}/${r.sheets.length}`,
                period: `${r.start} 至 ${r.end}`,
              }));
    const q = keyword.value.trim().toLowerCase();
    return list.filter(
      (r: any) =>
        (!q ||
          [r.name, r.code, r.customer, r.pointText].some((v) =>
            String(v || '')
              .toLowerCase()
              .includes(q)
          )) &&
        (tab.value !== 'runs' || !filterStatus.value || r.status === filterStatus.value)
    );
  });
  const columns = computed(() => {
    const col = (title: string, dataIndex: string, width: number) => ({ title, dataIndex, width });
    const definitions = {
      objects: [col('巡检对象 / 编号', 'name', 240), col('检查项', 'itemCount', 100), col('状态', 'enabled', 100), col('备注', 'remark', 280)],
      points: [
        col('巡检点 / 编号', 'name', 230),
        col('类型', 'kind', 100),
        col('适用客户', 'customer', 210),
        col('检查项', 'itemCount', 100),
        col('备注', 'remark', 180),
      ],
      tasks: [
        col('任务编号', 'code', 130),
        col('客户', 'customer', 200),
        col('巡检点 × 单数', 'pointText', 240),
        col('频率', 'frequency', 100),
        col('有效期', 'period', 220),
        col('巡检人', 'inspector', 130),
      ],
      runs: [
        col('执行编号', 'code', 200),
        col('客户', 'customer', 200),
        col('执行时间', 'period', 220),
        col('巡检人', 'inspector', 130),
        col('进度', 'progress', 80),
        col('执行状态', 'status', 100),
        col('巡检结果', 'result', 100),
        col('异常处理', 'closure', 100),
      ],
    };
    return [...definitions[tab.value], { title: '操作', key: 'action', width: tab.value === 'tasks' ? 260 : 220, fixed: 'right' as const }];
  });
  function openEditor(row?: any, copy = false) {
    if (!allowed.value || tab.value === 'runs') return;
    const saved = row && state.value[tab.value].find((x) => x.id === row.id);
    draft.value = saved
      ? clone(saved)
      : {
          id: uid(),
          name: '',
          code: '',
          enabled: true,
          remark: '',
          items: [{ id: uid(), text: '' }],
          kind: '通用',
          customer: undefined,
          selections: [],
          inspector: undefined,
          start: '',
          end: '',
          times: 1,
          points: [],
        };
    if (copy) {
      draft.value.id = uid();
      draft.value.code = '';
      if (draft.value.name) draft.value.name += '（副本）';
      if (tab.value === 'objects') draft.value.items.forEach((i) => (i.id = uid()));
    }
    original.value = JSON.stringify(draft.value);
    editor.value = true;
  }
  function leaveEditor() {
    if (JSON.stringify(draft.value) === original.value) editor.value = false;
    else
      Modal.confirm({
        title: '放弃未保存的配置？',
        onOk: () => {
          editor.value = false;
        },
      });
  }
  onBeforeRouteLeave(() => {
    if (!editor.value || JSON.stringify(draft.value) === original.value) return true;
    return new Promise<boolean>((resolve) =>
      Modal.confirm({ title: '离开将放弃未保存的配置，是否继续？', onOk: () => resolve(true), onCancel: () => resolve(false) })
    );
  });
  function saveEditor() {
    action(() => {
      if (tab.value === 'objects') saveObject(state.value, draft.value);
      else if (tab.value === 'points') {
        const row = clone(draft.value);
        row.selections = row.selections.filter((s) => s.itemIds.length);
        savePoint(state.value, row);
      } else saveTask(state.value, draft.value);
      editor.value = false;
    }, '演示配置已保存');
  }
  function moveItem(index: number, delta: number) {
    const items = draft.value.items;
    [items[index], items[index + delta]] = [items[index + delta], items[index]];
  }
  const objectName = (id: string) => state.value.objects.find((o) => o.id === id)?.name || '失效对象';
  const objectItems = (id: string) => state.value.objects.find((o) => o.id === id)?.items.map((i) => ({ label: i.text, value: i.id })) || [];
  const availableObjects = computed(() => state.value.objects.filter((o) => o.enabled && `${o.name}${o.code}`.includes(pickerSearch.value.trim())));
  const pointOptions = computed(() =>
    state.value.points
      .filter((p) => p.kind === '通用' || p.customer === draft.value.customer)
      .map((p) => ({ label: `${p.name}（${p.code} · ${p.kind}）`, value: p.id }))
  );
  function removeRow(id: string) {
    if (tab.value !== 'runs') action(() => removeConfig(state.value, tab.value as any, id), '已删除演示配置');
  }
  function generate(id: string) {
    const task = state.value.tasks.find((t) => t.id === id)!;
    Modal.confirm({
      title: '按当前配置生成演示巡检记录？',
      content: '已存在的月份和轮次会跳过，不覆盖历史记录。',
      onOk: () => {
        let count = 0;
        action(() => {
          count = generateRuns(state.value, task);
        }, '生成完成');
        if (count) {
          tab.value = 'runs';
          keyword.value = task.code;
        } else message.info('没有需要新增的记录');
      },
    });
  }
  const activeRun = computed(() => state.value.runs.find((r) => r.id === activeRunId.value));
  const activeSheet = computed(() => activeRun.value?.sheets.find((s) => s.id === sheetId.value));
  const answerGroups = computed(() => {
    const answers = activeSheet.value?.answers || [];
    return [...new Set(answers.map((a) => a.objectName))].map((name) => ({ name, answers: answers.filter((a) => a.objectName === name) }));
  });
  function openRun(id: string) {
    activeRunId.value = id;
    sheetId.value = activeRun.value?.sheets[0]?.id || '';
  }
  function submitCurrent() {
    if (activeSheet.value) action(() => submitSheet(activeSheet.value!), '巡检单已提交（Mock）');
  }
  function closeCurrent() {
    if (activeSheet.value) action(() => closeSheet(activeSheet.value!, 'admin（演示）'), '异常已办结（Mock）');
  }
  const formatTime = (s: string) => new Date(s).toLocaleString('zh-CN', { hour12: false });
  async function addFile(event: Event, closure: boolean) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const sheet = activeSheet.value;
    if (!allowed.value || !file || !sheet || (closure ? !!sheet.closedAt : !!sheet.submittedAt)) return;
    const files = closure ? sheet.closureFiles : sheet.files;
    if (!/^(image|video)\//.test(file.type) || file.size > 2 * 1024 * 1024 || files.length >= 3) {
      message.warning('仅支持图片或视频，单个不超过2MB，每处最多3个');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => message.error('附件读取失败，请重试');
    reader.onload = () => {
      if (!allowed.value || !state.value.runs.some((r) => r.sheets.includes(sheet)) || (closure ? !!sheet.closedAt : !!sheet.submittedAt)) return;
      files.push({ name: file.name, type: file.type, url: String(reader.result) });
      persist();
    };
    reader.readAsDataURL(file);
  }
  async function exportRun(id: string) {
    if (!allowed.value) return;
    try {
      const run = state.value.runs.find((r) => r.id === id)!;
      const { Workbook } = await import('exceljs');
      const book = new Workbook();
      const sheet = book.addWorksheet('巡检记录（Mock）');
      sheet.addRow(['演示数据，非正式巡检报告']);
      sheet.addRow(['客户', run.customer, '执行编号', run.code]);
      sheet.addRow(['巡检点', '位置编号', '巡检对象', '检查内容', '结果', '巡检结论', '办结说明']);
      run.sheets.forEach((s) =>
        s.answers.forEach((a) => sheet.addRow([s.pointName, s.position, a.objectName, a.text, a.result || '未填写', s.conclusion, s.closure]))
      );
      sheet.columns.forEach((c, i) => (c.width = i >= 3 ? 35 : 24));
      sheet.eachRow((r) => (r.alignment = { vertical: 'middle', wrapText: true }));
      const data = await book.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${run.code}-Mock.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      message.error('导出失败，请重试');
    }
  }
</script>

<style scoped lang="less">
  .readonly-text {
    color: #262626;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.7;
    margin: 0;
  }
  .inspection-page {
    padding: 16px;
    display: grid;
    gap: 12px;
    color: #262626;
  }
  .inspection-header,
  .section-header,
  .inspection-tools,
  .submit-bar,
  .picker-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
  h2 {
    font-size: 18px;
    margin: 0;
  }
  h3 {
    font-size: 15px;
    margin: 0;
  }
  .inspection-header p {
    margin: 6px 0 0;
    color: #595959;
  }
  .secondary {
    color: #595959;
    font-size: 13px;
    margin-top: 4px;
  }
  .inspection-surface {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    min-width: 0;
  }
  .inspection-tools {
    justify-content: flex-start;
    margin: 0 0 18px;
  }
  .inspection-tools > .ant-input-search {
    width: 280px;
  }
  .inspection-tools > .ant-select {
    width: 140px;
  }
  .section-header {
    margin-bottom: 18px;
  }
  .editor h3 {
    margin-top: 12px;
  }
  .form-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 24px;
  }
  .form-grid :deep(.ant-picker),
  .form-grid :deep(.ant-input-number) {
    width: 100%;
  }
  .check-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .check-row > .ant-input {
    flex: 1;
    min-width: 100px;
  }
  .selection-block {
    padding: 16px 0;
    border-bottom: 1px solid #e8e8e8;
  }
  .check-options {
    display: grid;
    gap: 10px;
  }
  .point-row {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .point-row > .ant-select {
    width: 360px;
    max-width: 100%;
  }
  .point-row label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .preview-text {
    margin-top: 24px;
    color: #595959;
  }
  .run-summary {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    padding-bottom: 18px;
    border-bottom: 1px solid #e8e8e8;
  }
  .execution-layout {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 28px;
    margin-top: 20px;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  nav button {
    border: 1px solid #e8e8e8;
    background: #fff;
    text-align: left;
    border-radius: 4px;
    padding: 12px;
    cursor: pointer;
    color: #262626;
  }
  nav button.selected {
    background: #e6f4ff;
    border-color: #1677ff;
  }
  nav button span {
    display: block;
    font-size: 12px;
    margin-top: 8px;
    color: #595959;
  }
  button:focus-visible {
    outline: 2px solid #1677ff;
    outline-offset: 2px;
  }
  .execution-form {
    min-width: 0;
  }
  .answer-group {
    margin: 20px 0;
  }
  .answer-group h3 {
    padding-bottom: 10px;
  }
  .answer-row {
    padding: 14px 0;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
  }
  .answer-row > span {
    flex: 1;
  }
  .answer-row .ant-radio-group {
    flex-shrink: 0;
  }
  .evidence {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 12px 0;
  }
  .evidence > div {
    width: 150px;
    overflow-wrap: anywhere;
  }
  .evidence img,
  .evidence video {
    width: 150px;
    height: 100px;
    object-fit: contain;
    background: #fafafa;
  }
  .evidence span {
    display: block;
    font-size: 12px;
  }
  .closure-section {
    margin-top: 28px;
    border-top: 1px solid #e8e8e8;
    padding-top: 20px;
    display: grid;
    gap: 14px;
  }
  .picker-row {
    padding: 14px 0;
    border-bottom: 1px solid #eee;
  }
  .modal-footer {
    text-align: right;
    margin-top: 18px;
  }
  @media (max-width: 1000px) {
    .form-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .execution-layout {
      grid-template-columns: 180px minmax(0, 1fr);
      gap: 16px;
    }
  }
  @media (max-width: 640px) {
    .inspection-page {
      padding: 8px;
    }
    .inspection-surface {
      padding: 12px;
    }
    .form-grid,
    .execution-layout {
      grid-template-columns: 1fr;
    }
    nav {
      flex-direction: row;
      overflow-x: auto;
    }
    nav button {
      min-width: 160px;
    }
    .answer-row {
      align-items: flex-start;
      flex-direction: column;
    }
    .check-row {
      flex-wrap: wrap;
    }
    .check-row > .ant-input {
      flex-basis: 75%;
    }
  }
</style>
