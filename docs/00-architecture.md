# SAP Map — 架构与目录设计

> 一个面向人的 SAP 多模块知识地图：模块 → 业务流程 → 流程步骤 → 开发对象 → 示例代码，
> 用一张可无限缩放的空间画布承载，而不是一棵需要点开 5 层菜单的树。

---

## 1. 定位与核心判断

### 1.1 它是什么

| 维度 | 说明 |
|---|---|
| 内容 | SAP 业务流程知识（SD / MM / PP / FI / CO / WM / QM / PM …） |
| 关系 | 网状：同一流程步骤会在多个模块中重复出现；模块之间通过单据流相互咬合 |
| 读者 | 人（顾问、开发、实施、新人自学），不是程序调用 |
| 形态 | 纯静态前端站点，可打包为 GitHub Pages |
| 核心交互 | 缩放看层级、悬停看开发对象、点击看细节、追踪看跨模块 |

### 1.2 关键判断：这是「知识结构图」，不是「业务数据图」

现有多数 SAP 图项目（见 `references.md`）画的是**实例数据**：某张销售订单 → 交货单 → 发票 → 会计凭证。
那是"这一单发生过什么"，节点是会变的。

本项目画的是**知识结构**：模块 → 流程 → 步骤 → 开发对象。节点是稳定的、可复用的、需要被反复阅读的。

这个判断决定了三件事：

1. **布局必须确定性（deterministic）**——不能每次打开都"力导向抖动"一遍。用户靠空间记忆找东西，位置一变就迷路。
2. **内容必须"引用而非复制"**——同一个「创建销售订单」步骤在 O2C、在信用管理、在退货流程里都要出现，但内容只有一份。
3. **信息密度必须随缩放分级（LOD）**——全局要看"骨架"，局部要看"细节"，同一张画布两种读法。

---

## 2. 四层语义缩放（Semantic Zoom）

这是整个产品的骨架。缩放不是"把字放大"，而是**换一种信息表达方式**。

| 层级 | 名称 | 缩放区间 | 画面内容 | 读到的信息 |
|---|---|---|---|---|
| L0 | 星系 Galaxy | `scale < 0.30` | 模块圆角大块 + 模块间主干高速路 | "SAP 有哪几大块，钱和货怎么流动" |
| L1 | 模块 Module | `0.30 – 0.62` | 模块内核 + 流程泳道标题 + 流程缩略骨架 | "这个模块负责哪几件事" |
| L2 | 流程 Process | `0.62 – 1.15` | 完整步骤节点、分支边、触发/产出单据标签 | "这件事按什么顺序发生，在哪分叉" |
| L3 | 步骤 Step | `≥ 1.15` | 步骤展开为卡片：T-Code、角色、输入/输出、开发对象徽标 | "这一步具体谁做、用什么做、改哪里" |
| L4 | 对象 Object | 悬停 / 点击（屏幕空间浮层，不占画布层级） | 开发对象卫星环 + 代码抽屉 | "BAPI/BAdI/CDS 长什么样，怎么调" |

### 2.1 实现要点

- **LOD 由 `scale` 派生，但可被交互覆盖**：悬停一个折叠节点时，即使当前是 L1，也强制该节点以 L3 形态浮出。
- **只展开焦点模块**：全局始终只有 1 个模块处于 L2+ 全展开，其余模块保持 L1 折叠态。
  - 解决性能（DOM 控制在 1500 节点内）
  - 解决认知（"你在哪"永远清晰）
- **折叠要"有损但可辨"**：折叠态不是空白，要保留流程走向的缩略线，让人看得出"这里有 5 步、先分叉再合流"。

### 2.2 方向感的四种表达（用户明确要求）

流程的"方向"不能只靠箭头，要冗余编码：

1. **流光边**：`stroke-dasharray` + `dashoffset` 动画，光点沿流程方向移动（低速，不抢注意力）
2. **序号徽标**：节点左上角 ①②③，跨分支仍可读
3. **渐变推进**：主干边由浅到深，越靠后越"实"
4. **泳道时间轴**：流程底部一条细刻度线，标出触发点 / 决策点 / 过账点

---

## 3. 空间布局原则

### 3.1 全局：按价值链排布，不按字母

```
        ┌──────────── 计划 PP ────────────┐
        │                                  │
  采购 MM ──→ 库存 WM ──→ 生产 PP ──→ 销售 SD ──→ 收款 FI/AR
        │                                  │
        └──────────→ 财务 FI/CO ←──────────┘
```

