# ADR：Next.js 15.5.27 安全补丁

日期：2026-10-08。状态：采用。

当前 R02 开发准入复评的 F02 SCA 在已锁定 Next.js 15.5.24 检出 GHSA-4jqv-mc3x-m676 与 GHSA-mcj8-r9mp-w47p，两项 moderate 缓存污染公告。按[上游 15.5.27 发布说明](https://github.com/vercel/next.js/releases/tag/v15.5.27)，将 terminal、website 的 next 与根 ESLint plugin 同步锁定 15.5.27，保留 React、Next 主版本与现有 braces 已验证 backport。未新增漏洞豁免。

首轮扫描原始输出和失败保留于 R02 本轮证据 attempt-01；安装后由全套 lint/test/build、三次可复现构建和供应链扫描重新验证。临时目录 patch audit 只证明未再检出两项 Next 公告，不作为整个供应链或实际部署验收通过；braces 原告警须继续由项目 patch 校验实证处理。

本次为开发依赖修补，不产生已部署服务、发布性能、远程同 SHA CI 或正式 ACCEPTED 结论。当前 App Router/static export 不能代替版本安全修补。
