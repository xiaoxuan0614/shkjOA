# 物料批次 · 库位 · SN 管理改造方案

> 日期：2026-08-14
> 状态：**设计稿（待评审）**
> 前置问题：本文档第〇节同时记录了「执行出库/入库传参错误」的定位结论与修复点，建议先修 bug 再按本文档分阶段改造。
> 数据字段以 apifox 接口文档为准；文档没有的接口/字段在本文档中明确列出，供后端开发对齐。

---

## 〇、先修 bug：执行出库 / 执行入库 传参问题（已定位）

### 现象
「出入库管理 → 出库 / 入库」执行后，后端收到的数量/单位信息不对，表现为台账数量、库存变动错误（部分场景数量落库为 0 或按基准单位误算）。

### 根因（对比同一模块已验证的三处调用）

| 调用点 | 文件 | `unitId` | `unitQty` | `sourceType/sourceId/sourceNo` | 备注 |
| --- | --- | --- | --- | --- | --- |
| 库存管理-手动出入库（**已验证正常**） | `goods/components/IOModal.vue` | ✅ 传 | ✅ | `manual` | 接口契约参照 |
| 采购入库（**已验证正常**） | `purchase/components/StockInModal.vue` | ✅ 传 | ✅ | `apply` | 含 `model` |
| **执行出库/入库** | `record/components/StockExecuteModal.vue` | ❌ **漏传** | ✅ | ✅ | 本次执行数 `execQty` |
| **批量出库/批量入库** | `record/index.vue` `handleBatchIo` | ❌ **漏传** | ✅ | ✅ | `unitQty=remain` |

**结论：`StockExecuteModal.vue`（行 156-171）和 `record/index.vue`（行 250-262）调 `manualInOut` 时漏传了 `unitId`。**

后端 `StockIoRecord` 依赖 `unitId` 做「当前单位 → 基准单位」换算（`conversionQty`）：
- 有 `unitId`：1 箱 = 12 个 → 基准数量正确，金额/库存变动正确；
- 无 `unitId`：后端拿不到换算系数 → 基准数量、金额、变动前后库存全部算错/归零 → 即「传的数据不对」。

### 修复点（最小改动）

1. `StockExecuteModal.vue`：`useModalInner` 构造行数据时，从明细 `it.unitId` 带出 `unitId`；`handleOk` 提交体补 `unitId: r.unitId`。同时把 `unitPrice` 从当前行直接取（不再回找 `apply.itemList`），并补传 `model`（规格型号，与采购入库 `StockInModal` 对齐，台账留规格）。
2. `record/index.vue` `handleBatchIo`：提交体补 `unitId: it.unitId`，同样补 `model: it.model`。
3. **需对 apifox 确认**：`manualIn/manualOut` 入参数量字段名。当前统一传 `unitQty`（与已验证的 IOModal 一致）；若文档实际字段是 `inQty/outQty`，后端应兼容 `unitQty` 或前端同步改名。**建议后端以 `unitQty` 为准**（StockIoRecord 实体字段名）。

> 修复后请联调：执行部分出库（如申请 5 出 3）、还料入库（三层数量）、采购入库，核对台账 数量/基准数量/金额 三列。

---

## 一、改造目标与业务概念

### 1.1 现状（改造前）

- 物料库存只是一个数字：`StockMaterial.stockQty`，**没有位置、没有批次、没有 SN**。
- 出入库台账 `StockIoRecord`：有 `unitId/unitName/unitQty/unitPrice`，但**不记批次/库位/SN**。
- 采购入库 → 逐条 `manualIn`；领料/还料出库入库 → 逐条 `manualOut/manualIn`，**扣的是整块库存，无法按先入先出扣**。

### 1.2 新增概念

