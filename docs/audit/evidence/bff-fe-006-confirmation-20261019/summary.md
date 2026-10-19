# BFF-FE-006 2026-10-19 原稿用户确认

用户在本会话明确确认原完整稿；原话见 user-confirmation.json。只绑定源码 aad08dd50347d696409db84f86b080c26296a9c3、原稿/技术回执提交 2404a7df44c6fe08c92a8f0f5d589457a4ad9a84 和原输入摘要，不改变已确认稿、原 manifest 或前置回执。新验证器及17项确认负向通过，gate.json=CONFIRMED；currentHeadAcceptance=NOT_CLAIMED、formalAccepted=false、runtimeAdmission=DENIED，完整联调/发布仍NOT_RUN。

第一次测试进程退出1（verification-initial-failed.log），不计PASS；大Buffer直接assert对比耗时异常，改用SHA256内容等值校验后重跑17/17通过。原失败日志保留；未把失败称为已确认的OOM或功能通过。
