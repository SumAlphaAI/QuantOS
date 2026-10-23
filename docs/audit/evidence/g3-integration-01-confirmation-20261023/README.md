# G3-INTEGRATION-01 限定范围用户确认

确认本会话原文仅接受候选696bef71、原待确认文稿及156f21c5证据包。manifest绑定原395个文件（包括原manifest本身、审阅报告与原提交的窄路径属性），校验源码1928输入和原始测试证据；不重跑业务、不把历史结果改绑为当前HEAD通过。

原包保持不可变，原PENDING字段保留；新用户确认以本目录approval/record记录。当前36条incomplete与全部历史记录、notRun、historicalAdditionalNotRun及currentExecution中的未执行项逐项保留。Research持久队列、增量注册、真实身份/DB、发布等仍NOT_RUN；完整G3/CORE:S04未放行，阶段NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。

限定事项COMPLETED_SCOPED_LOCAL不改变主计划节点的阶段准入。校验：`node scripts/g3-integration-01-confirmed-reference.mjs`；负向测试：`node --test scripts/g3-integration-01-confirmed-reference.test.mjs`。未推送、未部署。
