---
name: 首汇科技通用审批
description: 复用 OA 外壳、依据墨刀原稿还原的流程设计工作台
colors:
  oa-primary: "var(--ant-primary-color, #1677ff)"
  surface: "var(--component-background, #fff)"
  paper: "#fff"
  canvas: "#f7f8fc"
  primary: "#7371e6"
  step-active: "#7671df"
  selected: "#7875ee"
  focus: "#6266dc"
  section-mark: "#7774e9"
  text: "#303448"
  node-text: "#424659"
  muted: "#545b6c"
  divider: "#dcdee7"
  control-border: "#d9d9d9"
  form-selected: "#f0f7ff"
  table-head: "#f8f8fc"
  approval-start: "#4556e9"
  approval-end: "#682ce8"
  starter-start: "#4e568c"
  starter-end: "#898ea6"
  cc-start: "#eb795c"
  cc-end: "#efaf49"
  notice-start: "#3e8acc"
  notice-end: "#58b7dd"
  task-start: "#72be80"
  task-end: "#b3d151"
  icon-approval: "#5644ef"
  icon-cc: "#f08b43"
  icon-condition: "#e0bd35"
  icon-parallel: "#c96bd1"
  icon-notice: "#419bd5"
  icon-task: "#81ba54"
typography:
  title:
    fontSize: "22px"
    fontWeight: 600
  drawer-title:
    fontSize: "16px"
  section:
    fontSize: "14px"
    fontWeight: 600
  body:
    fontSize: "13px"
  node-title:
    fontWeight: 500
  caption:
    fontSize: "12px"
  micro:
    fontSize: "11px"
rounded:
  control: "4px"
  node: "2px"
  branch-action: "15px"
spacing:
  compact: "8px"
  field: "12px"
  node-inline: "14px"
  content: "16px"
  panel: "20px"
  section: "24px"
  drawer: "28px"
components:
  field-tool:
    rounded: "{rounded.control}"
    padding: "10px 12px"
  selected-field:
    backgroundColor: "{colors.form-selected}"
    padding: "14px"
  flow-node:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.node}"
    width: "200px"
  node-title:
    textColor: "{colors.paper}"
    height: "40px"
    padding: "0 14px"
  node-body:
    typography: "{typography.caption}"
    padding: "12px 14px"
  settings-drawer:
    width: "min(1080px, 82vw)"
  node-menu:
    width: "276px"
    padding: "4px"
---

# Design System: 首汇科技通用审批

## Overview

**Creative North Star: "OA 审批工作台"**

本文件仅约束 `src/views/workflow/`。复用 OA 导航、页面外壳与 Ant Design Vue 公共组件；流程设计区依据用户指定的墨刀原稿组织画布、节点和设置抽屉。渐变节点、彩色圆形图标和小标题左侧短条均有原稿依据，属于此设计器的局部视觉语言，不推广为 OA 全站主题。

规范从当前 `designer/` 与 `components/WorkflowEditor.vue` 的实际模板和样式提取，根目录 `PRODUCT.md` 约束业务状态与保存边界。墨刀原稿未提供任务编辑详情，当前任务说明设置属于补充设计，不宣称全量逐像素一致。真实 OA 页面截图位于 `.impeccable/review/`；本轮未发布部署，视觉证据不代表发布运行或真实审批闭环。

**Key Characteristics:**
- 浅灰紫画布承载紧凑渐变节点，白色大抽屉集中编辑。
- 六类节点采用两列菜单、彩色图标与可读名称。
- 条件与并行分支按横向泳道展开，保留纵向插入位置。
- 会话设计稿、服务端保存与发布运行具有不同的状态文字和操作边界。

## Colors

机器可读颜色来自当前代码中的字面量或宿主变量，前置 token 是规范值；不从参考截图重新采样或用旧版蓝色规范覆盖实现。

### Primary
- **设计器柔紫**：编辑器主操作、抽屉按钮与页签指示条；当前步骤、选中轮廓与键盘焦点各使用对应 token。
- **OA 操作蓝**：设计器局部覆盖之外的宿主公共操作，继续继承主题变量。

