# GLib 安全回补

`glib/` 为官方 crates.io `glib 0.18.5` 完整源码，保留 MIT LICENSE/COPYRIGHT。

- 官方包 SHA256：`233daaf6e83ae6a12a52055f568f9d7cf4671dabb78ff9560ab6da230ce00ee5`；已与原 Desktop Cargo.lock 校验和核对。
- 漏洞：[RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)。
- 上游修复：[gtk-rs-core PR #1343](https://github.com/gtk-rs/gtk-rs-core/pull/1343)，合并提交 `05dff0ee696f9bcd8617cd48c4b812d046d440cb`。
- 相对官方包唯一修改：`src/variant_iter.rs` 将 out-pointer 声明为 `mut`，并传递 `&mut p`。

Tauri 2 的 Linux GTK 3 依赖要求 glib 0.18，不能用 0.20 直接替代。Desktop Cargo.toml 的 `[patch.crates-io]` 选用此兼容回补；保留真实版本 0.18.5，不伪造版本、不删除 Linux 依赖。

`security/glib-backport.json` 固定完整文件库存和哈希；`scripts/glib-backport.mjs` 同时验证库存、修复及 Desktop manifest/lock 的本地来源。SCA 在扫描 Desktop 前执行此检查，不新增忽略条目或漏洞豁免。`scripts/tests/glib-backport.test.mjs` 用优化后的实际迭代器代码与 C variadic ABI fixture 验证五个受影响方法，并测试源码撤回、锁回退及扫描器失败。此回归不等同于 Linux 原生 GTK/Tauri 验收。

维护时应优先替换为兼容的官方修复版本或上游已迁移的 Tauri 依赖；重新验证来源和源码清单，运行上述测试及完整 SCA，之后再移除回补。
