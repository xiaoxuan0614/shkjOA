### 2026-10-29 维修审批统一业务提交接口

PC InstanceDrawer 对 businessType=REPAIR_OPS_APPLICATION 的通过/驳回统一 POST /repair/application/review，覆盖报价（含市场节点）、完结、关闭、内协、外协、转单；移动端 RepairApprovalPopup 同步，OpsWorkflow/repairOrderApi 原已使用此接口。提交 applicationId=businessId、instanceId、taskId、approve、comment、requestId，不传 action/version。内协选人和转单接收人仍按场景追加；驳回不传人员字段。完结驳回未选 returnType 时沿用后端默认 MATERIAL_SUPPLEMENT，移动工作台原有 returnType 选择保留。

仍按工作流当前任务及 actions 控制可办理权限，详情/表单/权限读取继续使用工作流接口；撤回及其他流程操作不改为 review。未确认的网络提交保留原始载荷与 requestId 重试；明确业务失败允许更正重提。已通过 PC 路由、转单、内协、工作流回归和移动审批弹窗/协助专项；未提交真实审批、未部署。两份菜单配置指南已核查，无新增菜单或角色授权。

2026-10-28 展示精简：维修报价审核待办仅保留故障范围、报价信息（明细与合计），移除客户、项目、分期和备注。展示专项通过；菜单配置及业务/API影响已检查，无接口或权限变更。

### 2026-10-28 PC维修报价审核待办详情

InstanceDrawer按REPAIR_OPS_APPLICATION/repair_ops_quotation使用RepairQuotationSnapshot，展示本次送审的客户、项目、分期、故障及维修范围、备注，以及报价项目/数量/单价/金额表格和合计。仅读取instance/form权限投影后的快照，不补查当前工单替代历史报价；未返回的信息显示为空，HIDDEN字段不展示。按form.scope.faultScope与form.items读取，支持对象/JSON及扁平路径投影；明细使用Big逐行HALF_UP两位后求和，价格缺失或相关字段隐藏时不推算合计。保留审批进程、原办理动作与查看维修单详情入口。

已刷新Apifox核对报价提交、维修流程模板和实例详情。报价展示专项、通用详情/工作流回归及定向ESLint通过；未完成真实浏览器报价待办验收，未提交审批。菜单配置已检查，无新增菜单、权限或接口。

# PC 维修记录（一期）

### 2026-10-27 PC维修转单待办审批

维修转单沿用申请人填写的转单原因，接收人必选。通用审批抽屉识别 repair_ops_transfer，点击同意先通过 GET /repair/options?type=internal 读取候选，默认选择申请中的 form.targetUserId，主管可更换；候选缺失或不合法时禁止通过。准备期间仅按钮loading，准备成功才弹确认框。通过/驳回统一 POST /repair/application/review，传 applicationId（申请业务ID）、instanceId、taskId、approve、comment、requestId；更换接收人时传 transferTargetUserId，不更换省略，驳回不传人员字段且意见必填。后端最终校验人员并完成负责人及待办流转，前端不单独调用指派接口。网络失败保留原始载荷重试，成功清理提交锁。

专项组件回归、既有内协/工作流回归及定向ESLint通过；未提交真实审批，未完成浏览器联调验收。菜单配置已检查，无新增菜单或授权；本次修改PC审批端，不改变移动端提交表单。

2026-10-27 内协申请、外协申请、内协审批选人及独立指定人员中的原因标签统一为“需要协助原因：”；原因原文不加前缀入库，转单原因/关闭原因不变。无API或菜单权限调整。

2026-10-27 范围扩展：此前维修关闭审批的查看工单入口，现在覆盖通用审批中所有维修事项（REPAIR_OPS_APPLICATION），包括内协、外协、转单等；工单标识来源、权限、错误处理、关闭后返回审批的行为不变。非维修审批不提供入口。

验证：当前首页维修关闭待办已实际打开对应工单详情，工单编号与待办一致；关闭详情后返回原审批。未提交同意/驳回。专项回归、通用审批回归、SFC、定向ESLint和类型检查通过；菜单文档已检查无需改动。

