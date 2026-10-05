# G0 最终源码上游复验快照

源码 `22254ddaba32946e33c6be0c63f277229a0331b9` 干净提交后实际运行全部 65 项检查，65/65 PASS、14 节点内容绑定 READY。三轮独立构建、覆盖率/关键分支/语义 mutation、Rust/HTTP/Web/Chromium、Supabase F06/1万事件/Storage/RLS 结果均保存；没有本机数据库环境。

[执行与日志摘要](./execution-results.json)、[聚合回执](./provider-a1.json)、[独立构建产物](./f01-reproducibility.json)、[F06 目标原始执行](./f06-target.json)。

此快照替代前两轮作为当前功能内容准入依据；历史文件不覆盖。formalAccepted=false，不声称正式 hosted CI、staging、发布签署或所有 future provider 已验收。
