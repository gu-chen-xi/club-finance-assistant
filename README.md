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
├── README.md              # 项目说明 + 使用注意事项（最终用户看这个）
├── 开发期使用的东西/       # AI 开发期文档：AGENTS.md / SPEC.md / UI_TREE.md / PLAN.md
├── 模板/
│   ├── 内置模板/           # 领取表、验收单、非公务卡审批表（软件自带，只读）
│   └── 自定义模板/         # 用户添加的模板自动复制到这里
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
│       └── commands/      # 暴露给前端的 Tauri commands（DB/文件复制/打开文件）
└── dist/                  # 前端构建产物（npm run build 生成）
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

## 使用注意事项（给最终用户）

### 数据与文件保存位置一览

| 内容 | 默认保存位置 | 说明 |
|---|---|---|
| **数据库（含全部业务数据）** | `C:\Users\asus\AppData\Roaming\com.clubfinance.assistant\app.db` | 活动、发票、凭证、设置等全部数据都在这一个文件里；备份这一个文件 = 备份全部数据 |
| 内置模板（领取表 / 验收单 / 非公务卡审批表） | `D:\project\社团财务软件项目\模板\内置模板\` | 软件自带、只读；模板库页面可直接"打开"或"导出到桌面" |
| 模板"导出到桌面" | `C:\Users\asus\Desktop\`（桌面） | 点"导出到桌面"时把模板复制一份到桌面，方便填写后打印 |
| 自定义模板 | 自动**复制**到 `D:\project\社团财务软件项目\模板\自定义模板\` | 添加模板时软件会把文件复制进这个文件夹，**不会改动内置模板**；删除记录不删原文件 |
| 上传的素材文件（策划书 / 发票 / 凭证 / 领取表 / 验收单 / 审批表等） | **保留在上传时的原位置！软件不会自动创建专门文件夹保存，更不会保存进项目文件夹！** | 除非你自己在项目文件夹里建文件夹并存放素材；否则数据库只存原路径，移动或删除原文件会导致电子包生成时找不到素材 |
| **Step7 生成的电子包** | **无默认地址！每次手动选择输出文件夹** | 生成结果形如 `<社团名>打给<老师><总金额>元/`，所选路径会记录到活动数据中 |
| 打包安装包（`npm run tauri build` 产物） | `D:\project\社团财务软件项目\src-tauri\target\release\` | 仅打包时产生，日常使用不涉及 |

> ⚠️ **重点提醒**：**Step7「生成电子包」没有默认保存地址**，每次都要在弹窗中手动选择一个文件夹作为输出位置，软件不会自动写入任何固定目录。

### 首次使用
1. 打开软件后先去 **设置** 页面填好：社团名称、指导老师姓名、公务卡后四位、学校税号。
2. 初始余额默认为 0，如要手动记录余额可直接在设置里改。

### 报账流程
1. **新建活动**：在"活动报账"页点新建，填活动名和日期。
2. **按 Step1~10 依次填写**：每步有"保存本步"按钮，随时可退出重进，数据不丢。
3. **右侧体检面板**实时显示缺什么/错什么，红项必须解决后再生成电子包。
4. **Step7 生成电子包**：选一个空文件夹，程序自动按学校规则复制重命名文件。
5. **Step8 电子审核**：先交电子版给社管财务部审核，通过后再打印纸质版。
6. **Step9 纸质提交**：纸质版交到 303 办公室社管柜子财务部那一格，勾选确认。
7. **Step10 归档**：确认无误后归档，自动计入总账。

### 绿色版（便携版）使用说明

- **绿色版 = 一个 exe + `模板` 文件夹**（如 U 盘 `project001\社团财务报账助手（绿色版）\`）。
- **务必先整个文件夹复制到电脑本地（桌面 / D 盘等）再双击运行，不要从 U 盘直接运行！**
- 原因：程序从 U 盘运行时，Windows 及安全软件会对 U 盘卷留下"隐形占用"，关闭软件后 **U 盘会一直弹不出来**，只能重启电脑才能解除。
- 绿色版与开发版共用同一个数据库（`C:\Users\asus\AppData\Roaming\com.clubfinance.assistant\app.db`），换电脑运行会在新电脑上**自动重新创建空数据库**（新一届财务首次使用为空白状态，属正常）。
- 如果确实从 U 盘运行过且 U 盘弹不出：①直接拔（快速删除模式，数据安全）；②或重启后再弹；③或设备管理器 → 磁盘驱动器 → 右键 KINGSTON → 禁用设备后拔。

### 常见问题
- **发票只支持 jpg/pdf**，png 请先转成 jpg。
- **金额单位**：界面显示元，数据库存分，自动换算。
- **文件路径**：上传的文件保留在原位置，不要随意移动/删除，否则电子包里会找不到。
- **非公务卡**：不适用就选"不适用"跳过，不影响流程。
- **余额低于 50 元**会闪红提醒，记得拉赞助。