2026-10-27 首页维修关闭审批申请内容新增“查看维修单详情”入口，复用本模块只读RepairDetail抽屉；使用审批版本表单可见orderId调用既有GET /repair/order/detail?id=，禁止使用关闭申请ID代替。关闭详情返回原审批，审批意见及办理权限不变；缺少可见工单编号时禁用入口。不新增菜单或更改角色授权。

内协审批布局：申请内容与审批进程分为两个Tab，进程只读显示流转信息，不含操作按钮或技术性描述。同意/驳回放底部固定区，单任务自动选中，多任务需先选择具体节点/部门；只展示后端允许且canHandle的动作，提交仍保留二次确认及任务ID，不改变后端鉴权或接口契约。真实页面只读验证通过，未代用户审批。

2026-10-23 内协审批申请内容：通用审批详情仅对 `REPAIR_OPS_APPLICATION / repair_ops_collaboration` 精简为部门名及对应协助原因，不重复显示内部ID、原始JSON、部门计数。数据只取 instance/form 字段权限过滤后的投影，不额外读取隐藏快照字段；无可见数据时显示空状态。审批进度及办理控制保持原样，外协和其他审批不受影响。PC真实待办已验证，未提交审批。

PC 用于查询与记录，现场作业及业务申请在移动端办理。保留现有值班配置、通用审批和巡检页面。本期不增加统计看板。

## 入口与权限

报修记录 `/operation/reports` → `operation/reports/index`，默认本人报修；维修记录 `/operation/repairs` → `operation/repair/index`，默认全部可见。均可切换范围和状态，后端鉴权决定最终范围。ALL不等于所有人都能查看全公司；REPORTED对管理员也只返回本人报修。

2026-10-22 已在当前 localhost:3101 所连后台创建两项 PC 菜单并授权 admin，具体配置见菜单指南。PC 权限 161→163，移动端 14 项保持不变，其他角色未修改。详情使用抽屉，随列表权限进入，后端再次鉴权。

## API 与展示

2026-10-22 刷新 Apifox 8679942 后对接只读 GET：
- `/repair/order/list`：scope/workStatus/pageNo/pageSize；不传不存在的名称、日期筛选参数，不拉详情补齐列表。
- `/repair/order/detail?id=`：报修、维修作业、人员、派单、物料、报价、完工、申请、审批、附件。集合只呈现服务端可见内容；空集合不推断整单从未发生相关业务。
- `/repair/order/logs?id=&pageNo=&pageSize=20`：操作时间线按需独立分页，含审批意见及当次附件。
- `/repair/order/attachment/download?id=fileId`：通过现有登录HTTP客户端下载二进制；不公开拼接Token。

同一工单两入口共用详情。详情切换/关闭使旧请求失效。0金额和false保留；报价状态独立于维修状态，审批不套用合同数字映射。有效维修时长和人员累计工时分别读取后台秒数转小时，不在前端汇总成同一指标。

物料与作业关联接口未稳定返回显示名称时，明确展示物料ID/关联作业ID，不伪造名称。未做业务写入、跨工单统计、导出、现场打卡或审批办理。审批中心保留原入口。本期附件支持受控下载，不宣称已做视频在线预览。

## 验证

`scripts/repair-records-regression.cjs` 覆盖参数白名单、响应验证、0/false展示、只读边界、SFC编译。管理员菜单与后端记录已登录联调；附件下载仍需有附件的实际记录验证。

2026-10-22 验证结果：专项脚本（含切换工单旧响应隔离、关闭清空详情）、新增文件 ESLint、五个 SFC 编译、差异空白检查通过。Vite 生产构建通过；postBuild 初次受沙箱 IPC 限制，授权单独执行后成功。随后通过 Chrome 管理员登录验证：刷新后两个侧栏菜单可见；报修列表默认本人报修返回 3 条，维修列表默认全部可见返回 26 条；打开报修详情，维修作业与操作时间线正确加载。未进行维修业务写入，附件下载尚未验收。

## 2026-10-23 报价状态字典