- 模块位置**手工锚定**在 `modules/*.ts` 的 `anchor: {x, y}`，不参与自动布局。
- 端到端主干（O2C / P2P / R2R）用**跨模块粗边**连接，视觉上是"高速公路"，与模块内部的细边区分。
- 模块之间留白 ≥ 一个模块宽度，保证 L0 时视觉分组清楚。

### 3.2 模块内部：中心核 + 流程泳道

- 模块核（Module Core）：模块名、代码、一句话职责、流程数量。
- 流程泳道（Lane）：从核心向外辐射，每条泳道是一条业务流程，泳道内步骤 DAG 从左到右。
- 泳道之间用**淡色分隔带**，不画框（框会让画面碎掉）。

### 3.3 流程内部：层序布局 + 预计算

- 用 ELK.js `layered` 算法算 DAG 坐标，**构建时或首次进入时算一次并缓存**（`localStorage` + 版本号）。
- 主路径水平居中；异常/补偿分支（退货、冲销、取消）向下生长，视觉上"次要"。
- 决策点用菱形/分叉节点，合并点用汇流节点。

---

## 4. 数据模型

### 4.1 实体

```ts
// 模块
type Module = {
  id: string            // 'sd'
  code: string          // 'SD'
  name: string          // '销售与分销'
  mission: string       // 一句话职责
  accent: string        // 主题色
  anchor: { x: number; y: number }
  laneIds: string[]     // 该模块下的流程
}

// 业务流程
type Process = {
  id: string            // 'sd.o2c'
  moduleId: string
  name: string          // '订单到收款'
  goal: string
  trigger: string       // 触发事件
  outcome: string       // 业务结果
  stepIds: string[]     // 有序引用
  edges: Edge[]         // 分支/汇流/跨模块
}

// 流程步骤（可被多个流程引用）
type Step = {
  id: string            // 'sd.o2c.create-order'
  name: string          // '创建销售订单'
  tcode?: string        // 'VA01'
  fioriApp?: string     // 'Create Sales Orders'
  role: string          // '销售内勤'
  input?: string
  output?: string
  docType?: string      // 'VBAK / VBAP'
  objectIds: string[]   // 关联开发对象
  note?: string
  processIds: string[]  // 反向索引：出现在哪些流程里
}

// 开发对象
type DevObject = {
  id: string            // 'bapi.SALESORDER_CREATEFROMDAT2'
  type: 'bapi' | 'badi' | 'userexit' | 'idoc' | 'cds' | 'odata'
      | 'table' | 'fm' | 'class' | 'form' | 'workflow' | 'event'
  techName: string      // 技术名
  title: string         // 中文说明
  moduleId: string
  since?: string        // 引入版本
  releaseState?: string // 'Released C2' / 'Classic'
  purpose: string
  snippetIds: string[]
  docs?: { label: string; url: string }[]
}

// 代码示例
type Snippet = {
  id: string
  lang: 'abap' | 'json' | 'http' | 'xml'
  title: string
  body: string
  explain: string[]
  pitfalls?: string[]
}
```

### 4.2 关系：多对多的"引用而非复制"

```
Process.stepIds ──┐
                  ├──→ Step ◀── objectIds ──→ DevObject ──→ Snippet
Step.processIds ──┘         ▲
                            │
Flow.nodeRefs ──────────────┘   （跨模块端到端流，只引用 step id）
```

**这是整个设计最关键的一条。** 因为网状必然重复：

- 「创建销售订单」在 `sd.o2c`、`sd.credit`、`sd.returns` 三个流程里都出现 → 只写一份 `steps/`，三处引用。
- 悬停时能回答"这一步还出现在哪些流程/哪些模块"——正是用户要的"展示该流程在其他模块中的信息"。
- 模块间的"同一步骤多归属"用 `cross-anchors` 表达：在别的模块里放一个**幽灵锚点**（ghost anchor），点击即飞过去。

### 4.3 ID 规范（稳定、可读、可深链）

| 类型 | 规则 | 示例 |
|---|---|---|
| module | 小写模块码 | `sd` `mm` `pp` `fi` `co` |
| process | `module.流程` | `sd.o2c` `mm.p2p` |
| step | `module.流程.动作` | `sd.o2c.create-order` |
| object | `type.技术名` | `bapi.SALESORDER_CREATEFROMDAT2` |
| snippet | `snip.语义名` | `snip.so-create-abap` |
| flow | `flow.名字` | `flow.o2c-e2e` |

深链格式：`#/sd/o2c/create-order`（hash 路由，GitHub Pages 无需 404 配置）。

