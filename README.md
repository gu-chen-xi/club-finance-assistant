# 社团财务报账助手（Club Finance Assistant）

> 本地桌面端 Windows 软件，把社团报账流程流水线化：活动材料上传 → 自动体检 → 一键生成规范报账包 → 跟踪审核状态 → 归档总账。

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 桌面外壳 | **Tauri 2.x** | Rust 内核 + WebView2，产物轻量（~5MB），免装运行时 |
| 前端框架 | **Vue 3 + Vite** | `<script setup>` 组合式 API |
| 样式 | **TailwindCSS** | 原子类，配合 SPEC §5 色板 CSS 变量 |
| 路由 | **Vue Router**（hash 模式） | 无后端，hash 即可 |
| 图表 | **ECharts**（本地 vendor 拷贝） | P2 引入，不接 CDN |
| 本地数据库 | **SQLite**（`tauri-plugin-sql`） | 单文件 `app.db`，路径在 AppData |
| 文件存储 | 图片/PDF 存本地文件夹，DB 里只存绝对路径 | 大文件不入数据库 |
| 打包 | `npm run tauri build` → 单 exe + MSI | 目标机需 WebView2 Runtime（Win10/11 多数已自带） |

## 目录结构

```
社团财务软件项目/
├── AGENTS.md              # AI 先读：项目需求总纲
├── README.md
├── SPEC.md                # 功能规格/业务规则/数据结构/异常边界
├── UI_TREE.md             # 界面组件树与交互
├── PLAN.md                # 分批开发计划/状态流转/Git 节点
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── index.html
├── src/                   # Vue3 前端
│   ├── main.ts
│   ├── App.vue
│   ├── router/index.ts
│   ├── views/             # Dashboard / Activities / Flow / Ledger / Tracking / Templates / Settings
│   ├── components/         # StepBar / HealthPanel / UploadDropzone / MoneyInput ...
│   ├── api/               # 封装 invoke 调用 Tauri 命令
│   └── styles/
├── src-tauri/             # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── icons/
│   └── src/
│       ├── main.rs / lib.rs
│       ├── db.rs         # SQLite 连接与迁移
│       ├── fs.rs          # 文件复制/重命名/MD5
│       └── commands/      # 暴露给前端的 Tauri commands
└── docs/                  # 内置模板 docx（领取表、非公务卡审批表）
```

## 开发环境要求（开发机装一次）

- Windows 10/11 64 位
- **Node.js 20 LTS**（含 npm）
- **Rust 稳定版工具链**（`rustup` 安装，Tauri 官方要求）
- 一个文本编辑器（VS Code 推荐，装 Volar + Tauri 插件）

> 首次装 Rust 时按 Tauri 官方指引安装 VS Build Tools（C++ 生成工具）。

## 日常开发命令

```powershell
# 安装依赖（首次）
npm install

# 启动开发模式（热更新，自动开窗口）
npm run tauri dev

# 类型检查 / 构建前端
npm run build

# 打包产物（exe + MSI），输出在 src-tauri/target/release/
npm run tauri build
```

## Git 约定

- 纯本地仓库，不 push 远程。
- 每次 commit 前 AI 会先告诉你提交内容摘要和拟用 commit message，等你同意再提交。
- 提交粒度按 PLAN.md 的 Batch。

## 给后续 AI 的提醒

- 业务硬规则一律以 `SPEC.md` 为准，不要自行放松。
- 状态色板以 `SPEC.md` 第 5 节为准。
- 前端新增依赖必须先和用户说，不要随手 `npm install`。
- Rust 端只做：DB、文件系统、路径、对话框；UI 逻辑一律放 Vue 端。
