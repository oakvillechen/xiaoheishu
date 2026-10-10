# 小黑书数据维护记录 2026-10-10

执行方式：维护接口 `/api/agent/admin/posts/:id`。每一步都先用 dryRun 核对改动前后，再正式执行。时间为多伦多时间（ET）。

## 1. 删除 #848（#847 的重复帖）
- 操作：DELETE `?dryRun=false`
- 改动前：标题《GTA本周新盘：奥克维尔模型屋开放，列治文山镇屋70万起》，0 条评论，内容与 #847 基本相同
- 改动后：`/api/posts/848` 返回 404

## 2. #847 修复被 shell 吞掉的 `$` 金额
- 操作：PATCH content（只改正文）
- 改动前 → 改动后：
  - `20呎镇屋 06,106起` → `$906,106起`
  - `35呎独立屋 ,419,381起` → `$1,419,381起`
  - `41呎独立屋 ,640,619起` → `$1,640,619起`
  - `💰 99,900起` → `$699,900起`
  - `开发费封顶0,000` → `$10,000`
  - 文末加一行价格来源说明
- 来源：
  - https://starlanehomecorp.ca/new-homes/oakville/ivy-rouge/ （20' Townhomes from $906,106 / 35' Singles $1,419,381 / 41' Singles $1,640,619）
  - https://www.sunnycommunities.com/communities/bond （Starting from $699,900）
  - https://www.talkcondo.com/project/bond-by-sunny-communities/ （Development charges capped at $10,000）
- 每个残缺的数字都和官方数字的尾部完全一致，没有任何数字是猜的。
- 其他帖子：扫描了全部 142 篇帖子，没有发现别的 `$` 金额残缺。#771、#824、#880、#819 的 `$` 金额都正常。
- 附注：#847 写的 Bond 售楼处时间是 11:00-18:00，Sunny 官网写的是 12-6 PM，周五仅限预约。这一处没有改。

## 3. 10 篇帖子的图片全部失效，已换成原创配图

- 配图是用 PIL 绘制的扁平插画卡片，1080x1440（3:4），字体 Noto Sans CJK SC Bold。
- 图里没有真人，也没有 logo。
- 图片通过 `/api/agent/upload` 上传到 Cloudinary。原图都已失效（404/403/超时等），所以全部替换。
- 生成文件在 `/workspace/xhs_covers/`。

| 帖子 | 标题 | 原图片 | 新图片 |
|---|---|---|---|
| [#787](https://xiaoheishu.ca/posts/787) | Mac上用ComfyUI跑AI生图，新手避坑指南 | 2 张，全部失效 | https://res.cloudinary.com/dgleangwz/image/upload/v1791671245/xiaoheishu/ec760xc3zpl4oipjbaco.jpg<br>https://res.cloudinary.com/dgleangwz/image/upload/v1791671246/xiaoheishu/mqszmphgvhih6cjcypdf.jpg |
| [#802](https://xiaoheishu.ca/posts/802) | 国庆高速上新能源车充电量暴涨60.4% | 1 张，全部失效 | https://res.cloudinary.com/dgleangwz/image/upload/v1791671247/xiaoheishu/gf3ezbroswgbhm4y2mob.jpg |
| [#803](https://xiaoheishu.ca/posts/803) | 国庆假期出入境日均215万人次，国际机票涨22.5% | 1 张，全部失效 | https://res.cloudinary.com/dgleangwz/image/upload/v1791671248/xiaoheishu/apivplsmgsiodbv5kcrs.jpg |
| [#805](https://xiaoheishu.ca/posts/805) | 多伦多温哥华房市全球垫底，跌得最惨 | 1 张，全部失效 | https://res.cloudinary.com/dgleangwz/image/upload/v1791671248/xiaoheishu/xdaood8aysiklq8ybpvh.jpg<br>https://res.cloudinary.com/dgleangwz/image/upload/v1791671249/xiaoheishu/y6snei8ds3z8aup7ei17.jpg |
| [#831](https://xiaoheishu.ca/posts/831) | ChatGPT写的东西，现在自带隐形水印了 | 1 张，全部失效 | https://res.cloudinary.com/dgleangwz/image/upload/v1791671250/xiaoheishu/crosu0re1hetozgs13f5.jpg |
| [#857](https://xiaoheishu.ca/posts/857) | 蒙特利尔老城半日逛吃，法式街区这样走 | 1 张，全部失效 | https://res.cloudinary.com/dgleangwz/image/upload/v1791671251/xiaoheishu/g7qd8m8wtn7qpfmmowav.jpg<br>https://res.cloudinary.com/dgleangwz/image/upload/v1791671251/xiaoheishu/oby0ldeapjkih85ez5nu.jpg |
| [#862](https://xiaoheishu.ca/posts/862) | Bloor街自行车道要拆，通勤党提前改路线 | 2 张，全部失效 | https://res.cloudinary.com/dgleangwz/image/upload/v1791671252/xiaoheishu/vptl8uysxdju0qeqpzhn.jpg |
| [#869](https://xiaoheishu.ca/posts/869) | 感恩节中西混搭，你家桌上有什么 | 1 张，全部失效 | https://res.cloudinary.com/dgleangwz/image/upload/v1791671253/xiaoheishu/vqx5mnoxzhh4oxpyvn65.jpg |
| [#872](https://xiaoheishu.ca/posts/872) | 9月加拿大少了6.8万个岗位，就业寒冬来了？ | 1 张，全部失效 | https://res.cloudinary.com/dgleangwz/image/upload/v1791671254/xiaoheishu/abokebjnez1yoxl2my0k.jpg<br>https://res.cloudinary.com/dgleangwz/image/upload/v1791671254/xiaoheishu/ppeofstletseiueidone.jpg |
| [#878](https://xiaoheishu.ca/posts/878) | 投票：今年的就业市场，你的体感是哪种 | 1 张，全部失效 | https://res.cloudinary.com/dgleangwz/image/upload/v1791671255/xiaoheishu/tzxdhjn7hx6qmqdts6f6.jpg |

## 4. 追加（约 18:30 ET，用户决定）
- **#847 修改 Bond 售楼处时间**：PATCH content。先 dryRun 核对，只改了正文这一行，再正式执行。
  - 改动前：`📍 售楼处 1080 Elgin Mills Rd E，周一至周四、周末 11:00-18:00`
  - 改动后：`📍 售楼处 1080 Elgin Mills Rd E，周一至周四 12:00-18:00，周五仅限预约，周六日 12:00-18:00`
  - 来源：https://www.sunnycommunities.com/communities/bond ，18:30 前后重新核对过。官网原文：「Monday - Thursday: 12 PM - 6 PM / Friday: By Appointment Only / Saturday & Sunday: 12 PM - 6 PM」
- **删除 #787**《Mac上用ComfyUI跑AI生图，新手避坑指南》：用户不想保留，所以删除。dryRun 显示 0 条评论，之后正式删除，现在访问返回 404。
  - 之前为它上传的 2 张 Cloudinary 图片没有删，留在 Cloudinary 里，帖子已经不用这两张图了：ec760xc3zpl4oipjbaco.jpg、mqszmphgvhih6cjcypdf.jpg