### Secondary
- **角色渐变**：发起人灰紫、审批蓝紫、抄送橙黄、通知蓝青、任务绿黄。渐变方向与完整声明记录在 sidecar 中。
- **节点类型图标**：审批紫、抄送橙、条件黄、并行粉紫、通知蓝、任务绿；图标必须同时显示类型名称。

### Neutral
- **画布浅灰紫**：流程背景与分支连线遮边使用相同颜色。
- **工作表白**：节点、菜单和编辑区域；宿主表面变量继续服务其他页面容器。
- **正文深灰、辅助灰、分隔灰**：用于标题、摘要和连接线。字段选择保留原表单设计器的淡蓝背景。

**The Prototype Scope Rule.** 原稿限定的紫色、渐变和彩色图标只约束流程设计器；OA 外壳及其他业务模块继续遵循宿主主题。

## Typography

继承 OA 与 Ant 的字体栈；本模块没有新增字体文件或独立 font-family。前置 token 中的字号、字重来自当前样式，不假定原稿字体已被完整提供。

页面主标题使用 title；抽屉标题使用 drawer-title，其中可编辑标题输入为600字重。设置小标题使用 section，配左侧短条；画布基础字号与步骤文字使用 body。节点标题字重使用 node-title，字号继承宿主按钮实际样式，不补写代码没有指定的字号。节点摘要及提示使用 caption，画布拖动提示和顶部保存标签使用 micro。非流程步骤的辅助说明仍为13px、1.7行高。

## Layout

流程步骤填充现有 OA 内容区。编辑器流程视图高度为 `calc(100vh - 142px)`、最小480px，画布占剩余高度并在内部滚动。普通画布默认高度为 `calc(100vh - 250px)`、最小420px；进入全屏时占满视口。

顶部保留返回、五步导航、保存状态、会话稿操作和保存下一步。桌面头部高68px，步骤间距26px；1450px及以下头部换行，步骤进入下一行，间距18px并允许横向滚动。此处以生效的 prototype-header 规则为准，不沿用旧头部断点结论。

流程节点宽度见 flow-node，标题高度见 node-title，正文最小56px；节点之间为76px连接区。条件与并行分支横向展开，每条泳道最小280px、左右内边距30px，节点维持相同宽度。画布支持空白拖动、缩放、适应、回到发起节点与全屏；不是自由连线编辑器。

点击节点打开带遮罩的大抽屉，宽度见 settings-drawer；不再使用固定390px属性侧栏。抽屉标题内边距24px 28px 8px、内容12px 28px 28px、底部16px 28px，设置正文最大宽920px。760px及以下移动画布工具位置并隐藏拖动提示，条件行可换行；抽屉仍按视口比例呈现，不自动移动到画布下方。

PeoplePicker 使用720px Ant 模态框，左右等宽分列候选与已选，选择区域最小360px、列表最大300px并独立滚动。480px及以下仍保持双栏，内边距由16px收为10px。

表单配置保留既有三栏：190px、弹性预览、280px；1200px及以下为150px、弹性预览、240px；900px及以下属性移到下方。该布局与新的流程画布分别维护。

## Elevation & Depth

浅灰紫背景与白色卡片形成主要层次；节点与圆形插入按钮使用轻阴影，不再采用“所有自定义区域无阴影”的旧规范。完整阴影值记录于 sidecar：节点为 `0 2px 8px #26334d08`，插入按钮为 `0 2px 7px #2331570d`。抽屉、模态框和浮层保留 Ant 遮罩与浮层层级。

## Shapes

节点采用 node 小圆角，工具栏和预览控件采用 control 圆角。插入按钮直径26px；菜单图标直径29px；添加分支按钮采用 branch-action 圆角。选中节点为2px selected 轮廓、3px偏移；键盘焦点使用2px focus 轮廓并通过局部 `!important` 对抗宿主 outline reset。连接线宽1px，分支以横线展开、纵线连接并汇合。

## Components

### Buttons

主要保存操作沿用 Ant，顶部与抽屉在本作用域覆盖为设计器柔紫。自定义圆形加号悬停转为紫底白色；节点删除按钮在悬停或键盘焦点进入卡片时出现。禁用操作保留明确不可用态；只读内容可以查看。

