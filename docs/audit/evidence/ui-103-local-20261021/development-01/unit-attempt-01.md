首轮实际命令：pnpm exec vitest run packages/ui/tests packages/domain-ui/tests/indicators.test.tsx
exit 1；6文件，28 passed、2 failed。未保存完整原始stdout，本文件只保存已观察失败摘要，不替代原始日志。
1. indicators.test.tsx:34：Expected Stale; Received aria-label="stale"。英文使用原始枚举值。
2. ui103-interactions.test.tsx:52：Found multiple elements with role alert。不可逆操作警告和提交失败均为alert，断言应针对实际重试告警。
