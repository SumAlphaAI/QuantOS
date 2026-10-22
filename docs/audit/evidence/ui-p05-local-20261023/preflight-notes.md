# UI-P05 预检查保留

这些是未冻结工作区诊断，浏览器来源标记PREFLIGHT_WORKTREE_NOT_CANDIDATE，不改绑后续工程候选。

- preflight-01：74项直接单测、类型检查通过；lint与build因导航映射中未使用的占位变量失败。删除占位变量，保留原始失败，不停用规则。
- preflight-02：修正后lint/build通过；P05新增6个浏览器用例通过并采集初始6张视觉PNG。合并UI-204回归时首用例失败，共11通过/1失败：两份spec共享模块级hooks，跨文件加载导致第二文件首个用例未正确启动reference；失败时无fixture附件，保留Playwright report/error-context。P05独立fixture复用原UI-204实现模式，原UI-204 spec/fixture字节不改；不把后续worker重启通过拼为整轮通过。
- 该轮实际截图显示右侧flex子项被压缩、操作区挤压许可卡片。修正子项flex-shrink与元数据行密度，使卡片按正常流排列，保持面板独立滚动；preflight-02的原始actual图保留。
- preflight-03：新布局与独立fixture下13/13 Chromium通过（新增下载发布前撤权与恢复不重放）；6张视觉基线仅在冻结前按实际页面重新采集。六次axe零violations，但每次两条incomplete（aria-prohibited-attr与非文本图标color-contrast）。定位统计div缺少role，补充group语义；最终候选要求该已知aria问题消失，其余incomplete原值保留，人工读屏/原生200%缩放仍NOT_RUN。
- 冻结候选前增加未遮罩桌面与小屏详情截图用于人工查看；原始基线只mask真实变化的时间文本，不改reference响应。最终检查不使用--update-snapshots。

复用UI-204原范围中的245项Rust输入与原reference二进制，未重跑Rust/G1上游闭包。所有历史失败、中断、Firefox/WebKit阻塞和NOT_RUN保持原SHA与范围。本轮仅当前功能/展示直接测试与受影响回归。
