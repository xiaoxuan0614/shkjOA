---
name: OA 巡检 Mock 页面
description: 仅记录巡检 PC 页已实现的局部视觉规则，继承现有 OA 与 Ant Design Vue。
colors:
  text: "#262626"
  secondary-text: "#595959"
  surface: "#fff"
  separator: "#e8e8e8"
  answer-separator: "#f0f0f0"
  picker-separator: "#eee"
  selected-surface: "#e6f4ff"
  selection-accent: "#1677ff"
  media-surface: "#fafafa"
typography:
  page-title:
    fontSize: "20px"
    fontWeight: 600
  section-title:
    fontSize: "18px"
  group-title:
    fontSize: "15px"
  secondary:
    fontSize: "13px"
  caption:
    fontSize: "12px"
  readonly:
    lineHeight: 1.7
rounded:
  surface: "8px"
  sheet-navigation: "4px"
spacing:
  page-padding: "16px"
  page-gap: "12px"
  surface-padding: "20px"
  form-column-gap: "24px"
  execution-gap: "28px"
components:
  inspection-surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "{spacing.surface-padding}"
  sheet-navigation:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sheet-navigation}"
    padding: "12px"
  sheet-navigation-selected:
    backgroundColor: "{colors.selected-surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sheet-navigation}"
    padding: "12px"
---

# Design System: OA 巡检 Mock 页面

## Overview

本文件仅适用于 `src/views/operation/inspection/index.vue`，记录当前实现，不替代项目级设计规范。视觉依据为既有 OA 蓝白管理界面、Ant Design Vue 与公共 BasicTable；用户确认的墨刀四层结构映射为巡检对象、巡检点、巡检任务、巡检记录。

页面面向桌面业务操作，使用清楚的标题、查询区、表格、配置表单与执行详情。Mock 提示持续说明本浏览器数据边界；当前入口限已登录 admin。此处不定义新的视觉方向，也不涉及移动端应用。

## Colors

正文、次要说明、白色内容面和浅灰分隔使用上述局部颜色。蓝色选中背景及边框用于巡检单导航，焦点描边使用同一强调色。状态标签由 Ant Design Vue 的语义颜色实现，并保留“正常 / 异常”“待处理 / 已办结”等文字。

控件主色、危险按钮、标签色阶及禁用态来自项目主题和组件库；本文件未将它们重新定义为局部 token。

## Typography

字体继承 OA。页标题、区块标题、检查项分组标题及次要说明采用 frontmatter 中提取的层级。已提交的位置、结论及已办结说明使用正常正文色、保留换行并允许长内容折行；检查结果使用静态标签。

## Layout

页头、Mock 提示、主体按网格纵向排列。列表以 BasicTable 呈现，横向滚动宽度为 1050px，默认每页 10 条；工具区允许换行，搜索框宽 280px，记录状态筛选宽 140px。

配置表单默认三列。执行详情默认左侧 220px 巡检单导航、右侧可伸缩表单；照片和视频采用 150 × 100px 的 contain 预览。对象选择弹窗宽 650px。

浏览器宽度不超过 1000px 时，表单两列，执行导航缩至 180px、间距缩至 16px。不超过 640px 时，页面和内容面分别采用 8px / 12px 内边距，表单与执行详情变为单列，巡检单导航横向滚动，检查结果另起一行。这些是 PC 页面缩窄时的布局规则，不代表移动端验收。

## Elevation & Depth

局部页面未定义阴影或动画。白色内容面、分隔线及选中背景区分区域。弹窗等浮层继续使用组件库效果。

## Shapes

内容面与巡检单导航采用 frontmatter 中的圆角；检查项、对象选择和异常处理通过细分隔线组织。标准按钮、表单和标签形状继承公共组件。

## Components

- 列表：四层页签配合公共 BasicTable；新增、编辑、复制、删除与生成记录随层级显示。
- 配置：垂直标签表单，对象检查项可排序，巡检点选择对象及检查项，任务配置周期和巡检单数量。
- 执行：左侧巡检单导航、上方汇总、右侧逐项填写与提交；导航选中态使用蓝色底和边框，按钮焦点描边为 2px、偏移 2px。
- 只读内容：提交后展示正文和结果标签，办结后展示处理说明；不以禁用输入框承载需阅读的内容。
- 异常处理：独立分隔区展示处理说明、附件和办结状态，原异常结果保留。
- 边界提示：Mock 提示、本地存储错误、空状态及确认弹窗使用现有组件。

实现依据为当前 `index.vue`。`.impeccable/review/inspection/desktop.png` 与 `detail.png` 为只读内容修正前截图；静态文本/标签修正已在源码确认，修正后截图尚待补充，不能据此宣称视觉验收完成。

## Do's and Don'ts

- Do 沿用 OA、Ant Design Vue 与 BasicTable，保持局部样式作用域。
- Do 用可读正文和语义标签展示已提交、已办结内容。
- Do 明示本浏览器 Mock 边界，并将源码检查和浏览器验收分别报告。
- Don't 将本页局部规则提升为全站设计改造。
- Don't 用禁用表单样式呈现需要阅读的已提交内容。
- Don't 把本地演示表述为真实派单、审批、跨设备数据或移动端已交付能力。
