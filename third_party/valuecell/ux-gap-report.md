# TP10 ValueCell UX gap report 与模式清单

结论 **reference_only**。固定 `9793e9c0563fbf56fc096757d8bb80e209ac7aab`；未声称当前 main HEAD。仅静态阅读公开文档/许可证/描述文件，在内存中计算摘要，不保留上游字节，不执行上游。来源见 [provenance](./provenance.json)，机器可验映射见 [patterns](./patterns.json)。

## 来源分级与纠正

README确认研究摘要、多Agent及多市场描述，并列出通知/历史路线图；不能据此证明四工作区、双栏布局、证据下钻、委员会、回测UI、桌面通知已经交付。旧报告的这些推定撤回；12项现为3项文档启发、2项路线图启发、7项QuantOS扩展，全部以QuantOS设计为准。未启动App、未做上游浏览器或易用性实测。

## 可复用交互清单

| ID | 模式 | 依据等级 | Terminal design spec | 归属 |
|---|---|---|---|---|
| VC-01 | 按对象域导航 | QUANTOS_EXTENSION | [P01–P23 / App Shell](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-01) | U01 |
| VC-02 | 研究输入与产物双区 | DOCUMENTED | [P03 / P04](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-02) | U01 |
| VC-03 | 结论到证据下钻 | QUANTOS_EXTENSION | [P04 / P05 / P12](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-03) | U01 |
| VC-04 | 历史时间线 | ROADMAP | [P04 / P12](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-04) | U01 |
| VC-05 | 标的筛选到详情 | DOCUMENTED | [P03 / P18 / P19](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-05) | U01 |
| VC-06 | 实验参数与结果对比 | QUANTOS_EXTENSION | [P06 / P07](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-06) | S02 |
| VC-07 | 多观点对比 | QUANTOS_EXTENSION | [P09 / P10](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-07) | X06 |
| VC-08 | 统一状态语言 | QUANTOS_EXTENSION | [§3.2 / P04 / P05 / P09](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-08) | U01 |
| VC-09 | 详情分区与原始字段 | QUANTOS_EXTENSION | [P04 / P09 / P11 / P12](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-09) | U01 |
| VC-10 | 空态与下一步 | QUANTOS_EXTENSION | [§3.2 / P03 / P06](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-10) | U01 |
| VC-11 | 通知与降级 | ROADMAP | [P15 / P16 / P17 / P23](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-11) | X06 |
| VC-12 | 隐私与数据驻留展示 | DOCUMENTED | [P14 / P15 / P16](../../docs/SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-12) | U01 |

12项均为 REIMPLEMENT_PATTERN_ONLY；UI实现状态全部 NOT_ASSESSED。逐项约束与可判定验证已写入设计规格§9，非仅页面名称。

## UX gap report

| Gap | 归属 | 处理与边界 |
|---|---|---|
| G01 证据动线 | U01 | 已有P04/P12需补充导航顺序及返回栈，不再声称完全未定义。 |
| G02 委员会并列观点 | X06 | P09/P10补充观点证据和分歧表现，实际UI待验。 |
| G03 过期/失效视觉 | U01 | §3.2已有状态规范，补充snapshot/engine/proposal组合边界。 |
| G04 危险操作确认 | X06 | §3.2/§6.1已有确认流程；服务端最终校验及MFA适用性保持。 |
| G05 小屏与离线降级 | U01 | §6.3已有要求；小屏隐藏高风险动作，离线禁写；实现待跨端验收。 |

5项均 DESIGNED_PENDING_IMPLEMENTATION；危险确认、状态及小屏规范早已存在，不再标为完全缺失；补充设计不代表实现闭合。

## 禁止耦合清单

- NC-01：源码、样式、图标、资源和签名发布配置均不得复制。
- NC-02：不得复用账户、权限、数据模型或表结构。
- NC-03：不得引入agent运行时、MCP/A2A或其他依赖。
- NC-04：不得借用自动交易UI/API或订单权限。
- NC-05：不得接入上游数据adapter或借用第三方widget/API许可。
- NC-06：不得引入production/runtime/lock/submodule引用。
- NC-07：不得复制本地隐私承诺或将通知作为业务授权。

## 许可证与风险

Apache-2.0仅涉及原作者软件；TradingView widget、交易所API、市场数据与视觉资产的权利不随之转授。无上游软件交付，因此不生成已解析依赖SBOM/CVE通过结论；完整图/当前advisory扫描NOT RUN、runtimeAdmission=DENIED。所有差异及历史勘误见 [ADR](../../docs/adr/20260731-tp10-valuecell-evaluation.md)。
