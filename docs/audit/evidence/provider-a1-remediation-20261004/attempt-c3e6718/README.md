# 扩展范围首次执行

源码 c3e6718aa8787b4b29af52705c0c02b473bbddaa；65 项中 62 PASS / 3 FAIL，没有发布 READY。F01 static make 自动载入 .env.local；F05 1 万事件测试遇到 PostgreSQL 连接关闭；RLS 检查将 BFF 显式业务 UUID 误判为缺少默认值。原始结果和产物保持不变。