列表 quotationStatus、详情整单报价状态及 quotations[].stage 读取 repair_quotation_status。字典缺项展示原值，空值显示 —；不使用通用审批状态映射覆盖报价状态。菜单和权限无需调整。


## PC内协人员指定待办（2026-10-27）
2026-10-27 PC内协指定待办修复：TodoActionHost按REPAIR_COLLABORATION_ASSIGN打开RepairAssignmentModal，使用actionParams.applicationId/departmentId读取本部门候选，支持搜索多选1至20人并调用assign。成功刷新待办；网络不确定重试保持requestId/名单，后端拒绝显示真实原因。不需要新增菜单或角色权限。

GET /repair/collaboration/assignmentOptions?applicationId=申请ID&departmentId=部门ID；POST /repair/collaboration/assign提交applicationId、departmentId、requestId、assignedUserIds。按用户确认的实际服务规则，不在前端要求所有受邀部门全部通过。入口位于首页待办，不增加维修日志或打卡操作。菜单配置文档已检查，复用当前待办访问，不新增菜单按钮或扩大角色授权。

实际页面验证：PC首页REPAIR_COLLABORATION_ASSIGN已打开指定人员弹窗；候选接口返回NoClassDefFoundError: org/jeecg/modules/repair/RepairOpsDepartmentCollaboration，需后端修复运行时类加载。未提交真实指派。scripts/repair-assignment-regression.cjs覆盖类型路由、部门匹配、请求体、幂等重试及成功刷新，已通过。

2026-10-27 双端待办展示修正：title作为待办名称，summary仅作下方小字描述，空描述不占位；title为空显示未命名待办。PC保留前置彩色todoType标签，title独立作为主标题；移动端保留原彩色标识，首页及完整列表共享修正。办理逻辑、查询参数及权限不变，菜单配置已检查无需调整。

2026-10-29 维修完结审批：专用快照分区展示报修信息、完结说明、可展开维修记录、物料情况及审批记录。仅读取授权字段投影，隐藏字段不显示；缺失分区提示未提供，不拿实时工单补充历史依据。金额两位小数。顶部查看维修单沿用RepairDetail详情抽屉，可关闭返回原审批上下文，使用orderId而非申请ID。原审批动作和驳回必填保持不变。Apifox已刷新；当前提审明确提供finalAmount/description/amountChangeReason，其他内容取决于实际快照字段。附件沿用原快照展示能力，未新增照片预览。专项、入口、报价及通用详情回归、ESLint通过；真实完结待办浏览器联调未完成，未提交审批。两份菜单配置文档已检查，无菜单授权变化。

2026-10-29 按用户确认，维修完结申请内容移除重复审批记录，仅保留现有审批进程Tab。完结快照及通用详情回归通过；菜单文档和API影响已检查，无菜单、权限或接口变化。

2026-10-29 查看维修单入口移至申请内容Tab顶部，使用主按钮突出展示，移除抽屉标题栏重复入口；保留原禁用条件、详情打开及返回机制。入口与完结快照回归通过。菜单及API文档影响已检查，无菜单、权限或接口变更。

2026-10-29 维修完结审批隐藏无可见内容的分区及其标题，移除“本次审批快照未提供可见的”提示；已有“无需报价”业务状态继续展示。专项回归、ESLint通过；菜单和API影响已检查，无接口或权限变化。

2026-10-29 维修记录详情的维修作业Tab迁移至GET /repair/work/page（orderId/pageNo/pageSize=10），使用返回total分页，首次进入Tab加载；切换Tab及关闭单条详情保留页码，切工单重置并丢弃旧请求。点击查看详情才请求GET /repair/work/detail（同时传orderId/recordId），校验响应记录归属。详情展示本次故障、维修内容、人员、外协、车辆、用料、附件；签到签退中文状态/异常说明取分页响应，不自行计算异常。公共路径附件走现有预览工具，维修附件ID走原鉴权下载。工单详情不再读取workRecords，操作时间线仍用order/logs。API参数、ID防错、SFC编译、ESLint、diff通过；未完成真实浏览器工单分页和详情联调，未提交业务。菜单两份配置文档已检查，无菜单及角色授权变化。