---

## 5. 目录结构

设计原则：**内容与引擎彻底分离**。`src/data` 是资产（长期维护、可贡献），其余是代码（可替换）。

下面是 M2 落地后的真实结构（`*` 表示后续会扩展）：

```
sap-map/
├── index.html
├── package.json
├── vite.config.ts                  # base: './' 适配 GitHub Pages 子路径
├── tsconfig.json
│
├── docs/
│   ├── 00-architecture.md          # 本文：架构 / 数据模型 / 目录
│   └── references.md               # 调研来源与可参考项目
│
├── public/                         # 静态资源（favicon 等，待补）
├── scripts/                        # 构建期脚本（内容校验，待补）
│
└── src/
    ├── main.tsx
    ├── App.tsx                     # 组装：Provider + 画布 + HUD + 浮层
    │
    ├── canvas/                     # ★ 画布引擎（与 SAP 业务无关）
    │   ├── MapCanvas.tsx           # React Flow 容器、LOD 同步、MiniMap
    │   ├── Highways.tsx            # 模块间主干「高速路」（世界坐标 SVG）
    │   ├── GhostLinks.tsx          # 幽灵锚点：同一步骤在其他流程/模块的连线
    │   ├── ghost.ts                # 步骤实例枚举 + 世界→屏幕换算（纯函数）
    │   ├── layout/
    │   │   └── layout.ts           # 世界坐标常量 + 模块/泳道/步骤矩形计算
    │   ├── lod/
    │   │   └── lod.config.ts       # 语义缩放阈值（唯一可调点）
    │   ├── edges/
    │   │   └── FlowEdge.tsx        # 流光边（方向感的核心表达）
    │   └── hooks/
    │       └── useNavigate.ts      # goHome / goModule / goProcess / goStep
    │
    ├── nodes/                      # 自定义节点
    │   ├── ModuleNode.tsx          # L0 大块 / L1 头部，两种面孔交叉淡入
    │   ├── LaneNode.tsx            # 流程泳道（可点击进入）
    │   └── StepNode.tsx            # 步骤卡片，承担 hover 入口
    │
    ├── panels/                     # 屏幕空间的浮层（不受缩放影响）
    │   ├── Hud.tsx                 # 品牌、面包屑、层级指示、图例
    │   ├── CommandPalette.tsx      # ⌘K 全局搜索（步骤/流程/开发对象）
    │   ├── GhostCompass.tsx        # 视口外幽灵锚点的方向标
    │   ├── StepHoverCard.tsx       # ★ 悬停卡片：顾问视角 + 开发对象清单
    │   ├── ObjectDrawer.tsx        # 右侧抽屉：开发视角
    │   └── CodeBlock.tsx           # ABAP / HTTP 代码高亮
    │
    ├── data/                       # ★ 知识库本体（内容资产）
    │   ├── types.ts                # 实体定义，全项目唯一事实源
    │   ├── modules.ts              # 6 个模块 + 模块间主干
    │   ├── processes.ts            # 7 条流程：col/row 手工布局 + 边（含 alt 分支）
    │   ├── steps/
    │   │   ├── index.ts            # SD + FI 应收 + 定价 + 信用
    │   │   └── mm.ts               # MM 采购/库存 + FI 应付
    │   ├── objects/
    │   │   ├── abap-api.ts         # BAPI / 函数模块
    │   │   ├── enhancement.ts      # BAdI / User Exit / 例程
    │   │   ├── data-model.ts       # 表 / CDS 视图
    │   │   ├── integration.ts      # OData / IDoc
    │   │   └── mm.ts               # 采购与库存的开发对象
    │   ├── snippets.ts             # 示例代码
    │   └── index.ts                # 汇总、反向索引、内容自检
    │
    ├── graph/
    │   └── buildGraph.ts           # data → React Flow nodes/edges（纯函数）
    │
    ├── state/
    │   └── viewStore.ts            # zustand：LOD / 焦点 / 悬停 / 抽屉
    │
    ├── app/
    │   └── hooks/useHashRoute.ts   # hash ↔ 视图（GitHub Pages 友好）
    │
    ├── lib/
    │   ├── cx.ts
    │   ├── route.ts                # 路由解析 / 生成 / 写入
    │   └── highlight.ts            # 轻量 ABAP 词法高亮（无外部依赖）
    │
    └── styles/
        └── index.css               # 设计令牌 + 全部组件样式
```

