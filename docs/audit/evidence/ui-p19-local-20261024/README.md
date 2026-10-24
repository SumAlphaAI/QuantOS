# UI-P19 本机高保真页面证据

最终源码 `c7d0cb0b1832a10a287a1f88b5506f963684bff6`，`attempt-04`，工程Gate **PASS_UI_P19_CURRENT_PAGE**；development_status=IMPLEMENTED_PENDING_ACCEPTANCE。`receipt.json`冻结1613项源码输入、60个当前产物，并验证119个UI402历史文件未改变；P19 v4 PNG的hash另行绑定。复核：`node scripts/ui-p19-review.mjs --verify`。

## 最终实际结果

- 70/70单元/consumer/契约：P19新24项、UI402功能36项、真实reference consumer1项（2 venue×7周期×2时区）、原市场恢复6项、C09可选product契约3项。
- 59/59门禁、静态路由、执行策略测试；Terminal typecheck、lint、build及client secret scan通过。
- Chromium P19 11/11 + UI402直接影响7/7；前者覆盖完整页面/十字光标/分页缩放/指标与事件/Quality/安全偏好/同维度恢复/自定义范围/只读离线/标记及复制。
- P19深浅1672/1440/1024/390八组截图、几何与axe；另有1440底部选择栏两图、390图表滚动位置两图、明确rich合成图一张。P19八扫描0 violations、8项color-contrast incomplete，共200次节点出现，不是200个独立缺陷。UI402四扫描另保留4项incomplete。
- INTEGRATION入口预期exit1/STAGE_NOT_READY；下一FE:UI-403开发入口允许；计划159项stage_gate均NOT_ASSESSED。

## 原失败和历史边界

preflight-01：SSR缺React导入/图例不规则空白lint诊断；浏览器3通过、1失败（指标panel与select标签冲突）、6未执行。preflight-02：8通过、1失败（面包屑仅颜色区分）、2未执行，原报告/截图保留。

attempt-01（139937bb）：新增跟进项使用脚本不支持的FUNCTION_OBLIGATION分类，首条development失败，其余11条NOT_RUN；随后按现有INTEGRATION_OBLIGATION分类修正并加入24项执行策略直接回归，不新增分类或放宽已知缺陷门禁。

attempt-02（9942fc5b）：70/18/59及封包原PASS只适用于原源码；人工查看发现rich截图标dark却使用系统light，不可充当dark证据。原receipt/result另存retained-attempt-02-*，原artifact/log不改写。修正显式dark主题、图表最小960px可读区域并增加移动图表滚动截图后，独立attempt-03。

身份为EXPLICIT_REFERENCE_COOKIE_BRIDGE，CORS为LOOPBACK_PROXY_SUBSTITUTION；实际C01/C12/C09 consumer读取本机reference。rich K线/显式spot标记阳性是合成响应，不是真实外部行情或成交。沿用夹具ui401.json文件名，实际网络全为GET，无业务写入。

ST-P19-01–04及ST-P19-05的保存/安全引用/仅标的Trade Ticket入口已做本机验证。ST-P19-05受控C12导出P1未实现：C10没有C12维度/snapshot导出scope，页面禁用；P19-C10-EXPORT-01保留，不以直接下载替代。实际C09→C12同来源阳性NOT_RUN。

UI402旧证据仅ORIGINAL_SCOPE_ONLY；真实IdP/Cookie/CORS、目标DB/托管、外部行情/用途许可、Firefox/WebKit、人工读屏/native200%、跨OS、同SHA远程CI、性能容量长稳、完整I7/G4/FEP-4及RELEASE均NOT_RUN。stageGate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。无生产凭据、push或发布。

最终attempt-04在同一现有自定义范围用例中补齐真实reference空区间（2020年范围，0根Candle、完整缺口、禁止复制空Candle引用）；产品源码与attempt-03相同，仅测试增加该边界。attempt-03原receipt/result另存retained-attempt-03-*，未将原PASS改绑新候选。