| 概念 | 定义 | 关键规则 |
| --- | --- | --- |
| **批次 Batch** | 同一张入库单 + 同一物料 + 同一单价 的一批货。**一个批次一个价格** | 例：一张采购入库单的物料A到货 10 个、单价 5 元 → 一个批次（10 个 / 单价 5）。批次数量的增减必须走「入库→批次增加」「出库→批次扣减」 |
| **仓库 / 库区 / 层** | 三级存放位置：仓库 → 库区 → 层。**层为最终存放单位** | 每层可选配容量；库位挂在批次上（同批次放同一库位，超量自动顺延到下一可用库位） |
| **SN / 二维码** | 单品唯一序列号，生成标签（二维码）贴到物料上 | 确认到货时扫描录入；**无 SN 的由系统生成**（规则见 3.1）。SN 挂在批次下，出库可精确到 SN |
| **推荐库位** | 入库时默认展示物料"现存位置" | 取该物料最近一次入库所放库位；从未入库过 → 按物料类别默认库区/第一个可用层 |
| **FIFO 出库** | 出库先扣**最早入库批次** | 执行出库弹窗按批次入库时间升序推荐；展示批次号/SN/剩余/单价/库位，可改、可填原因留痕 |

### 1.3 库存模型变化

- **改造前**：`StockMaterial.stockQty`（单数字）。
- **改造后**：某物料在库总数 = 其所有批次 `remainQty` 之和。
  - 库存明细维度：**物料 × 批次 × 库位**（可选再精确到 SN）。
  - `StockMaterial.stockQty` 仍保留作为冗余汇总列（由后端在出入库时联动更新，或前端按批次聚合展示）。

---

## 二、业务流程（改造后）

### 2.1 采购入库（含批次 + SN + 推荐库位 + 标签）

```
① 新增采购订单 → ② 采购中 → ③ 已到货
④ 执行入库（StockInModal 增强）：
   - 明细每行：物料 / 采购数 / 实际入库数(可改) / 单价(可改) / 规格(可改) / 差异说明(必填)
   - 【新增】推荐库位：自动带出该物料"现存位置"（仓库-库区-层级联，可改，容量校验可选）
   - 【新增】SN 录入：扫描/批量粘贴二维码 → 每个 SN 一行；空缺 SN 自动由系统生成（可勾选"自动补号"）
   - 确认 → 后端：生成批次(batchNo) + SN 记录 + 扣减订单数量 + 写台账(带 batchNo/库位/SN)
⑤ 打标签：行操作「打印标签」→ 生成该批次 SN 二维码标签（后端出图或前端 qrcode 渲染）
```

### 2.2 还料入库

```
还料申请(应还/实际还) → 库管执行入库：
- 推荐库位同 2.1（该物料现存位置）
- 还料一般无新 SN：沿用原领出时的 SN 回库（批次=原批次 or 新批次？→ 见决策点 D3）
- 生成台账(带库位)，归还批次可用数量
```

### 2.3 领料出库（FIFO）

```
执行出库（StockExecuteModal 增强，领料/OUT）：
① 每行明细：物料 / 申请数量 / 剩余可执行 / 本次出库数(默认=剩余)
② 【新增】FIFO 推荐批次明细（点行展开 or 展开子表格）：
   - 按入库时间升序列出该物料所有可用批次（批次号 / 库位 / 单价 / 剩余数量）
   - 默认勾选最早批次，本次出库数优先从最早批次扣，扣完顺延下一批次
   - 展示每个批次的 SN（可勾选到 SN 级；SN 级出库时按 SN 逐个扣）
   - 每批次可单独改出库数量、可选 SN、可填原因（差异/换批留痕到台账 remark）
③ 确认 → 后端按 批次/SN 扣减 → 写台账(带 batchNo/库位/SN)
```

> 规则：**先入先出**。严格优先最早批次；库管可人工改选其它批次（换批需填原因留痕）。

### 2.4 手动出入库（库存管理页）

- 手动入库：也可生成批次（单次操作 = 一个批次），填库位（推荐同上）、可填 SN。
- 手动出库：也按 FIFO 推荐批次（非强制，仅当物料开启了批次/SN 管理）。

---

