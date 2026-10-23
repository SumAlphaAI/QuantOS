# G3-INTEGRATION-01 证据包

入口：`scope.json` / `receipt.json` / `verification.json` / `confirmation-draft.md`。最终执行 attempt-02；源码候选696bef71，代码实现b2259639，原G3确认95e43e6f。

- `attempt-02/`：1928源码输入、17条原始命令与退出、实际worker与44浏览器证据、211个产物。
- `network-verification.json`：44条网络回执、24个独立host真实执行480对worker；覆盖口径是20个选中策略旅程和一个momentum模板，不将启动工作量当作算法覆盖。
- `attempt-01/`：旧G3测试筛选错误，1失败/43未运行；业务worker24通过不冒充该尝试整体通过，后续命令NOT_RUN保留。
- `exploration/` 与 `exploration-summary.json`：未冻结源码的编译/测试失败和成功，仅排障参考。
- `changed-files.json`：本任务跨确认/实现/工具/证据的文件清单。
- `manifest.json`：原始证据、审阅报告及窄文件属性的sha256；自身除外。

原G3/CORE:S04确认只绑定9a463495/05c427f2，529原文件保持不变。历史incomplete和全部NOT_RUN不回填。本轮新稿待确认，完整G3未放行，159项阶段门禁仍NOT_ASSESSED，runtimeAdmission=DENIED。

封存校验：`node docs/audit/evidence/g3-integration-01-20261023/verify-seal.mjs --committed`。首次空白检查保留原始失败上下文的空白诊断；仅为该文件添加窄路径属性，不改写原始字节。
