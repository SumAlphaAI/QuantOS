# PREPARATION:P0 整改记录

> 2026-10-02；工程修复已落地，提交后同SHA目标验收待执行；本文件不构成A1放行。

H-01：关键contract统一beforeEach强制实际断言；结构检查拒绝提前return/throw、死分支和未调用helper。七项进程级反证另行留证。

B-01：既有Supabase目标已通过只读preflight；最终源码提交后重跑真实Auth/BFF/Runtime、Execution/Vault与数据库拒绝矩阵。未产生同SHA PASS前不关闭。

M-01：新增P0独立回执校验、16项正负单测、CI政策回归、可携带日志摘要及Git notes规程。最终准入以当前HEAD的`pnpm check:p0`为准。正式G0/provider/页面及Linux/远端CI不在本次目标范围。

原审计与证据保留。当前检查点设为RE_REVIEW；全部验证通过后再登记已接受的源码版本和补充关闭记录。
