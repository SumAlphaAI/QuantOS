# F02 新发现许可证的准入决策包

状态：2026-09-17 用户明确批准按本文有条件准入。完整扫描修复后发现此前根目录扫描遗漏的依赖；不自动扩大现有 `security/node-license-allowlist.json` 的允许范围。

建议：按以下精确包版本有条件准入 LGPL 依赖，限定作为 Next 静态构建工具，正式交付包只包含静态 Web 输出，不包含 `node_modules` 或 libvips/native sharp 二进制；保存许可证、版权及上游源码定位。若以后交付 Node 服务或 native 图像处理产物，必须重新评审。其余新出现的宽松许可证按明确的 SPDX 表达式加入策略，并保留 NOTICE。

以下为实际锁文件命中的已批准条目：

| 包 | 版本 | 许可证 |
|---|---|---|
| `@img/sharp-libvips-darwin-arm64` | `1.3.3` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-darwin-x64` | `1.3.3` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-arm` | `1.3.3` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-arm64` | `1.3.3` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-ppc64` | `1.3.3` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-riscv64` | `1.3.3` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-s390x` | `1.3.3` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linux-x64` | `1.3.3` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linuxmusl-arm64` | `1.3.3` | `LGPL-3.0-or-later` |
| `@img/sharp-libvips-linuxmusl-x64` | `1.3.3` | `LGPL-3.0-or-later` |
| `@img/sharp-wasm32` | `0.35.4` | `Apache-2.0 AND LGPL-3.0-or-later AND MIT` |
| `@img/sharp-win32-arm64` | `0.35.4` | `Apache-2.0 AND LGPL-3.0-or-later` |
| `@img/sharp-win32-ia32` | `0.35.4` | `Apache-2.0 AND LGPL-3.0-or-later` |
| `@img/sharp-win32-x64` | `0.35.4` | `Apache-2.0 AND LGPL-3.0-or-later` |
| `caniuse-lite` | `1.0.30001809` | `CC-BY-4.0` |
| `jackspeak` | `3.4.3` | `BlueOak-1.0.0` |
| `minimatch` | `10.2.6` | `BlueOak-1.0.0` |
| `minipass` | `7.1.3` | `BlueOak-1.0.0` |
| `package-json-from-dist` | `1.0.1` | `BlueOak-1.0.0` |
| `path-scurry` | `1.11.1` | `BlueOak-1.0.0` |
| `spdx-license-ids` | `3.0.23` | `CC0-1.0` |
| `tslib` | `2.3.0` | `0BSD` |
| `tslib` | `2.8.1` | `0BSD` |

Python 全组扫描还需要准入 PSF-2.0（typing_extensions）及扫描工具传递依赖的明确许可证；同样记录在最终清单中。`browser-assert@1.2.1` 缺少 manifest license 字段，其已发布 LICENSE 为 MIT；采用 LICENSE 内容哈希证据补足元数据，不作为未知许可证放行。

批准仅涉及本任务列明的依赖治理策略，不包含漏洞豁免、生产部署或远程推送。

## Python 基线补充决定

2026-09-17，用户另行明确批准将 Python 基线升级到 3.12，以修复 pytest 及扫描工具传递依赖在 3.9 上无法升级的问题。当前固定 3.12.10，全部 Engine 约束为 `>=3.12,<3.13`。这项决定独立于许可证准入，不授权漏洞豁免。