## 三、数据模型改造（后端）

### 3.1 新增实体

#### `stock_batch` 库存批次

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | long | 主键 |
| `batchNo` | string | **批次号**（系统生成：`P + yyyyMMdd + 序号`，如 `P20260814001`） |
| `materialId` / `materialCode` / `materialName` | | 物料（冗余名称便于列表） |
| `unitId` / `unitName` | | 批次单位（=入库单位） |
| `qty` | number | 批次原始入库数量（按 unitName） |
| `remainQty` | number | 剩余可用数量（出库扣减） |
| `unitPrice` | number | 批次单价（**一个批次一个价**） |
| `amount` | number | 批次金额（qty × unitPrice） |
| `warehouseId` / `zoneId` / `levelId` | | 存放位置（仓库-库区-层，冗余 name 可再加） |
| `sourceType` / `sourceId` / `sourceNo` | | 来源（apply/manual；入库单号/申请单号） |
| `inTime` | datetime | 入库时间（**FIFO 排序依据**） |
| `createBy` / `createTime` | | 操作人/时间 |

#### `stock_batch_sn` 批次 SN

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | long | 主键 |
| `batchId` | long | 所属批次 |
| `materialId` | long | 物料 |
| `snNo` | string | **SN/二维码内容**（扫描值或系统生成） |
| `levelId` | long | 当前所在层（默认=批次库位） |
| `status` | string | `IN` 在库 / `OUT` 已出 / `LOCKED` 锁定 |
| `outApplyItemId` / `outTime` | | 出库去向（申请明细）+ 出库时间（可回溯） |

> **系统生成 SN 规则**：`物料编码 + 入库日期 + 流水`，如 `WL20260814001-0001`（物料 `WL20260814001`）。生成后打标签贴物料。

#### `stock_warehouse` / `stock_zone` / `stock_level`（位置三表）

| 表 | 字段 |
| --- | --- |
| `stock_warehouse` 仓库 | `id/name/code/remark` |
| `stock_zone` 库区 | `id/warehouseId/name/code/remark` |
| `stock_level` 层 | `id/zoneId/name/code/capacity(容量,可选)/currentQty/remark` |

### 3.2 扩展现有实体

| 实体 | 新增字段 | 说明 |
| --- | --- | --- |
| `StockIoRecord` | `batchId/batchNo/warehouseId/zoneId/levelId/snNo` | 台账留痕批次/库位/SN，支撑明细追溯 |
| `StockApplyItem` | `outQty/inQty`（已执行数量，免前端聚合） | 上轮已列，未落库，本次一并落实 |
| `StockMaterial` | `isBatchMgr/isSnMgr`（可选开关） | 物料是否开启批次/SN 管理（默认开） |

### 3.3 新增/扩展接口

| 接口 | 说明 |
| --- | --- |
| `/stock/warehouse/*` `zone/*` `level/*`（list/add/edit/delete） | 仓库-库区-层 维护（树形返回） |
| `/stock/batch/list` | 批次列表（过滤：物料/库位/状态/时间；含剩余数量、SN 列表） |
| `/stock/batch/queryById` | 批次详情（含 SN 列表） |
| `/stock/batch/recommendLocation` | **入库推荐库位**（入参 materialId → 该物料最近库位；无则类别默认/首空层） |
| `/stock/batch/recommendOutbound` | **FIFO 出库推荐**（入参 materialId+qty → 按 inTime 升序返回可扣批次明细含 SN） |
| `/stock/sn/generate` | 批量生成 SN（入参 materialId+数量 → 返回 SN 列表） |
| `/stock/sn/print` 或导出 | 标签打印：SN 二维码图片/PDF（后端出图） |
| `manualIn` **扩展入参** | + `warehouseId/zoneId/levelId`、`snList[]`（后端生成批次并写台账） |
| `manualOut` **扩展入参** | + `batchId/batchNo/levelId/snList[]`（按批次/SN 扣减，FIFO 由后端兜底） |

