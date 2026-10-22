# 初次运行记录边界

全局 pnpm wrapper 在 registry 请求失败，未执行测试；global-pnpm-wrapper.log 是工具输出转录而非完整原始字节。之后均使用工程 webEnvironment 的固定 pnpm 10.20.0。

最早 typecheck 因 SettingsBundle.downloadsNextCursor 可为 null 与推断快照 string|undefined 不兼容失败。随后修正为可选 string，复用 preflight-01 的 runner 导致同名 types.log 被覆盖；现存 types.log 保留第二次实际失败（optional 属性与 required 属性不兼容），初次错误仅有工具输出与本摘要，不冒称初次原始日志完整保留。最终改为显式构造 mock cursor 属性，两类问题关闭；后续每次使用独立目录，所有冻结门禁不引用本轮预检为 PASS。
