# 咫尺域 - 代码复现指南（最终版）

本指南面向想要复现"咫尺域"项目效果的开发者，从零开始搭建环境，到最终运行演示的完整流程。适合用于课程演示或项目复现。

## 环境准备

### 1. 安装 Visual Studio Code
1. 访问 [Visual Studio Code 官网](https://code.visualstudio.com/)
2. 下载并安装适合你操作系统的版本
3. 安装完成后，打开 VS Code

### 2. 安装 Node.js
1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 LTS 版本（推荐 16+）
3. 安装完成后，在终端运行 `node -v` 和 `npm -v` 确认安装成功

### 3. 安装 Rust
1. 访问 [Rust 官网](https://rustup.rs/)
2. 运行安装脚本（Windows 用户可使用 `rustup-init.exe`）
3. 安装完成后，在终端运行 `rustc --version` 和 `cargo --version` 确认安装

### 4. 安装 Tauri CLI
1. 在终端运行：`npm install -g @tauri-apps/cli`
2. 确认安装：`tauri --version`

### 5. 安装 VS Code 扩展（可选但推荐）
- **Tauri**：提供 Tauri 项目支持
- **Rust**：Rust 语言支持
- **Prettier**：代码格式化

## 项目获取

### 方式一：克隆仓库（如果项目已上传到 Git）
```bash
git clone <repository-url>
cd disguise-tool
```

### 方式二：直接使用项目文件
1. 将项目文件夹复制到本地
2. 在 VS Code 中打开项目文件夹：`File > Open Folder`

## 依赖安装

### 1. 安装前端依赖
```bash
npm install
```
此命令会安装所有 Node.js 依赖，包括 Vite、Tauri API 等。

### 2. 验证安装
运行以下命令确认环境完整：
```bash
npm run tauri info
```
这会显示 Tauri 相关的环境信息。

## 开发运行

### 1. 启动开发模式
```bash
npm run tauri dev
```
- 此命令会编译 Rust 后端并启动前端开发服务器
- 启动后会自动弹出桌面应用窗口
- 终端会显示本地访问地址，例如：`http://localhost:5173/`

你也可以在浏览器中直接访问该地址进行调试。

### 2. 打包桌面应用
1. 确保已经安装好所有依赖：
   ```bash
   npm install
   ```
2. 运行 Tauri 打包命令：
   ```bash
   npm run tauri build -- --no-bundle
   ```
3. 等待构建完成。构建过程会编译前端资源和 Rust 后端，生成独立可执行文件。
4. 打包完成后，找到输出结果：
   - **Windows**：`src-tauri/target/release/bundle/msi/` 下的 `.msi` 安装包
   - **macOS**：`src-tauri/target/release/bundle/macos/` 下的 `.app`
   - **Linux**：`src-tauri/target/release/bundle/` 下的 `.AppImage`、`.deb` 或其他格式
5. 运行生成的桌面程序即可使用，不需要再运行 `npm run tauri dev`。

### 3. 打包常见问题
- **构建失败**：确认 Rust、Node.js、Tauri CLI 均已正确安装
- **依赖缺失**：如果提示缺少系统依赖，按提示安装相应库
- **路径问题**：在 Windows 上，请确保项目路径中没有特殊字符或中文字符

## 功能演示流程

### 1. 应用启动
- 应用窗口打开后，显示登录界面
- 支持用户注册和登录功能

### 2. 用户注册/登录
1. 点击"注册"标签
2. 输入用户名和密码（如：用户名 `test`，密码 `123456`）
3. 注册成功后自动登录并进入主界面

### 3. 查看计时器
- 右上角显示本次会话的实时计时（格式：HH:MM:SS）
- 底部显示"今日摸鱼时间"，累计所有历史摸鱼时长（单位：分钟）

### 4. 开启人脸监控
1. 点击"开启人脸监控"按钮
2. 允许摄像头权限访问
3. 摄像头画面将在2秒延迟后开始检测（避免初始化误触发）
4. 状态显示"监控中..."

### 5. 人脸检测测试

**单人测试**：
- 让一个人出现在摄像头前
- 界面显示"检测到人脸！"
- 不会触发页面跳转

**多人测试**：
- 让第二个人出现在画面中
- 界面显示"检测到多人脸！"
- 自动在当前窗口跳转到伪装页面（CNKI 知网）

**灵敏度说明**：
- 支持 FaceDetector API 时：检测到 ≥2 张人脸触发
- Fallback 模式时：连续3次检测到亮度>70或运动>12%触发
- 启动后有2秒延迟，避免初始化误判

### 6. 快捷键测试
- 按 `Ctrl+Shift+F`（Windows/Linux）或 `Cmd+Shift+F`（Mac）
- 无论监控是否开启，都会立即触发伪装页面跳转

### 7. 伪装页面返回
- 跳转到知网后，按 `Alt+←`（或鼠标侧键后退）返回应用
- 应用会自动恢复登录状态
- 顶部计时器从00:00:00重新计时
- 今日摸鱼时间保留累计值，不会丢失

### 8. 统计数据查看
- "人脸检测次数"显示检测到人脸的累计次数
- "今日摸鱼时间"显示数据库中的累计分钟数

### 9. 停止监控
- 点击"停止监控"按钮
- 摄像头关闭，状态变为"已停止"
- 摸鱼计时继续在后台运行

## 代码结构说明

### 前端文件

| 文件 | 说明 |
|------|------|
| `index.html` | 主页面结构，包含登录和主界面 |
| `main.js` | 核心逻辑（人脸检测、计时器、UI控制、数据持久化） |
| `styles.css` | 样式文件 |
| `vite.config.js` | Vite 配置 |

### 后端文件

| 文件 | 说明 |
|------|------|
| `src-tauri/src/main.rs` | Rust 主程序，定义数据库操作命令 |
| `src-tauri/Cargo.toml` | Rust 依赖配置 |
| `src-tauri/tauri.conf.json` | Tauri 应用配置 |
| `src-tauri/capabilities/default.json` | Tauri v2 权限配置 |

### 关键代码点
- **人脸检测**：`startFaceDetection()` 函数，支持 FaceDetector API 和 Canvas fallback
- **会话恢复**：`DOMContentLoaded` 事件中从 localStorage 恢复登录状态
- **摸鱼计时**：`startFishTimeTracking()` 每分钟调用 Rust 后端更新数据库
- **数据存储**：通过 Tauri commands（`get_fish_time`、`update_fish_time`）

## 演示要点

1. **环境搭建**：展示从零开始的安装过程（约10分钟）
2. **功能完整性**：登录 → 监控 → 检测 → 跳转 → 返回 → 统计（约5分钟）
3. **技术亮点**：
   - 前后端分离架构（Tauri v2 + Vite）
   - 实时人脸检测（双模式 fallback）
   - 跨平台桌面应用
   - 本地 SQLite 数据存储
   - 会话状态跨页面持久化
4. **扩展性**：可自定义伪装页面 URL、人脸检测阈值

## 故障排除

### 摄像头无法访问
- 检查系统隐私设置，允许应用访问摄像头
- 确保没有其他应用占用摄像头
- 重启应用后重新授权

### 人脸检测不工作
- 检查浏览器是否支持 FaceDetector API（Chrome/Edge 支持）
- 在 Fallback 模式下，确保光照充足
- 查看开发者工具控制台（F12）的输出日志

### 编译失败
- 确保 Rust 版本 >= 1.77
- 确保 Tauri CLI 版本为 v2.x
- 清理缓存：`cargo clean` 后重新构建

### 快捷键无效
- 确保应用窗口处于前台并获得焦点
- 检查系统是否已占用该快捷键组合
- Windows 上尝试以管理员身份运行

### 返回后数据丢失
- 检查 localStorage 是否被清除
- 确保没有在隐私模式下运行
- 查看控制台是否有数据库错误

## 总结

通过本指南，你可以完整复现"咫尺域"项目的所有功能。从环境搭建到功能演示，全程约30-60分钟。项目展示了 Tauri v2 现代桌面应用开发的技术栈，适合作为课程项目或个人作品展示。