# 非冻结工具诊断补记

这些是会话工具输出的诊断摘要，不是冻结验收结果：

- 初次全局 `pnpm --filter @sumalpha/terminal typecheck` 进入包装器，最终exit 1：`[ERROR] GET https://registry.npmjs.org/@pnpm%2Fexe: fetch failed`。后续使用工程固定pnpm10.20.0离线缓存，最终runner白名单PATH绑定该版本。
- 早期直接typecheck曾报告 `TS2339: Property productType does not exist on type Order`。随后在正式OpenAPI中增加可选productType并重新生成客户端/schema/policy，冻结候选类型检查通过。
- preflight-01中的unsupported product测试断言未跟随新schema收紧而失败；修正为契约拒绝并保留原失败日志。没有把工具/断言失败改写为通过。
