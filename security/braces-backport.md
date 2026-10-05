# braces 3.0.3 深度保护补丁

2026-10-05 核对 [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)：受影响版本包含 3.0.3，上游尚无修复版本。保留锁定依赖及原始扫描 finding，使用 pnpm `patchedDependencies` 应用本地维护的 `patches/braces@3.0.3.patch`；不新增版本通配豁免。

解析器在推入 brace/paren 前限制栈深度；compile、expand、stringify 对递归 AST 遍历设置 64 层上限，数组展开/flatten 设置 128 层上限。超限抛出明确的 SyntaxError，正常范围、转义和组合模式仍支持。超过这些深度的模式会被有意拒绝。

`scripts/braces-backport.mjs` 校验补丁摘要、包与锁文件解析选择、实际 consumer 解析到的完整安装源码（10 文件），并实际探测低于既有字符上限的嵌套字符串、直接传入的深层/循环 AST 和兼容模式。`scripts/braces-backport.test.mjs` 另验证补丁、锁选择和安装源码漂移必须失败。

只有完整核验通过，SCA 才给 **这一 advisory / npm / braces / 3.0.3** finding 记录 `backportVerified: true` 和独立 `BACKPORT_VERIFIED` 证明。原 severity、版本、`waived: false` 及上游未修复事实保留。其他版本、其他 advisory、扫描器异常和源码漂移仍失败；F0 消费回执时再次验证实际补丁证明。`make sca-check` 同时运行回归和四生态扫描。

后续出现官方修复版本时，核对其修复与依赖兼容性，升级锁文件、移除本地补丁及专用判定，再重新评估受影响功能。未执行上述更新前不宣称上游已修复。
