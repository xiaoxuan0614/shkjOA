# 后端开发需求：批次 / 库位 / SN / FIFO 出库

> 日期：2026-08-14
> 用途：**前端给后端的开发需求 / 逻辑交流稿**。物料模块要引入四个新概念，本文列出后端需要做的表、接口、业务规则，以及需要前后端一起敲定的逻辑点。
> 关联：设计稿全文见 `docs/物料批次-库位-SN管理改造方案.md`（含前端改造与分阶段计划）；本文只讲后端。
> 前置：**执行出库/入库传参 bug 已由前端修复**（`unitId` + `model` 已补传）。`manualIn/manualOut` 数量字段前端统一传 **`unitQty`**，请后端以此为准（`StockIoRecord` 实体字段名）；若 apifox 上是 `inQty/outQty`，请后端兼容或尽早反馈。

---

## 一、要达成的目标

1. **仓库管理**：新增「仓库管理」功能，维护 **仓库 → 库区 → 层** 三级位置（新增/修改/删除/树形展示），作为所有库位选择的来源。
2. **批次**：库存从「一个总数」变为「按批次管理」。一张入库单 + 同一物料 + 同一单价 = 一个批次（一个批次一个价格）。
3. **位置**：仓库 → 库区 → 层，三级位置，**层为最终存放单位**；入库记录存放位置。
4. **SN / 二维码**：确认到货的物料有唯一 SN，扫描或系统生成，打标签贴物料；出库可精确到 SN。
5. **FIFO 出库**：出库按先入先出，推荐最早入库批次，可改选（换批留痕）、可填原因。

> 一句话：**先有「仓库管理」维护三级位置 → 入库时生成批次(+选库位+SN) → 出库按 FIFO 扣批次(+SN)**。台账 `StockIoRecord` 带批次/库位/SN 留痕。

---

## 二、核心业务逻辑（重点讨论）

### 2.1 批次 Batch

- **粒度**：`入库单(sourceNo) × 物料(materialId) × 单价(unitPrice)` = 一个批次。
  - 例：一张采购单物料A到货 10 个、单价 5 元 → 一个批次（qty=10，remainQty=10，unitPrice=5）。
  - 同一入库单、同一物料、**单价不同**（分批到货改价）→ 拆成多个批次。
- **生成时机**：入库成功即生成（采购/还料/手动入库统一）。
- **数量增减**：入库 → 批次 `qty`/`remainQty` 增加；出库 → `remainQty` 扣减（不允许小于 0）。
- **在库总数**：某物料总库存 = 该物料所有批次 `remainQty` 之和。`StockMaterial.stockQty` 保留作冗余汇总，后端出入库时联动更新。
- **FIFO 排序依据**：`inTime`（入库时间），升序。

### 2.2 仓库管理（仓库 / 库区 / 层）

**这是一个独立的功能模块**：前端「仓库管理」页面（菜单挂物料管理下），供库管维护三级位置；后端提供三表 CRUD + 三级树。**必须先有仓库数据，入库/出库才能选库位、推荐库位才能生效。**

- 三级树：`仓库` → `库区`(挂仓库) → `层`(挂库区)。**层是存放的基本单位**（物料放在某一层上）。
- 维护粒度：仓库/库区/层各自增删改查；库区挂仓库、层挂库区（级联选择）。
- 编码唯一：仓库/库区/层 的 `code` 各自唯一（同层唯一即可，建议全局唯一）。
- 删除校验（后端拦截，返回明确提示）：
  - 仓库下还有库区 → 禁止删除；
  - 库区下还有层 → 禁止删除；
  - 层被**批次占用**（`stock_batch` 引用了该 levelId 且 `remainQty > 0`）→ 禁止删除（仅当无在库批次时可删）。
- 层可选容量（capacity），本期**不做强制校验**（仅展示，见 D2）。
- 库位挂在**批次**上：同批次默认放同一层；超出层容量可顺延下一可用层（D2 若不做容量校验则无顺延）。

### 2.3 SN / 二维码

- 来源两种：
  - **扫描录入**：已有 SN（二维码），扫描枪回车一行一个 / 批量粘贴。
  - **系统生成**：无 SN / 留空时后端生成。规则建议：`物料编码 + 入库日期 + 流水`，如 `WL20260814001-0001`。
- SN 挂在**批次**下（`stock_batch_sn`）；同一物料下 SN **全局唯一**（后端唯一约束，重复报错）。
- 状态流转：入库 `IN` → 出库 `OUT` → 还料回库 `IN`。出库记录去向（申请明细 + 时间），可回溯。
- 标签打印：按批次批量出标签，内容至少：物料名 / 型号 / 批次号 / SN（二维码）。