扩展时按这个约定长：
- 内容变多 → `steps/` 拆成 `steps/sd.ts`、`steps/fi.ts`；`objects/` 再按类型拆目录。
- 交互变多 → `components/ui/` 放通用原子组件；`canvas/controls/` 放缩放条等。
- 需要端到端流 → 新增 `data/flows.ts`，只引用已有 `stepId`。

### 5.1 为什么这样分

| 决策 | 理由 |
|---|---|
| `data/` 与 `canvas/` 平级、互不依赖 | 换渲染引擎不碰内容；换内容不碰引擎。未来可把 `data/` 直接给 AI 检索用 |
| `steps/` 独立于 `processes/` | 支撑"网状重复"：流程只存 `stepId` 引用，内容单点维护 |
| `objects/` 按「对象族」分文件 | 5 个文件（abap-api / enhancement / data-model / integration / mm）比 67 个小文件好维护；对象再多可按类型拆目录 |
| `canvas/lod/` 单独成目录 | LOD 是本项目的"心脏逻辑"，值得独立文件与集中阈值配置 |
| `graph/` 与 `canvas/` 分离 | `graph` 是纯函数（可测试），`canvas` 是 React 组件（有副作用） |
| `docs/` 而不是注释 | 内容贡献者不该读代码；文档是协作入口 |

---

## 6. 技术选型

| 需求 | 选择 | 理由 |
|---|---|---|
| 框架 | **React 18 + TypeScript + Vite** | 生态、静态构建、GitHub Pages 零配置 |
| 画布 | **@xyflow/react (React Flow 12)** | 自定义节点就是 React 组件 → 悬停卡片、富文本、动效零成本；MIT |
| 布局 | **elkjs (layered)** | DAG 层序布局质量高，纯 JS 可跑在浏览器/构建期 |
| 动画 | **motion (Framer Motion)** | 布局动画、进出场、spring；与 React 深度集成 |
| 状态 | **zustand** | 视口高频更新不触发全树重渲染 |
| 样式 | **Tailwind CSS + CSS 变量** | 主题色随模块切换（`--accent` 注入） |
| 校验 | **zod** | 内容 schema 即类型，`scripts/validate-content.ts` 可跑 CI |
| 搜索 | **Fuse.js** | 体量小，模糊匹配够用，构建期出索引 |
| 代码高亮 | **Prism（含 abap 语法）** | 轻量、支持 ABAP；Shiki 无官方 ABAP grammar |

### 6.1 为什么不用 Cytoscape / G6

| 库 | 不适合的原因 |
|---|---|
| Cytoscape.js | Canvas 渲染，自定义节点只能用有限图形拼；本项目节点是"信息卡片"，需要真实 DOM |
| AntV G6 | 性能强但 API 重，主题/动效/富文本节点定制成本高；节点量级（数百，非数万）不需要 |
| D3 力导向 | 布局不确定，用户空间记忆失效；且我们明确不要"物理感" |

**结论**：节点规模在 300–2000、强调"可读的信息卡片"而非"大数据拓扑"，React Flow 是对的工具。

---

## 7. 交互规格

| 操作 | 行为 | 动效 |
|---|---|---|
| 滚轮/捏合 | 连续缩放，跨阈值时节点形态切换 | 形态切换 180ms 交叉淡入，不做尺寸补间（避免"橡皮感"） |
| 点击模块 | 相机 fly-to 该模块，其余模块降至 L1 并降透明度至 35% | 380ms `cubic-bezier(.22,.61,.36,1)` |
| 点击流程 | fly-to 泳道，展开为 L2，泳道外元素模糊（backdrop） | 320ms + 布局 spring |
| 悬停步骤 | 浮出 `StepHoverCard`：开发对象列表（按类型分组、带数量徽标） | 120ms 上浮 8px + 淡入 |
| 悬停开发对象 | 右侧预览代码前 8 行 + "打开" | 即时 |
| 点击开发对象 | 右侧抽屉展开：完整代码、参数、调用示例、官方文档深链 | 280ms 侧滑 |
| 跨模块锚点 | 悬停步骤时，其他模块中同一步骤位置亮起涟漪 + 计数 | 呼吸 1.6s 循环 |
| 面包屑 | `SAP › SD 销售 › 订单到收款 › 创建销售订单`，每级可点回退 | 高亮迁移 |
| ⌘K | 全局搜索：模块/流程/步骤/对象/T-Code 混合排序 | 面板缩放淡入 |
| 双击空白 | 回到 L0 全局视图 | fly-to + 渐进降 LOD |

### 7.1 "我在哪"的三重保障

