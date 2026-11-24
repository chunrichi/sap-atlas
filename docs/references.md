# 调研与参考来源

调研时间：2026-11。目的是给 `sap-map` 定信息架构、找内容源、避开已有坑。

---

## 一、同类 / 可参考项目

### 1. 实例数据图类（画"某一单发生了什么"）

| 项目 | 形态 | 能借鉴什么 | 不能照搬什么 |
|---|---|---|---|
| [SAP Order-to-Cash: Knowledge Graph AI Agent](https://githubhelp.com/vivekshahi918/sap-o2c-knowledge-graph) | Neo4j + `react-force-graph-2d` + LLM 问答 | ① O2C 单据链的颜色编码（Order 蓝 → Delivery 橙 → Invoice 绿）② 节点元数据检视面板 | 力导向布局会漂移；我们只需要"稳定的知识结构"，不需要物理感 |
| [O2C Graph Explorer](https://github.com/jancysen/graph-model-project/) | React + FastAPI + SQLite，图在查询时构建 | ① "关系存储 + 图投影"的分层思路 ② 节点类型 ↔ 主键表的映射表写法 | 依赖后端；本项目必须纯静态 |
| [SAP O2C Context Graph + Conversational Query](https://github.com/samyak-1010/Graph_Assistant/blob/main/README.md) | Cytoscape.js，点击展开、右键扩展一跳邻居 | ① 节点 Inspector + 关系浏览的交互范式 ② "按需展开子图"的性能策略 | Cytoscape 的自定义节点表达力不足以做信息卡片 |
| [Interactive SAP Explorer (arXiv 2212.06514)](https://arxiv.org/html/2212.06514) | 把 SAP 关系结构编码为 labeled property graph 放 Neo4j，支持流程识别与表选择 | **学术级论证**：SAP 的复杂度可以靠"图 + 分层展开"被人类理解；文档类型 → 表 → 流程的推导路径 | 它面向 process mining 抽数，不是面向人阅读 |

**共性结论**：现有开源项目都停在"数据溯源"层面，没有解决"模块 → 流程 → 步骤 → 开发对象"这种**知识层级**的表达。
这正是本项目的空白位。

### 2. 信息架构参考（不开放，但模型直接可用）

| 来源 | 层级模型 | 对本项目的价值 |
|---|---|---|
| **SAP Signavio Process Explorer**（One Process Acceleration Layer） | 参考业务流程 → 流程变体 → 活动 → 系统步骤 | 直接印证"模块→流程→步骤"三层是业界标准切法；它的"process hierarchy + IT 系统映射"是我们 L2→L3 的范本 |
| **SAP Activate / Best Practices Scope Items** | Scope Item → Process Step → 配置对象 / RICEFW | 步骤级节点应该挂"配置对象 + 开发对象"，类别划分照它来 |
| **ASAP BPML（Business Process Master List）** | Scenario → Process → Step → T-Code / RICEFW / 测试脚本 | BPML 的列结构几乎就是我们的 `Step` schema：Process ID、Process Name、T-Code、Integration Points、Status |
| **APQC PCF**（Process Classification Framework） | Category → Process Group → Process → Activity，带编号 | 开源、可引用的流程编号骨架，适合做 `process.id` 的外部对齐 |

### 3. 交互范式参考

| 参考 | 借鉴点 |
|---|---|
| **Obsidian Canvas / Heptabase** | 无限画布 + 卡片节点的阅读手感；"空间记忆"比菜单树更接近人的心智 |
| **Kumu** | 关系图的"视图切换 + 聚焦路径高亮"，是本项目跨模块追溯的交互原型 |
| **Figma 的缩放** | 语义缩放的分界感：远看轮廓、近看细节，而不是等比放大 |
| **React Flow 官方示例**（Custom Node / Drag Handle / Minimap） | 技术实现直接可抄的骨架 |

---

## 二、内容来源（可引用的知识）

| 来源 | 内容 | 使用方式 | 注意 |
|---|---|---|---|
| **SAP Business Accelerator Hub**（原 api.sap.com） | OData / SOAP / BAPI / CDS / BAdI / Business Event 的权威目录与规格 | 每个 `DevObject` 存一条官方深链；沙箱可试调 | 不可整表抓取；按对象手写摘要 + 链接 |
| **SAP Help Portal**（help.sap.com） | 流程、配置、T-Code 说明 | 同上，深链引用 | 版权，禁止正文搬运 |
| **SAP Fiori Apps Reference Library** | Fiori App ↔ 后端事务 ↔ 业务角色 | 填充 `Step.fioriApp` 与 `role` 字段 | 版本差异大，标注版本 |
| **SAP-samples/abap-cheat-sheets** | 官方 ABAP 示例（含 BAdI 实现完整步骤） | 代码风格与写法的参照；可复用片段需查许可 | 仓库为 SAP 官方 samples，遵守其 LICENSE |
| **SAP Community Blogs** | 具体 BAdI / User Exit 的实战用法 | 作为 `pitfalls` 与 `note` 的来源，标注出处 | 质量参差，需交叉验证 |
| **SAP Tables 参考**（TSTC / VBAK / VBAP / EKKO / BKPF…） | 表结构、字段 | 直接写入 `docType` 与对象说明 | 表名与字段跨版本稳定，风险低 |

### 2.1 内容深度的建议

不要试图做"全 SAP 百科"。建议每个对象只回答三问：

1. 它在流程的哪一步被调用？（→ 挂到 `Step`）
2. 它解决什么问题、什么时候不该用？（→ `purpose` + `pitfalls`）
3. 最小可运行示例长什么样？（→ `Snippet`，20 行以内）

超过三问的内容交给官方文档深链。

---

## 三、技术调研结论

### 3.1 画布库对比

| 库 | 渲染 | 自定义节点 | 规模适配 | 结论 |
|---|---|---|---|---|
| **React Flow 12** | DOM/SVG | ★★★★★（就是 React 组件） | 数百~2k | **选它**。悬停卡片、富文本、动效零阻力 |
| Cytoscape.js | Canvas | ★★（受限图形拼装） | 1k~50k | 图算法强，但做不了信息卡片 |
| AntV G6 | Canvas/WebGL | ★★★★（需注册节点） | 1k~50k | 性能好、API 重、富文本节点成本高 |
| D3 force | SVG/Canvas | ★★★★★ | <1k | 布局不确定，与"空间记忆"冲突 |
| Sigma.js | WebGL | ★★ | 10k+ | 面向超大图，过度设计 |

**判断依据**：本项目节点是"要读的信息卡片"，不是"要看的点"，DOM 是对的载体；且总量可控（单模块展开 < 400 节点）。

### 3.2 大规模图的通用优化手段（即使当前用不上，也写进架构）

来源：多篇 G6 / 知识图谱性能实践总结

1. **LOD 分级渲染**：缩小隐藏标签与细节，放大再显示 → 已写入 `canvas/lod/`
2. **视口裁剪**：只渲染视口内元素
3. **边聚合**：密集边合并
4. **增量更新**：不要每次 `render(newData)` 全量重绘（会闪、会重算布局）
5. **布局卸载到 Worker**：ELK 计算放 `Web Worker`，避免阻塞主线程

### 3.3 GitHub Pages 相关

- hash 路由避免深链 404
- `base` 必须配置为仓库子路径
- 全部数据静态内联 → 无后端、无密钥、无 CORS 问题

---

## 四、一句话总结

> 市面上的 SAP 图项目都在画**数据流**（单据怎么走的），
> 而顾问和开发真正需要的是**知识流**（模块怎么分工、流程怎么咬合、代码挂在哪一步）。
> `sap-map` 的差异化就在这里：用一张稳定布局的语义缩放画布，把"流程方向"和"开发对象落点"同时表达出来。
