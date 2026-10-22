# UI-204 预检查记录

这些是未冻结工作区诊断，不作为最终候选通过证据，不改绑后续工程SHA。

- preflight-01/unit.log：63项中61通过、2失败。一项发现共享C04 gateway未显式no-store（已修复产品代码）；另一项缺失items被原schema先行拒绝，状态为200而非测试误写的502，修正测试预期并保留拒绝。
- preflight-01/unit-fixed.log：修复后110项功能及直接回归通过。types/lint/build通过仅属于当时工作区，后续代码变化后重新绑定当前工程候选。
- preflight-01/browser：1通过、4失败；原reference二进制的C01未声明snapshot.read。页面按要求拒绝，未通过代理补加能力。修复C01 current reference身份能力声明，与其既有C04资源授权一致，其他身份不新增能力；生产/live授权不变。
- preflight-01/rust-c04.log：新增Rust测试首次因缺少crate::限定编译失败，已修复。
- preflight-02/rust-c04.log：过滤器research_tests未命中，退出0但执行0项，不计作通过。修正为research::tests后，rust-c04-corrected-filter.log实际23项通过（含3项同名live模块离线授权/缓存/证据映射检查，不代表连接目标数据库）。
- preflight-02/reference-build.log：修复后的reference构建成功。原binary SHA不变记录留在旧证据包；当前工程重新构建，独立保存binary.json。
- preflight-02/browser：读取真实reference成功后，排序/质量select的可访问名称包含其option文本导致精确定位超时；给两个控件添加显式aria-label。实际失败/超时及附件保持原样。同轮另有503提示定位与Next全局route announcer冲突，改为限定当前workspace，产品拒绝提示未改变。该轮3通过/3失败。最终候选重新构建并执行当前6项Chromium，不拼接预检查结果。

复跑范围仅当前功能及其实际变更影响，未递归重验G1或其他上游闭包。全部历史NOT_RUN、Firefox/WebKit阻塞、reference身份/CORS替代边界保持。

- attempt-01：候选a7706db4的Rust23、前端110、types/lint/build通过，Chromium5/6通过后停止，未生成PASS回执。剩余分页用例错误假设固定fixture UUID一定排序最前；reference组合同时产生其他随机UUID快照。preflight-03为该用例的工作区诊断，增加响应snapshotIds与失败页面截图，单次碰巧通过不计作修复证明。明确根因后将测试改为按实际返回ID核对分页，固定failed快照通过服务端snapshotId过滤验证。产品排序不改、不删除其他快照、不提高超时或启用重试；后续工程重新执行当前有界验证。
