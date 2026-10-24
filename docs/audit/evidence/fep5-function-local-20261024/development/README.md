# 开发期记录（ORIGINAL_SCOPE_ONLY）

这些记录来自 baseline 681e9c5f 后的未提交工作树，部分 flow 未传 GITHUB_SHA。它们用于复现问题与回归轨迹，不能绑定为最终候选通过。原文件逐字保留，最终结论来自冻结源码新 attempt。

- binding-before：9 例中 8 失败，暴露 correlation、对象类型/引用、初始权限快照等绑定缺口；binding-after 9/9。
- mobile-before：12 例中 3 失败；mobile-after 12/12。binding-mobile-final 13 例中 1 失败是 fixture intent 使用 buy，而契约为 increase；-02 13/13。
- flows-01 5 失败：测试 helper 在 fetch 后克隆已消费 Request；修正为发送前哈希。flows-02 4/5：自审批拒绝探针误用要求额外策略能力的高保真读取；修正探针。flows-03 5/5。
- unit-01 211/212、unit-02 215/216：新响应 correlation 检查影响 strategy_release；其 C08 决策返回操作 correlation，应保留该语义，交易审批仍必须绑定原 correlation。
- unit-03 实际 208 通过、5 失败、3 跳过；approval-compat-03 实际 13 通过、2 跳过，均不得写成 215/216：本机 OpenSSL 3 已被移除，旧 BFF 动态链接启动失败。compat-debug/compat-debug-02 同为启动超时/跳过，非业务结果。直接启动诊断显示缺 libssl.3.dylib；离线 cargo build 重新编译到现有 OpenSSL 4 后 compat-debug-03 两个实际用例通过，日志记录合成审批前后事实，临时调试输出已移除。
- browser-01：33 例 29 通过、4 失败；新用例缺 accountId 查询及异步等待。browser-02：5 例 3 通过、2 失败；断言取错订单摘要区域，状态位于详情标题。修正测试定位，未改变产品事实。
- types-01：helper 子进程 env 缺 Next 类型要求的 NODE_ENV；后续 types-02/03/04 通过。lint-04：新脚本 Buffer 未显式导入，已修正。build-01/02 为开发工作树构建。

并非所有早期 shell 输出都保存为独立日志；没有日志的不补造。环境与测试 harness 错误不归为业务 PASS，所有失败保持原记录。后续新 attempt 会重新绑定源码、重建 BFF 与 Terminal，并验证全部当前直接范围。

后续冻结候选轨迹：

- attempt-01 / 2ab09e8f：全部 18 项命令退出码符合预期，包括 216 条 unit/consumer、48 条原生测试与 33 条 Chromium；最终验证器因错误查找 ui-p10.json（实际 p10.json）而失败。verification-failure.json 保留，此轮没有生成成功 receipt；修正及文件名回归测试在 c9c4741d。
- attempt-02 / c9c4741d：完整直接矩阵与验证器通过，原 receipt/result 逐字节保存在根目录 attempt-02-receipt-original.json / attempt-02-result-original.json，适用范围仅该源码。随后人工检查发现小屏 unknown 视图用 canRecover=false 误推断为已过期。65432655 仅修正提示条件，并增加该状态浏览器断言与手机截图；不能把此旧 PASS 绑定为新源码通过。
- attempt-03：针对修正后的冻结源码重新执行同一直接矩阵；最终结果见根 receipt/result。未扩大为全仓或依赖递归复验。
- gate-tests-05 的 97/98 是普通沙箱拒绝回环 listen EPERM；冻结矩阵在获准本机环境运行，全部通过，不改写原失败。
