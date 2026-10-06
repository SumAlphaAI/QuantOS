# F02 Sharp 安全补丁版本登记（2026-10-07）

本记录是项目用户本轮“根据检查报告整改建议，依次修复所有问题并生成 Git 提交”指令下的工程维护登记。原[许可证决定](./20260917-f02-license-intake.md)及其历史用户答复保持原件；本记录不伪造新的用户签署，也不扩大业务用途或正式交付范围。

复评扫描命中 Sharp 0.35.4 的高危 GHSA-wq5f-xc86-pv6w。按[维护者补丁公告](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)固定 0.35.5 及其 libvips 1.3.4 平台包。官方 npm 元数据逐项与新锁文件 integrity 核对，14 个受条件限制包的 SPDX 表达式及 static-web-build-only 用途与原批准一致；[精确映射](../../security/sharp-license-patch-20261007.json)记录版本、来源和完整性。

## 精确版本更新

| 包 | 版本更新 | 未变化的 SPDX 表达式 |
|---|---|---|
| `@img/sharp-libvips-darwin-arm64` | `1.3.3` → `1.3.4` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-darwin-x64` | `1.3.3` → `1.3.4` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-arm` | `1.3.3` → `1.3.4` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-arm64` | `1.3.3` → `1.3.4` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-ppc64` | `1.3.3` → `1.3.4` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-riscv64` | `1.3.3` → `1.3.4` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-s390x` | `1.3.3` → `1.3.4` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-x64` | `1.3.3` → `1.3.4` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linuxmusl-arm64` | `1.3.3` → `1.3.4` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linuxmusl-x64` | `1.3.3` → `1.3.4` | `LGPL-3.0-or-later` |
| `@img/sharp-wasm32` | `0.35.4` → `0.35.5` | `Apache-2.0 AND LGPL-3.0-or-later AND MIT` |
| `@img/sharp-win32-arm64` | `0.35.4` → `0.35.5` | `Apache-2.0 AND LGPL-3.0-or-later` |
| `@img/sharp-win32-ia32` | `0.35.4` → `0.35.5` | `Apache-2.0 AND LGPL-3.0-or-later` |
| `@img/sharp-win32-x64` | `0.35.4` → `0.35.5` | `Apache-2.0 AND LGPL-3.0-or-later` |

## 继续适用的限制

仅作为 Next 静态 Web 构建工具。交付物仅含静态 Web 输出，不包含 node_modules、native sharp/libvips 或 WASM 构建二进制。保留包内 LICENSE/THIRD-PARTY-NOTICES 和上游源码位置；NOTICE 同步到当前实际版本。交付 Node 图像服务、native 图像处理程序或构建二进制须按原决定另行评审。本次没有添加一般许可证允许类型、漏洞豁免或生产/发布权限。

四生态 SCA、许可证全量检查及实际原生版本/可信 SVG→PNG 解码均另留工程回执。精确版本清单替换旧静态构建版本映射，不把旧源码上的通过记录冒充新锁文件上的执行。该登记及 NOTICE、元数据映射纳入 CORE:F02 功能输入摘要。