> `manualIn/manualOut` **向后兼容**：不传批次/库位/SN 时按旧逻辑（整块库存变动）执行，避免破坏现有库存管理页手动出入库。

---

## 四、前端改造

### 4.1 页面

| 页面 | 改动 |
| --- | --- |
| **仓库管理**（新，菜单建议挂物料管理下） | 仓库-库区-层 三级树维护（层级联、可增删改、层带容量） |
| **库存管理** `/material/stock`（增强） | 列表列加 批次号/库位/剩余；行操作「批次」「SN」；支持按物料/批次/库位/SN 过滤 |
| **采购入库** `/material/purchase` | `StockInModal`：确认到货区 → **推荐库位级联** + **SN 录入/自动补号** + 入库后「打印标签」 |
| **出入库管理** `/material/record` | `StockExecuteModal`：出库走 **FIFO 推荐批次/SN 子表**；入库走 **批次+推荐库位**；台账列加 批次/库位/SN |
| **物料基本维护** `/material/list` | 物料加「启用批次管理/启用SN管理」开关（默认开） |

### 4.2 组件

| 组件 | 现有/新增 | 说明 |
| --- | --- | --- |
| `WarehouseTree.vue` | 新增 | 仓库-库区-层 树形维护（或内嵌于页面） |
| `LocationSelect.vue` | 新增 | 仓库-库区-层 **级联选择器**（入库/出库/物料通用，支持"带出推荐库位"） |
| `SnInput.vue` | 新增 | SN 录入区（扫描枪兼容：每次回车生成一行 + 批量粘贴 + 「自动补号」按钮） |
| `LabelPrint.vue` | 新增 | SN 二维码标签打印（调 `/stock/sn/print` 或前端 `qrcode` 渲染后打印） |
| `BatchSubTable.vue` | 新增 | FIFO 推荐批次/SN 子表格（入库时间/批次号/库位/单价/剩余/勾选/数量/原因） |
| `StockExecuteModal.vue` | 改造 | 出库行内嵌 BatchSubTable；入库行内嵌 LocationSelect+SnInput |
| `StockInModal.vue` | 改造 | 入库行内嵌 LocationSelect+SnInput |
| `IOModal.vue` | 改造 | 手动出入库可选库位/批次（物料开启管理时必填） |

### 4.3 API（新增 `stock.api.ts` 或并入 `Goods.api.ts`）

```ts
// 推荐
warehouseList  = '/stock/warehouse/list'
zoneList       = '/stock/zone/list'
levelList      = '/stock/level/list'
batchList      = '/stock/batch/list'
recommendLoc   = '/stock/batch/recommendLocation'   // materialId -> {warehouseId,zoneId,levelId}
recommendOut   = '/stock/batch/recommendOutbound'   // materialId+qty -> batch[] (FIFO)
snGenerate     = '/stock/sn/generate'                // materialId+qty -> sn[]
snPrint        = '/stock/sn/print'
// manualIn/manualOut 参数扩展（改 Good.api manualInOut 入参类型，新增字段可选）
```

---

## 五、关键规则与交互细节

1. **批次生成时机**：入库（采购/还料/手动）成功即生成批次；**同一入库单 + 同一物料 + 同一单价 = 一个批次**。
2. **推荐库位**：入库时调 `recommendLocation` 回填物料现存库位；无记录 → 类别默认库区或第一个空层；**用户可改**。
3. **FIFO 出库**：
   - 顺序：`stock_batch` 按 `inTime` 升序，优先扣 `remainQty > 0` 的批次；
   - 单批次可部分出；批次扣完自动顺延下一批次；
   - 启用 SN 的物料，展示 SN 列表，可勾选到 SN 级；
   - **人工改选非最早批次 → 需填原因**（留痕到台账 remark）。
4. **SN**：
   - 扫描录入 = 已有 SN；空格/无二维码 = 系统生成（`sn/generate`）；
   - 出库时 SN 状态置 `OUT`，记录去向；还料回库置 `IN`；
   - 同一物料可重复 SN 校验（后端唯一）。
