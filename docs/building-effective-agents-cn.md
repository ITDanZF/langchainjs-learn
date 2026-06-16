# 构建有效的 AI Agent

> 原文：Anthropic Engineering, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), 2024-12-19  
> 本文档是中文译解版：完整覆盖原文结构、观点、案例和图示信息，但不是逐字全文翻译。

## 0. 核心结论

Anthropic 的经验是：真正成功的 LLM Agent 系统，通常不是靠复杂框架或庞大抽象堆出来的，而是由简单、可组合、可调试的模式构建出来的。

文章反复强调一条工程原则：

**先从最简单的提示词或单次 LLM 调用开始；只有当评估结果证明需要更多复杂度时，再引入工作流或 Agent。**

Agentic 系统的复杂度通常会带来更高延迟、更高成本和更多错误传播风险。复杂度只有在明确改善任务结果时才值得加入。

## 1. 什么是 Agent？

“Agent”这个词在不同团队中含义不同：

- 有些人把 Agent 定义为可以长时间独立运行、调用多种工具并完成复杂任务的自主系统。
- 有些人则把较固定、按预设流程执行的 LLM 应用也称为 Agent。

Anthropic 在文中把这些统称为 **agentic systems**，但进一步区分为两类：

| 类型 | 中文解释 | 控制方式 |
| --- | --- | --- |
| Workflows | 工作流 | LLM 和工具沿着预先写好的代码路径运行 |
| Agents | 自主 Agent | LLM 动态决定流程、工具使用方式和下一步行动 |

简单说：

- **Workflow** 更像“开发者写好的流程，LLM 在流程里完成每一步”。
- **Agent** 更像“LLM 根据环境反馈自己决定下一步怎么做”。

## 2. 什么时候使用 Agent，什么时候不要用？

构建 LLM 应用时，Anthropic 建议优先寻找最简单可行方案。很多应用根本不需要 Agent。

### 2.1 不一定要用 Agent 的场景

如果任务可以通过以下方式解决，通常先不要上 Agent：

- 单次 LLM 调用。
- 更好的提示词。
- 检索增强生成（RAG）。
- 上下文示例。
- 明确的结构化输出。

### 2.2 适合 Workflow 的场景

当任务定义清楚、步骤稳定、结果需要一致性时，工作流更合适。

例如：

- 固定的审核流程。
- 固定的文档生成流程。
- 固定分类后的客服处理流程。

### 2.3 适合 Agent 的场景

当任务开放、步骤数无法预先确定、需要模型自主判断和使用工具时，Agent 更有价值。

例如：

- 复杂代码修改。
- 多轮搜索和综合分析。
- 需要根据执行结果不断调整计划的任务。

## 3. 框架该怎么用？

文章提到一些能帮助构建 agentic 系统的框架或工具，例如：