1. **MiniMap**：显示当前视口矩形 + 模块色块（一直可见）
2. **Breadcrumb**：文字层级的绝对定位
3. **上下文降噪**：非当前模块统一降饱和，但保留轮廓（不消失，否则失去"系统感"）

---

## 8. 内容治理

- **单一事实源**：`data/` 下每个实体一个文件，`registry.ts` 负责汇总与反向索引。
- **构建期校验**（`scripts/validate-content.ts`）：
  1. id 全局唯一
  2. 所有 `stepIds` / `objectIds` / `snippetIds` 引用必须存在
  3. 每个 `Step` 至少归属 1 个 `Process`
  4. 每个 `DevObject` 至少 1 个 snippet 或 1 个官方文档链接
  5. `tcode` 格式校验（`^[A-Z0-9_]{2,20}$`）
- **版权边界**：SAP Help / api.sap.com 只做**结构化摘要 + 原文深链**，不整段搬运；代码示例优先自写或取自 SAP-samples（遵守其许可）。
- **贡献路径**：新增模块 = 1 个 `modules/x.ts` + N 个 `processes/x/*.ts` + M 个 `steps/x/*.ts` + 若干 `objects/`，不动任何 `src/canvas`。

---

## 9. 分期计划

| 阶段 | 目标 | 验收 |
|---|---|---|
| **M0 骨架**（✅ 已完成） | 目录 + 文档 + 类型定义 | `npm run dev` 能起，内容自检可用 |
| **M1 垂直切片**（✅ 已完成） | SD 三条流程（O2C / 定价 / 信用）+ FI 应收，打通 L0→L3 | 四级缩放、泳道下钻、悬停出对象、抽屉看代码、跨流程互跳 |
| **M2 网状**（✅ 已完成） | 接入 MM（P2P / 库存）与 FI 应付；补 alt 异常分支、幽灵锚点、⌘K 搜索、hash 深链 | 同一 `goods-issue` 在 SD 与 MM 都可见并互跳；任一深链可分享、刷新不丢 |
| **M3 广度** | 补齐 PP / WM / CO 主干；跨模块 end-to-end 流（`data/flows.ts`） | 从 PO 到收款的完整链路可从头走到尾 |
| **M4 发布** | GitHub Pages + OG 图 + 内容校验进 CI | 子路径部署无 404 |

**一条经验**：这个产品最容易死在"想一次画完整个 SAP"。先让一条流程好看、好用、有洞察，再横向复制——M1/M2 就是按这个顺序做的。

---

## 9.1 M2 新增的三件事

**幽灵锚点（Ghost Anchor）**
悬停或选中一个步骤时，把它在其他流程/模块里的落位连出来。落位在视口内的画虚线 + 模块徽标；落在视口外的收进右下角方向标，点一下直接飞过去。它把"内容只有一份、位置有很多处"这件事变成了看得见的东西。

**⌘K 全局搜索**
一次搜索覆盖三类实体：步骤（名称 / 事务码 / 业务意图）、流程（名称 / 目标）、开发对象（技术名 / 标题 / 用途）。事务码命中加权最高——开发者的真实输入往往是 `MIGO`、`MIRO` 这种短码。

**hash 深链**
`#/m/mm` · `#/p/mm.p2p` · `#/s/mm.p2p/mm.p2p.goods-receipt`。
用 hash 而不是 history：GitHub Pages 是静态托管，history 路由刷新子路径会 404。
写入用 `history.replaceState`（不产生历史记录、不触发 hashchange），读取监听 `hashchange`——单向流动，避免来回打架。

> 踩过的坑：一开始用「store → hash」反推，结果首帧 store 还是空的，深链刚打开就被写回 `#/`；StrictMode 双跑 effect 会让它更严重。改成导航动作里直接写 hash 才稳。

---

## 10. 如何运行

```bash
npm install
npm run dev        # 开发：http://localhost:5173
npm run build      # 产物在 dist/
npm run preview    # 本地预览产物
npm run typecheck  # 只做类型检查
```

开发时若内容有引用缺失（步骤指向不存在的对象等），控制台会直接打印清单 —— 见 `src/data/index.ts` 的 `validateContent()`。

---

## 11. 发布注意（暂不启用）

- `vite.config.ts`：`base: './'`（或用仓库名 `/sap-map/`）
- 路由已用 **hash**（`#/p/mm.p2p`），避免 GitHub Pages 深链 404
- 全部数据静态内联，无后端、无 API key
- 部署产物 < 2MB（代码高亮按需加载）