### 2.4 推荐库位（入库时）

- 入库弹窗默认带出该物料**现存位置**：
  1. 优先：该物料**最近一次入库**（台账 IN 且带库位，按时间倒序）所在层；
  2. 无：物料类别的默认库区 → 该库区第一个空层；
  3. 都无：前端不强制，库管手选。
- 结果**可改**（仓库-库区-层级联选择器）。

### 2.5 FIFO 出库

- 出库弹窗按 `inTime` 升序列出该物料所有 `remainQty > 0` 的批次，默认**从最早批次扣**，扣完顺延下一批次。
- 每批次展示：批次号 / 入库时间 / 库位 / 单价 / 剩余数量 / SN 列表；可**逐批次改出库数**、**勾选到 SN 级**、填原因。
- **人工改选非最早批次（换批）→ 必填原因**（写台账 remark 留痕）。
- 物料未开启批次/SN 管理（`isBatchMgr/isSnMgr=false`）→ 不展示推荐，按旧逻辑整块扣。

---

## 三、数据表（后端建表）

### 3.1 新增 5 张表

#### `stock_batch` 库存批次

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | bigint | 主键 |
| batch_no | varchar | 批次号（生成规则见 2.1/待确认 D6） |
| material_id / material_code / material_name | | 物料（冗余名称便于列表展示） |
| unit_id / unit_name | | 批次单位（=入库单位） |
| qty | decimal | 批次原始入库数量 |
| remain_qty | decimal | 剩余可用数量（出库扣减，≥0） |
| unit_price | decimal | 批次单价（**一个批次一个价**） |
| amount | decimal | 金额 = qty × unit_price |
| warehouse_id / zone_id / level_id | bigint | 存放位置（层为最终存放） |
| warehouse_name / zone_name / level_name | varchar | 位置名称冗余 |
| source_type / source_id / source_no | | 来源：apply / manual；入库单号 |
| in_time | datetime | 入库时间（**FIFO 排序依据**） |
| create_by / create_time | | 操作人 / 时间 |

#### `stock_batch_sn` 批次 SN

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | bigint | 主键 |
| batch_id | bigint | 所属批次 |
| material_id | bigint | 物料 |
| sn_no | varchar | SN / 二维码内容（**同物料唯一**） |
| level_id | bigint | 当前所在层（默认=批次库位） |
| status | varchar | `IN` 在库 / `OUT` 已出 / `LOCKED` 锁定 |
| out_apply_item_id | bigint | 出库去向（申请明细），可空 |
| out_time | datetime | 出库时间 |
| create_time | datetime | 入库/生成时间 |

#### `stock_warehouse` / `stock_zone` / `stock_level` 位置三表（仓库管理）

| 表 | 字段 |
| --- | --- |
| stock_warehouse 仓库 | id / name / code / manager(负责人,可选) / status(启用/停用,可选) / remark / create_by / create_time |
| stock_zone 库区 | id / warehouse_id / name / code / remark / create_by / create_time |
| stock_level 层 | id / zone_id / name / code / capacity(容量,可选) / remark / create_by / create_time |

> 通用约定：三表均含 create_by/create_time；删除校验「有子节点/被批次占用时禁止删除」（见 2.2）。`stock_warehouse` 的 `manager/status` 是否要做、以及库区/层要不要更多业务字段（如温区/库别/拣货优先级），见待确认 D11。

### 3.2 扩展现有表

| 表 | 新增字段 | 说明 |
| --- | --- | --- |
| `stock_io_record` 台账 | `batch_id / batch_no / warehouse_id / zone_id / level_id / sn_no` | 出/入库留痕批次/库位/SN，支撑明细追溯 |
| `stock_apply_item` 申请明细 | `out_qty / in_qty`（已执行数量，免前端聚合算剩余） | 之前已列、未落库，本次一并落实 |
| `stock_material` 物料 | `is_batch_mgr / is_sn_mgr`（tinyint，默认 1） | 是否开启批次/SN 管理；不开启的物料出入库走旧逻辑 |

---

## 四、接口需求

### 4.1 新增接口（8 个）

> 统一返回 JeecgBoot 风格：`{ code, result, message, success }`，`code=200` 成功。

**1. 仓库管理（仓库 / 库区 / 层 维护，标准 JeecgBoot CRUD）**

> 对应前端「仓库管理」页面（三级树维护）+ 所有库位选择器/推荐库位的数据来源。