- [Claude Agent SDK](https://platform.claude.com/)
- [Strands Agents SDK by AWS](https://strandsagents.com/)
- [Rivet](https://rivet.ironcladapp.com/)
- [Vellum](https://www.vellum.ai/)

这些框架能简化底层工作，例如：

- 调用 LLM。
- 定义工具。
- 解析工具调用。
- 串联多个调用。
- 搭建复杂工作流。

但框架也有代价：

- 增加抽象层。
- 遮蔽底层 prompt 和响应。
- 调试更困难。
- 容易诱导开发者过早引入复杂度。

Anthropic 的建议是：**一开始尽量直接使用 LLM API。** 很多模式只需要少量代码就能实现。即使用框架，也要理解它底层到底做了什么。

## 4. 构建块、工作流与 Agent

文章从最基础的构建块开始，逐步介绍更复杂的模式：

1. 增强型 LLM。
2. Prompt chaining。
3. Routing。
4. Parallelization。
5. Orchestrator-workers。
6. Evaluator-optimizer。
7. Autonomous agents。

这些模式不是互斥的，也不是必须全部使用。它们更像一组可组合的工程积木。

## 5. 基础构建块：增强型 LLM

增强型 LLM 是 agentic 系统的基础。它不是裸模型，而是带有额外能力的模型调用。

常见增强能力包括：

- **Retrieval**：检索外部知识。
- **Tools**：调用外部工具或 API。
- **Memory**：保留与使用记忆。

现代模型可以主动使用这些能力，例如：

- 自己生成搜索查询。
- 自己选择合适工具。
- 判断哪些信息需要保留。

实现这类增强能力时，文章建议重点关注两点：

1. 根据具体业务场景定制增强能力。
2. 为 LLM 提供清晰、易用、文档充分的接口。

Anthropic 也提到可以通过 [Model Context Protocol](https://modelcontextprotocol.io/) 集成第三方工具生态。

### 图 1：The augmented LLM

原图链接：[The augmented LLM](https://www.anthropic.com/_next/image?q=75&url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2Fd3083d3f40bb2b6f477901cc9a240738d3dd1371-2401x1000.png&w=3840)

中文图解：

```text
输入
  ↓
增强型 LLM
  ├─ 检索 Retrieval
  ├─ 工具 Tools
  └─ 记忆 Memory
  ↓
输出
```

这张图表达的意思是：LLM 调用本身是核心，但它被检索、工具和记忆扩展后，才成为后续工作流与 Agent 的基础单元。

## 6. Workflow：Prompt Chaining

Prompt chaining 指把任务拆成一串连续步骤，每次 LLM 调用处理上一步的输出。

中间步骤可以加入程序化检查，也就是图中的 **gate**。如果检查通过，流程继续；如果失败，流程退出或转入修正逻辑。

### 6.1 什么时候适合用？

适合任务可以清晰拆成固定子任务的场景。

它的核心取舍是：

- 牺牲一些延迟。
- 换取更高准确性。
- 让每次 LLM 调用只处理更简单的问题。

### 6.2 例子

- 先生成营销文案，再翻译成另一种语言。
- 先写文档大纲，检查大纲是否达标，再根据大纲写完整文档。

### 图 2：The prompt chaining workflow

原图链接：[The prompt chaining workflow](https://www.anthropic.com/_next/image?q=75&url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2F7418719e3dab222dccb379b8879e1dc08ad34c78-2401x1000.png&w=3840)

中文图解：

```text
输入
  ↓
LLM 调用 1
  ↓ 输出 1
Gate 检查
  ├─ 通过 → LLM 调用 2 → 输出 2 → LLM 调用 3 → 输出
  └─ 失败 → 退出
```

图片强调：链式流程不是盲目串联，关键节点可以加入检查，避免错误继续向后传播。

## 7. Workflow：Routing

Routing 指先对输入进行分类，然后把它导向不同的下游任务、提示词、模型或工具。

这个模式的价值是分离关注点。不同类型的输入可以用不同的专门处理逻辑，而不是让一个通用 prompt 同时兼顾所有情况。

### 7.1 什么时候适合用？

适合输入存在明显类别，而且分类可以被可靠完成的场景。

分类器可以是：

- LLM。
- 传统分类模型。
- 规则算法。

### 7.2 例子

- 客服请求分流：普通问题、退款请求、技术支持分别进入不同流程。
- 模型路由：简单常见问题交给小模型，困难或少见问题交给更强模型，以平衡成本和效果。

### 图 3：The routing workflow

原图链接：[The routing workflow](https://www.anthropic.com/_next/image?q=75&url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2F5c0c0e9fe4def0b584c04d37849941da55e5e71c-2401x1000.png&w=3840)

中文图解：

```text
输入
  ↓
LLM 路由器
  ├─ 路径 A → LLM 调用 1
  ├─ 路径 B → LLM 调用 2
  └─ 路径 C → LLM 调用 3
  ↓
输出
```

图中虚线表示不同输入可能走不同路径，不是所有分支都会执行。

## 8. Workflow：Parallelization

Parallelization 指让多个 LLM 调用并行工作，然后用程序化方式聚合结果。

文章把并行化分成两种主要形式：

| 形式 | 中文解释 |
| --- | --- |
| Sectioning | 把任务拆成可独立并行处理的部分 |
| Voting | 对同一任务运行多次，得到多样化结果，再投票或聚合 |

### 8.1 什么时候适合用？

适合两类情况：

- 子任务彼此独立，可以并行加速。
- 需要多个视角、多次尝试或更高置信度。

对于复杂任务，LLM 通常在“每次调用只关注一个方面”时表现更好。

### 8.2 例子

Sectioning：

- 一个模型处理用户请求，另一个模型专门检查安全或违规内容。
- 自动评测中，每个 LLM 调用负责评估一个维度。

Voting：

- 多个不同 prompt 审查代码漏洞，只要某些审查发现问题就标记风险。
- 多个提示词从不同角度判断内容是否不合适，并设置不同投票阈值来平衡误报和漏报。

### 图 4：The parallelization workflow

原图链接：[The parallelization workflow](https://www.anthropic.com/_next/image?q=75&url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2F406bb032ca007fd1624f261af717d70e6ca86286-2401x1000.png&w=3840)

中文图解：

```text
输入
  ├─ LLM 调用 1
  ├─ LLM 调用 2
  └─ LLM 调用 3
       ↓
    聚合器 Aggregator
       ↓
      输出
```

这张图强调：多个 LLM 调用同时运行，最终由聚合器合并、筛选或投票。

## 9. Workflow：Orchestrator-workers

Orchestrator-workers 指由一个中心 LLM 负责动态拆解任务，并把子任务分配给多个 worker LLM，最后再综合它们的结果。

它和并行化看起来相似，但关键区别是：

- Parallelization 的子任务通常是预先定义好的。
- Orchestrator-workers 的子任务由 orchestrator 根据输入动态决定。

### 9.1 什么时候适合用？

适合复杂任务，而且无法提前预测需要哪些子任务的场景。

### 9.2 例子

- 编程产品：每次任务可能涉及不同数量的文件、不同类型的修改。
- 搜索任务：需要从多个来源收集、筛选和分析信息。

### 图 5：The orchestrator-workers workflow

原图链接：[The orchestrator-workers workflow](https://www.anthropic.com/_next/image?q=75&url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2F8985fc683fae4780fb34eab1365ab78c7e51bc8e-2401x1000.png&w=3840)

中文图解：

```text
输入
  ↓
编排器 Orchestrator
  ├─ Worker LLM 1
  ├─ Worker LLM 2
  └─ Worker LLM 3
       ↓
综合器 Synthesizer
       ↓
输出
```

图片中的虚线表示 worker 的数量和任务内容可能由编排器动态决定。

## 10. Workflow：Evaluator-optimizer

Evaluator-optimizer 指一个 LLM 生成答案，另一个 LLM 负责评估和反馈，两者形成迭代循环。

这个模式类似人类写作：先写一版，再评审，再修改，直到达到要求。

### 10.1 什么时候适合用？

适合满足两个条件的任务：

1. 有明确评估标准。
2. 迭代改进能带来可衡量收益。

判断是否适合的两个信号：

- 人类给出反馈后，模型答案确实能明显变好。
- LLM 自己也能提供这种有价值的反馈。

### 10.2 例子

- 文学翻译：初版翻译可能漏掉细微语气，评估模型可以提出修改意见。
- 复杂搜索：需要多轮搜索和分析，评估模型决定是否还需要继续查找。

### 图 6：The evaluator-optimizer workflow

原图链接：[The evaluator-optimizer workflow](https://www.anthropic.com/_next/image?q=75&url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2F14f51e6406ccb29e695da48b17017e899a6119c7-2401x1000.png&w=3840)

中文图解：

```text
输入
  ↓
生成器 LLM
  ↓ 方案
评估器 LLM
  ├─ 接受 → 输出
  └─ 拒绝 + 反馈 → 回到生成器继续优化
```

图中核心是“反馈闭环”：生成器不是一次性产出，而是在评估器反馈下反复改进。

## 11. Autonomous Agents

随着 LLM 在复杂输入理解、推理规划、可靠工具使用和错误恢复方面变强，Agent 开始进入生产环境。

典型 Agent 工作方式：

1. 人类通过命令或对话提出任务。
2. Agent 澄清目标，直到任务足够明确。
3. Agent 制定计划并独立执行。
4. 执行中不断从环境获得真实反馈。
5. 必要时在检查点或遇到阻塞时询问人类。
6. 达成目标或触发停止条件后结束。

这里的“真实反馈”很重要，例如：

- 工具调用结果。
- 代码执行结果。
- 测试结果。
- 文件系统状态。
- 搜索结果。

Agent 的实现未必复杂。很多 Agent 本质上就是：

```text
LLM + 工具 + 环境反馈循环
```

但要做得可靠，工具集和工具文档必须设计得非常清楚。

### 11.1 什么时候适合用 Agent？

适合开放式任务：

- 很难预测需要多少步骤。
- 无法硬编码固定路径。
- LLM 可能需要多轮行动。
- 系统环境可信，允许一定自主性。

### 11.2 风险

自主性越强，风险越高：

- 成本更高。
- 延迟更高。
- 错误可能累积。
- 可能陷入循环。
- 需要更充分的测试和防护栏。

Anthropic 建议在沙箱环境中充分测试，并设置合适的 guardrails。

### 11.3 例子

文章提到两个 Anthropic 自身实现中的例子：

- 用 coding agent 解决 [SWE-bench](https://www.swebench.com/) 任务。
- Claude 的 [computer use reference implementation](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo)，让模型使用电脑完成任务。

### 图 7：Autonomous agent

原图链接：[Autonomous agent](https://www.anthropic.com/_next/image?q=75&url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2F58d9f10c985c4eb5d53798dea315f7bb5ab6249e-2401x1000.png&w=3840)

中文图解：

```text
人类输入目标
  ↓
LLM 规划下一步
  ↓
执行行动 / 调用工具
  ↓
环境返回观察结果
  ↓
LLM 根据反馈继续规划
  ↓
循环直到完成、阻塞或达到停止条件
```

这张图表达的是自主 Agent 的基本闭环：模型不是按固定链条运行，而是根据环境反馈持续决定下一步行动。

### 图 8：High-level flow of a coding agent

原图链接：[High-level flow of a coding agent](https://www.anthropic.com/_next/image?q=75&url=https%3A%2F%2Fwww-cdn.anthropic.com%2Fimages%2F4zrzovbb%2Fwebsite%2F4b9a1f4eb63d5962a6e1746ac26bbc857cf3474f-2400x1666.png&w=3840)

中文图解：

```text
Human → Interface → LLM → Environment

1. Human 向 Interface 提交 Query。
2. 在任务明确前：
   - LLM 可以 Clarify，即澄清问题。
   - Human 可以 Refine，即补充或修正需求。
3. Interface 向 LLM 发送上下文。
4. LLM 在环境中搜索文件。
5. Environment 返回路径。
6. 在测试通过前：
   - LLM 写代码。
   - Environment 返回状态。
   - LLM 运行测试。
   - Environment 返回结果。
7. LLM 完成任务。
8. Interface 向 Human 展示结果。
```

这张图非常适合理解 coding agent：关键不是“一次生成代码”，而是围绕文件搜索、代码修改、测试结果不断循环。

## 12. 组合与定制这些模式

文章强调，这些构建块不是规定动作，而是常见模式。

开发者可以：

- 单独使用某个模式。
- 多个模式组合。
- 根据业务场景做变体。
- 随着评估结果逐步增加复杂度。

关键仍然是：**测量效果，并基于结果迭代。**

只有当复杂模式能明确提升结果时，才应该加入复杂度。

## 13. 总结

在 LLM 应用中，成功不等于构建最复杂的系统，而是构建最适合需求的系统。

推荐路径：

1. 从简单 prompt 开始。
2. 用完整评估体系优化它。
3. 当简单方案不够时，再加入多步骤 agentic 系统。

Anthropic 给出三个实现 Agent 的核心原则：

1. **保持设计简单。**
2. **优先保证透明性，显式展示 Agent 的规划步骤。**
3. **认真设计 Agent-Computer Interface（ACI），尤其是工具文档和测试。**

框架可以帮助快速开始，但走向生产时，不要害怕减少抽象层，用基础组件构建更透明、更可维护的系统。

## 14. 附录 1：Agent 的实践场景

文章指出，AI Agent 在两个领域尤其有价值：客户支持和编程。

这两个领域的共同点是：

- 既需要对话，也需要行动。
- 有清晰成功标准。
- 可以形成反馈循环。
- 可以引入有意义的人类监督。

### 14.1 客户支持

客户支持很适合开放式 Agent，因为它结合了聊天界面和工具操作。

原因包括：

- 支持流程天然是对话式的。
- 需要访问外部信息和执行动作。
- 工具可以拉取客户数据、订单历史、知识库文章。
- 退款、更新工单等动作可以程序化执行。
- 成功结果可以通过用户定义的“已解决”来衡量。

一些公司采用按成功解决计费的模式，这也说明它们对 Agent 解决问题的效果有信心。

### 14.2 Coding agents

软件开发是 LLM agent 很有潜力的领域。能力发展路径已经从代码补全走向自主解决问题。

Coding agent 特别适合的原因：

- 代码方案可以通过自动化测试验证。
- Agent 可以根据测试结果迭代。
- 问题空间相对结构化。
- 输出质量可以被客观衡量。

Anthropic 提到，其实现已经可以只根据 PR 描述来解决 SWE-bench Verified 中的真实 GitHub issue。

但自动化测试只能验证功能层面，人类 review 仍然重要，因为人需要判断方案是否符合更大的系统需求。

## 15. 附录 2：为工具做 Prompt Engineering

无论构建哪种 agentic 系统，工具都很重要。工具让 Claude 能通过 API 与外部服务交互。

工具定义和工具规格本身，也需要像 prompt 一样被认真设计。

### 15.1 工具格式会影响模型表现

同一个动作可以有多种表达方式，例如：

- 编辑文件可以写 diff，也可以重写整个文件。
- 结构化输出可以放在 Markdown 代码块，也可以放在 JSON 字符串里。

从软件工程角度看，这些格式可能可以无损互转；但对 LLM 来说，有些格式明显更难写。

例如：

- 写 diff 时，模型要提前知道 chunk header 中的行数。
- 在 JSON 里写代码时，模型要额外转义换行和引号。

这些格式负担会增加错误概率。

### 15.2 工具格式设计建议

Anthropic 给出几条建议：

- 给模型足够 token 先思考，避免一开始就被格式困住。
- 尽量使用模型在互联网文本中常见的自然格式。
- 避免不必要的格式开销，例如精确计算大量行号，或对代码做复杂字符串转义。

### 15.3 ACI：Agent-Computer Interface

文章提出一个很好的类比：

人类软件花了大量精力设计 HCI（Human-Computer Interface），Agent 系统也应该投入同样精力设计 ACI（Agent-Computer Interface）。

也就是：工具不是只要“机器能调用”就行，还要让模型容易理解、容易正确使用。

### 15.4 设计好工具的几个问题

设计工具时可以问：

- 如果站在模型角度，仅看描述和参数，能否明显知道怎么用？
- 是否需要示例？
- 是否说明了边界情况？
- 是否说明了输入格式要求？
- 是否和其他工具边界清晰？
- 参数名称是否足够直观？
- 多个相似工具之间是否容易混淆？

一个好工具定义应该像给初级工程师写的优秀 docstring：清楚、具体、有边界、有例子。

### 15.5 测试工具使用

建议用大量示例输入测试模型如何调用工具，观察它犯什么错误，然后迭代工具定义。

### 15.6 防呆设计

文章引用了 Poka-yoke，也就是防错设计。工具参数应该设计得不容易误用。

Anthropic 在构建 SWE-bench agent 时发现，他们花在优化工具上的时间甚至多于优化整体 prompt。

一个具体经验是：模型在使用相对路径工具时容易出错，尤其当 agent 已经离开项目根目录后。后来他们把工具改成必须使用绝对路径，模型使用效果明显更稳定。

这个例子对 coding agent 很有启发：

```text
不要只问“模型聪不聪明”，也要问“工具有没有让正确行为变得更容易”。
```

## 16. 面向工程落地的速查表

| 需求特征 | 推荐模式 |
| --- | --- |
| 单次回答即可解决 | 普通 prompt / RAG |
| 任务能拆成固定步骤 | Prompt chaining |
| 输入类别清晰 | Routing |
| 子任务可独立处理 | Parallelization / Sectioning |
| 需要多个判断提高置信度 | Parallelization / Voting |
| 子任务无法预先确定 | Orchestrator-workers |
| 有明确标准且可迭代优化 | Evaluator-optimizer |
| 开放式、多步骤、需要工具反馈 | Autonomous agent |

## 17. 对当前 coding agent / TUI 项目的启发

如果把这篇文章映射到 coding agent 产品设计，可以得到几个直接启发：

1. 默认不要追求“全自主”，先把单步工具、文件搜索、补丁编辑、测试反馈做可靠。
2. 工具定义比总 prompt 更关键，尤其是文件路径、编辑格式、错误信息和权限边界。
3. 应该显式展示计划和执行状态，让用户知道 agent 正在做什么。
4. 编程任务天然适合 evaluator-optimizer：生成补丁、运行测试、根据失败结果修正。
5. 对复杂代码任务可以使用 orchestrator-workers：先让一个模型拆解涉及的文件和子任务，再分别处理。
6. 必须有停止条件，例如最大迭代次数、测试连续失败次数、需要用户确认的高风险操作。

## 18. 图片清单

| 序号 | 原文图名 | 中文说明 |
| --- | --- | --- |
| 1 | The augmented LLM | LLM 结合检索、工具、记忆，成为 agentic 系统基础 |
| 2 | The prompt chaining workflow | 多个 LLM 调用串联，中间用 gate 检查 |
| 3 | The routing workflow | 先分类输入，再路由到不同 LLM 调用 |
| 4 | The parallelization workflow | 多个 LLM 并行处理，聚合器合并结果 |
| 5 | The orchestrator-workers workflow | 编排器动态拆任务，worker 执行，综合器汇总 |
| 6 | The evaluator-optimizer workflow | 生成器与评估器形成反馈循环 |
| 7 | Autonomous agent | LLM 根据环境反馈循环规划和行动 |
| 8 | High-level flow of a coding agent | 人、界面、LLM、环境之间围绕代码和测试循环协作 |

