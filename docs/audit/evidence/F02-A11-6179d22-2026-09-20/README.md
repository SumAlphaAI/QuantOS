# 6179d22 远程证据与候选审阅

源码：`6179d22502bb0b35d42ef1897932b4cc81c8b62e`，main push，2026-09-20 17:17 Asia/Shanghai。

| 下载 artifact | GitHub SHA-256 | 归档与验证 |
|---|---|---|
| [Linux candidates 10602133832](https://github.com/SumAlphaAI/QuantOS/actions/runs/35501909750/artifacts/10602133832) | `f518641d4826d24241b4f12e58c24fd0bd6559042dc88e46ca4b41f94e83daac` | 原 ZIP 哈希一致；receipt 归档，12 张原 PNG 已导入 tests/e2e；候选采集 9 passed，非比较验收 |
| [F01 clean room 10602616971](https://github.com/SumAlphaAI/QuantOS/actions/runs/35501909756/artifacts/10602616971) | `f8f2328186040a55bc8a1d1865679fdeb068f772771585a6082d36c5ffef3562` | 原 ZIP 哈希一致；JSON 的 source/run/status 匹配 |
| [F01 reproducibility 10602284570](https://github.com/SumAlphaAI/QuantOS/actions/runs/35501909756/artifacts/10602284570) | `b35225b9e921c76a0d434c120da2160cb34b6e07d2b849e0c37edfba907a8702` | 原 ZIP 哈希一致；同 SHA，3 次 run，reproducible=true、PASS |

## 图像审阅（代理逐图检查，非用户设计批准）

| 页面 | Chromium | Firefox | WebKit | 观察 |
|---|---|---|---|---|
| Command | 已审阅 | 已审阅 | 已审阅 | 主导航、优先处理、健康表与指标显示正常；900px 视口下方内容仍需滚动 |
| Login | 已审阅 | 已审阅 | 已审阅 | 登录入口、品牌和说明布局完整，无错误页或加载遮罩 |
| Security | 已审阅 | 已审阅 | 已审阅 | MFA、会话、设备和安全操作完整，长页面底部正常 |
| Browser settings | 已审阅 | 已审阅 | 已审阅 | 通知、下载、存储、深链与响应式限制完整，无重叠溢出 |

Firefox 的字体粗细/符号字形与其他引擎不同；通知初始值 Chromium 为 denied，Firefox/WebKit 为 default。各引擎单独存基线，未声称像素跨引擎一致。Browser settings 的 Windows/macOS 文本来自 UA/fixture 显示，不能证明这些目标 OS 已实机验收；WebKit 不等于真实 Safari。页面中的 Mock 提示保留，截图不证明生产 BFF 完成。

导入工具验证 12 个精确路径、图片 SHA/尺寸、capture SHA/run/runner，并确认渲染输入未变化。`check-visual-baselines --platform linux` 通过（共17张含原5张Darwin），门禁负向回归13/13通过、0 skipped，日志见 baseline-gate-tests.log。

`settings-observation.json` 是已登录管理员页面的人工转录，记录保存结果及套餐警告；不是 GitHub API 导出，也不是分支阻断或 Environment 运行时隔离的测试回执。

尚缺：导入后新 SHA 的无跳过比较、主 CI 后续供应链步骤、正式签名下载回执、有效规则及失败阻断/恢复。A11 OPEN。