| 接口 | 说明 |
| --- | --- |
| `/stock/warehouse/list \| add \| edit \| delete \| deleteBatch` | 仓库维护（`list` 返回全部；`add/edit` 请求体见 3.1 仓库字段） |
| `/stock/zone/list \| add \| edit \| delete \| deleteBatch` | 库区维护，`list` 支持按 `warehouseId` 过滤 |
| `/stock/level/list \| add \| edit \| delete \| deleteBatch` | 层维护，`list` 支持按 `zoneId` 过滤 |
| `/stock/location/tree`（**建议做，级联选择器通用**） | 一次性返回仓库-库区-层三级树：`[{id, name, code, status, children:[{..., children:[层]}]}]`；层节点带 `capacity` |
| 删除 | 后端按 2.2 校验：有子节点 / 被批次占用 → 返回业务异常，前端提示「有子级/有库存，不能删除」 |

> 删除校验建议在 `delete`/`deleteBatch` 里统一做，返回 `message` 给前端弹提示。

**2. `GET /stock/batch/list`** — 批次列表（分页）

- query：`materialId`、`materialName`(模糊)、`warehouseId`、`zoneId`、`levelId`、`remainOnly=true`(只查剩余>0)、`pageNo`、`pageSize`
- result 每行：批次全部字段 + 位置名称。

**3. `GET /stock/batch/queryById?id=`** — 批次详情

- result：批次字段 + `snList:[{id, snNo, status, outTime}]`。

**4. `GET /stock/batch/recommendLocation?materialId=`** — 入库推荐库位

- 逻辑：该物料最近一次入库台账的库位 → 无则物料类别默认库区首空层 → 无则空。
- result：`{ warehouseId, zoneId, levelId, warehouseName, zoneName, levelName }`（可为空）。

**5. `GET /stock/batch/recommendOutbound?materialId=&qty=`** — FIFO 出库推荐

- 逻辑：`stock_batch` 按 `inTime` 升序，过滤 `remain_qty > 0`，累计到 ≥ qty。
- result：
  ```json
  [{
    "batchId": 1, "batchNo": "P20260814001", "inTime": "2026-08-14 10:00:00",
    "unitId": 1, "unitName": "个", "unitPrice": 5,
    "remainQty": 10, "recommendQty": 6,
    "warehouseId": 1, "zoneId": 1, "levelId": 1,
    "warehouseName": "主仓", "zoneName": "A区", "levelName": "A-01",
    "snList": [{ "snNo": "WL20260814001-0001", "status": "IN" }]
  }]
  ```

**6. `POST /stock/sn/generate`** — 系统生成 SN

- body：`{ materialId, materialCode, qty }`
- result：`[{ snNo, materialId, materialCode }]`（数量 = qty，按 2.3 规则）。

**7. `POST /stock/sn/print`（或导出）** — SN 标签打印

- body：`{ batchId }` 或 `{ snList: [snNo] }`
- result：图片/PDF（或可下载 URL），内容：物料名 / 型号 / 批次号 / SN。

### 4.2 扩展 `manualIn` / `manualOut`（核心改动，向后兼容）

**`POST /stock/ioRecord/manualIn`** — 入参新增（**全部可选**，不传 = 旧逻辑）：

```json
{
  "materialId": 1, "unitId": 1, "unitName": "个",
  "unitQty": 10, "unitPrice": 5, "ioType": "IN",
  "sourceType": "apply", "sourceId": 100, "sourceNo": "PO20260814001",
  "remark": "",
  "warehouseId": 1, "zoneId": 1, "levelId": 1,
  "snList": ["WL20260814001-0001", "WL20260814001-0002"]
}
```

- **后端逻辑（入库）**：
  1. 校验单位换算（unitId → 基准单位），算 baseQty/amount（沿用现有）。
  2. **生成/追加批次**：按 `sourceNo + materialId + unitPrice` 找批次——已存在 → 累加 `qty/remainQty`；不存在 → 新建（`batchNo` 生成，`in_time=now`，带库位）。
  3. **SN**：入参 `snList` 非空 → 逐条落 `stock_batch_sn`（status=IN，校验同物料唯一）；为空且物料开 SN 管理 → 后端自动生成补齐（见 D4）。
  4. 写台账 `StockIoRecord`（带 batch_no/库位/SN），更新 `stock_material.stockQty`。

**`POST /stock/ioRecord/manualOut`** — 入参新增（可选）：

