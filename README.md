# kabi.run — 多用户跑步地图

每个人登录后获得专属页面 `kabi.run/你的用户名`。

## 部署步骤

### 1. 推送到 GitHub
```bash
git init && git add . && git commit -m "init" && git push
```

### 2. Vercel 导入 + 添加环境变量

在 Vercel 项目设置 → Environment Variables 添加：

| 变量名 | 值 |
|--------|-----|
| `STRAVA_CLIENT_ID` | 你的 Strava Client ID |
| `STRAVA_CLIENT_SECRET` | 你的 Strava Client Secret |

### 3. 开启 Vercel KV（免费）

Vercel 项目 → Storage → Create Database → KV
创建后会自动注入 `KV_URL` 等环境变量，无需手动配置。

### 4. 更新 Strava 回调地址

[strava.com/settings/api](https://www.strava.com/settings/api)
→ Authorization Callback Domain: `你的域名.vercel.app`

### 5. 更新 HTML 里的 CLIENT_ID

打开 `public/index.html`，把 `CLIENT_ID = '你的_CLIENT_ID'` 改成真实值。

---

## 文件结构

```
kabi-run/
├── public/
│   └── index.html          # 前端（路线图 + 时间轴 + 热力图 + 统计）
├── api/
│   ├── auth.js             # OAuth 回调，存用户到 KV
│   ├── token.js            # token 刷新
│   ├── activities.js       # 拉取活动数据（带缓存）
│   └── profile.js          # 用户公开信息
├── package.json
└── vercel.json
```

## 功能说明

- `kabi.run/` — 登录页
- `kabi.run/alice` — alice 的专属地图（本人或访客均可访问）
- 5 种模式：路线图 / 📅 时间轴（纯轨迹网格）/ 🔥 热力图 / ⚖ 路线对比 / 📊 统计
- 活动数据缓存 10 分钟（Vercel KV）