### Inputs / Fields

输入、搜索、选择、单选和复选控件复用 Ant。通知模板将“置入字段”选择操作放在文本框区域内部右下角，右侧和底部各12px、宽140px，使用 primary 紫色背景及白色文字；选择值保持 null，插入后仍显示“置入字段”；文本区预留52px底部内边距避免遮挡文本。字段权限使用表格，表头为 table-head；小标题使用3px section-mark 左条和10px左内边距。

### Navigation

编辑器采用五步导航。审批节点设置具有“人员配置”“审批配置”“按钮配置”“字段配置”四个页签。抽屉标题可编辑节点名，底部有保存、取消；点击遮罩或 Escape 不直接关闭抽屉。

### Chips / Status

“未保存”“会话已存”“已保存”区分编辑状态与保存位置，标签文字与颜色共同表达。“保存会话设计稿”写入当前浏览器会话的 sessionStorage，不是服务端持久化，也不代表跨设备共享。抽屉内“保存”先应用节点编辑；不能把它描述为已发布。

### Cards / Containers

发起人、审批、抄送、通知和任务使用各自渐变标题，白色摘要区显示当前配置。六类插入菜单按两列排列：审批、抄送、条件、并行、通知、任务。条件分支支持条件组与兜底分支的可视化设置，并行分支保留多个泳道；这些设计能力不等于已接入执行协议。

### PeoplePicker

左侧搜索与候选列表，右侧已选数量、清空及逐项移除。保留加载、空结果、错误重试及未解析名称时的标识显示；不把加载失败渲染为空选择成功。任务详情目前只有补充的任务说明设置，原稿没有足够证据支持更完整还原声明。

### Read-only / Blocking States

只读禁用编辑，忙碌态防止重复提交。含未知执行协议的节点、分支或原型配置时，允许保存会话设计稿，阻止服务端保存下一步与发布；不静默丢弃设计配置或压平分支。常驻信息条明确显示“可保存当前会话设计稿；暂不能发布运行”。该边界描述当前 UI 行为，不承诺后端协议。真实 OA 截图、静态检查、服务端保存和发布部署分别报告。

## Do's and Don'ts

### Do:
- **Do** 复用 OA 外壳与 Ant 公共组件，在设计器范围内保留原稿的渐变、彩色图标和标题左条。
- **Do** 从当前生效代码提取颜色、字号和尺寸，并同步更新 token 与 sidecar。
- **Do** 保持节点、分支和抽屉选择上下文，以及可辨认的键盘焦点。
- **Do** 区分会话设计稿、服务端保存、发布运行和真实审批结果。

### Don't:
- **Don't** 用旧250px蓝色节点或固定390px侧栏规范覆盖当前设计器。
- **Don't** 把原稿未提供的任务编辑详情宣称为逐像素还原。
- **Don't** 把真实 OA 截图等同于发布部署或后端审批闭环。
- **Don't** 为绕过执行限制而丢弃节点配置、压平分支或误报会话稿为服务端已保存。


## 2026-09-23 契约对接补充

顶部“下一步”只切换本地步骤，“保存完整草稿”才提交服务器；本地暂存须显示“未保存到服务器”。条件、并行分支已连接结构协议，顺序组与内嵌子流程支持回读；CC/NOTICE/任务及尚未定义的自动规则仍为仅设计。人员选择上限100并展示部门树、按部门筛选；节点多来源合计仍需校验100。发布不自动启用。分支名称没有服务端持久化协议，重新打开按结构生成。


## 2026-09-24 更多配置校正

第四步按用户两张截图改为通知配置、其他配置、打印配置三个页签。浅灰背景中居中白色面板，通知页使用三列表格（名称/说明/开关），其他页按超时提醒、发起人权限、审批人去重、超时自动完成纵向分组。现有权限编辑移到顶部“权限范围”抽屉。原稿开关状态仅预览，最新model/save无对应全局协议，因此禁用并常驻标注尚未接入；打印稿未提供，保留待补空态。发起人权限第一条原稿为“c”，保留原文并提示待确认，不能猜测业务语义。
