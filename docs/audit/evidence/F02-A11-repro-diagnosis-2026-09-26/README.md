# F02-A11 构建诊断证据

诊断结论与边界见 [诊断报告](../../F02-A11-reproducibility-diagnosis-2026-09-26.md)。本目录不替代历史 main 失败证据或未来主线验收。

| 文件 | 用途 |
|---|---|
| original-source-run.json / original-source-six-builds.json | Linux 对原失败 ac73a95 全 SHA 的六次 Web 诊断元数据与逐文件摘要 |
| formal-captured-run.json / formal-captured-receipt.json | 正式 F01 运行及其实际 PR merge SHA 的三次构建回执 |
| captured-chunks-verification.json / stable-ui-chunk.js.txt | 从 artifact 10907360880 读取的三份 UI chunk 重新计算结果；一份相同内容原样存档 |
| minifier-run.json / linux-minifier-result.json | Linux 固定输入 4096 次压缩的运行及结果；测试脚本与输入可从 b9b83497d7e173f0f5b67214c0a38a89bed2279e 恢复 |
| capture-tests.log | 本轮 4 项原始输出留存正反回归 |
| f02-tests.log | 使用现有锁定 Gitleaks 的本轮 15 项 F02 回归 |
| sha256-manifest.json | 除自身以外本目录文件的完整性摘要 |

复核本地测试：

```sh
node --test scripts/capture-build-outputs.test.mjs
GITLEAKS_BIN="$PWD/artifacts/tools/gitleaks" make f02-check
node scripts/check-development-plans.mjs
```

正式 workflow 使用 `--capture-web-outputs`，原文件位于回执旁的 `<receipt>.web-outputs/run-N/`，上传到同一 F01 artifact。留存先于临时工作区清理和三次摘要比较；比较失败不会移除快照。不得用诊断中的 NO_DIFFERENCE_OBSERVED 代替根因修复或 main 验收。