```json
{
  "materialId": 1, "unitId": 1, "unitName": "个",
  "unitQty": 6, "unitPrice": 5, "ioType": "OUT",
  "sourceType": "apply", "sourceId": 100, "sourceNo": "PK20260814001",
  "remark": "换批：XX",
  "batchId": 1, "batchNo": "P20260814001",
  "levelId": 1,
  "snList": ["WL20260814001-0001"]
}
```

- **后端逻辑（出库）**：
  1. **未传 batchId**：按 FIFO 兜底——`inTime` 升序扣 `remain_qty`，直到满足 `unitQty`；**任一批次剩余不足顺延**，全部批次不足则报错「库存不足」。
  2. **传了 batchId**：从指定批次扣；剩余不足报错（或部分扣 + 提示，见 D9）。
  3. **传了 snList**：SN 级出库——逐个把对应 SN 置 `OUT`、记去向/时间；SN 已在 OUT 报错。SN 数量应与 unitQty 对应（SN 按单品 1 计，折算基准单位）。
  4. 写台账（带 batch_no/库位/SN），更新 `stock_material.stockQty`（扣减）。
  5. **换批留痕**：前端在 remark 填原因（见 2.5），后端原样落台账即可。

### 4.3 数据字典 / 状态

| 字典编码 | 项 | 说明 |
| --- | --- | --- |
| `stock_sn_status`（新增） | `IN` 在库 / `OUT` 已出 / `LOCKED` 锁定 | SN 状态标签色 |
| `stock_batch_source_type`（可选） | `apply` / `manual` | 批次来源标签 |

---

## 五、存量数据处理

- 改造前已有库存的物料（`stockQty > 0`）：后端提供**初始化批次**——按每个物料当前 `stockQty` 生成一个「历史批次」（batchNo 如 `H+日期+序号`，`in_time` = 该物料最早台账入库时间，无则初始化时间；库位/SN 空）。保证改造后 FIFO 可算、库存总数不丢。
- 旧台账不回填批次/库位/SN 列。

---

## 六、向后兼容要求

- `manualIn/manualOut`：**所有新参数可选**；不传批次/库位/SN 时完全走旧逻辑（整块库存变动），现有库存管理页手动出入库不受影响。
- 物料 `is_batch_mgr=0` 时，出库/入库不生成批次、不做 FIFO 推荐。
- 位置/批次/SN 接口均为**新增**，不改变既有接口返回结构（`StockApply/StockIoRecord` 只增字段）。

---

## 七、需要一起确认的逻辑点（交流重点）

| # | 问题 | 建议（前端立场） |
| --- | --- | --- |
| D1 | 出库必须精确到 **SN**，还是批次级即可？ | 先**批次级 + SN 可选**；要严格单品追溯再升 SN 级 |
| D2 | 层（货位）做不做**容量校验**？ | 本期不做，仅展示 capacity |
| D3 | **还料入库**：沿用原批次回库，还是新批次？ | **沿用原批次**（SN 归位）；无 SN 的还料生成新批次 |
| D4 | 是否**所有物料强制 SN**？ | 按物料开关（isSnMgr）；需追溯的（设备/贵重件）开 |
| D5 | **手动出入库**（库存管理页）是否也走批次/库位？ | 开批次管理的物料强制选库位并生成/扣批次 |
| D6 | **批次号 / SN 规则**：`P+yyyyMMdd+序号` / `物料编码+日期+流水` 是否可行？ | 可行即用；或后端自定义，前端不预填 |
| D7 | 标签打印：**后端出图**（PDF/图片）还是前端 qrcode 渲染打印？ | 前端渲染（少一次后端依赖）；内容物料名/型号/批次号/SN |
| D8 | **同一 sourceNo+物料 多行不同单价**：每行一个批次，还是合并？ | 按单价拆批次（一个批次一个价） |
| D9 | 指定批次出库但**剩余不足**：直接报错，还是部分扣+提示？ | 报错，由前端重新推荐 |
| D10 | **批次扣减与 SN 出库的并发**：多用户同时出库同一批次，如何保证不超扣？ | 乐观锁/行锁 remain_qty（建议后端做唯一防超卖） |
| D11 | **仓库管理字段范围**：仓库要不要 `负责人/启用停用`，库区/层要不要更多业务字段（温区、库别、拣货优先级等）？ | 先最小集（name/code/层级关联/capacity/remark），需要再加 |

---

> 前后端对齐以上后，按 `docs/物料批次-库位-SN管理改造方案.md` 的 P0→P4 阶段实施（P0 前端修 bug 已完成；P1 批次 → P2 库位 → P3 SN/标签 → P4 FIFO 出库）。每个阶段完成后更新本模块文档。