5. **数量口径**：`manualIn/manualOut` 的 `unitQty` 仍需带 `unitId`（见第〇节修复），批次/SN 不改变单位换算规则。
6. **存量数据**：改造前已入库的物料无批次 → 后端提供「初始化批次」：按现有 `stockQty` 生成一个历史批次（inTime=最早台账时间或初始化时间），保证 FIFO 可算。

---

## 六、分阶段实施计划

| 阶段 | 内容 | 依赖 |
| --- | --- | --- |
| **P0 修 bug** | 执行出库/入库/批量 补传 `unitId`；联调台账数量 | 无（前端） |
| **P1 批次** | 后端 `stock_batch` 表 + `manualIn/manualOut` 生成/扣减批次 + 台账带 batchNo；前端库存管理按批次展示、台账列加批次 | 后端建表 |
| **P2 库位** | **仓库管理**：仓库/库区/层 三表 + CRUD + 三级树，前端「仓库管理」页面（菜单挂物料管理下）维护三级位置；`recommendLocation`；`LocationSelect` 组件；采购/还料/手动入库接推荐库位 | P1 |
| **P3 SN/标签** | `stock_batch_sn` 表 + `sn/generate` + SN 录入组件 + 打印标签 | P1 |
| **P4 FIFO 出库** | `recommendOutbound` + `StockExecuteModal` 内嵌批次/SN 子表；换批原因留痕；存量批次初始化 | P1-P3 |

> 建议 P1-P4 每阶段独立交付、可回退；**P0 立即做**。

---

## 七、待确认决策点（评审时逐条定）

| # | 决策点 | 我的建议 |
| --- | --- | --- |
| D1 | 出库是否**必须精确到 SN**，还是批次级即可？ | 先**批次级 + SN 可选**；需要严格单品追溯再升级 SN 级 |
| D2 | 层/货位是否需要**容量校验**？ | 可选；先不做，仅展示 |
| D3 | 还料入库：沿用原批次 还是 新批次？ | 建议**沿用原批次回库**（SN 归位），无 SN 的物料还料生成新批次 |
| D4 | 是否所有物料都强制 SN？ | 建议**按物料开关**（`isSnMgr`），需追溯的（如设备/贵重件）开 |
| D5 | 手动出入库（库存管理页）是否也走批次/库位？ | 建议物料开批次管理则强制选库位并生成/扣批次 |
| D6 | 批次号 / SN 生成规则是否满足？（`P+日期+序号` / `物料编码+日期+流水`） | 可改为纯后端规则，前端不预填 |
| D7 | 标签打印：后端出图（PDF/图片）还是前端 `qrcode` 渲染打印？ | 建议前端渲染（少一次后端依赖），内容：物料名/型号/批次号/SN |

---

## 八、后端待开发清单（交接 apifox 文档使用方）

> 给后端团队的需求/逻辑交流稿见 `docs/后端开发需求-批次-库位-SN.md`（含字段级接口定义与 D1–D10 待确认点）。

1. `stock_batch`、`stock_batch_sn`、`stock_warehouse`、`stock_zone`、`stock_level` 五表及 CRUD。
2. `manualIn/manualOut` 扩展：支持 `warehouseId/zoneId/levelId/snList/batchId`；不传时向后兼容。
3. 新增接口：`batch/list`、`recommendLocation`、`recommendOutbound`、`sn/generate`、`sn/print`。
4. `StockIoRecord` 补 `batchNo/levelId/snNo` 字段（台账留痕）。
5. `StockApplyItem` 补 `outQty/inQty`（已执行数量，免前端聚合）。
6. 存量数据初始化：为现有库存生成历史批次。

---

> 本文档为设计稿。评审通过后按 P0→P4 逐阶段实现，每阶段完成后更新 [接口对照文档.md](接口对照文档.md) 与 [结构功能总览.md](结构功能总览.md)。
