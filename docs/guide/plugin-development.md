# VPanel 插件开发指南

本文档介绍如何为 VPanel 开发插件，包括 SDK 使用、API 访问、UI 扩展等内容。

## 概述

VPanel 插件系统允许开发者扩展面板功能，包括：

- 添加自定义菜单和页面
- 监听系统事件（容器启停、站点变更等）
- 访问 Docker、数据库、文件系统等 API
- 存储插件配置和数据
- 发送通知

## 快速开始

### 1. 创建插件目录

```bash
mkdir -p plugins/my-plugin/assets
cd plugins/my-plugin
```

### 2. 创建 manifest.json

```json
{
    "id": "my-plugin",
    "name": "My Plugin",
    "version": "1.0.0",
    "description": "A custom VPanel plugin",
    "author": "Your Name",
    "min_version": "1.0.0",
    "permissions": ["docker.read", "settings.write"],
    "menus": [{
        "title": "My Plugin",
        "icon": "puzzle",
        "path": "/plugins/my-plugin"
    }]
}
```

### 3. 创建 main.go

```go
package main

import (
    "github.com/gin-gonic/gin"
)

type MyPlugin struct {
    ctx *PluginContext
}

// PluginContext 由 VPanel 提供
type PluginContext struct {
    PluginID  string
    DataDir   string
    ConfigDir string
    Logger    Logger
    API       *PluginAPI
}

// Initialize 在插件加载时调用
func (p *MyPlugin) Initialize(ctx *PluginContext) error {
    p.ctx = ctx
    ctx.Logger.Info("My plugin loaded!")
    return nil
}

// Start 在插件启用时调用
func (p *MyPlugin) Start() error {
    return nil
}

// Stop 在插件禁用时调用
func (p *MyPlugin) Stop() error {
    return nil
}

// Shutdown 在插件卸载时调用
func (p *MyPlugin) Shutdown() error {
    return nil
}

// GetInfo 返回插件信息
func (p *MyPlugin) GetInfo() *Info {
    return &Info{
        ID:      "my-plugin",
        Name:    "My Plugin",
        Version: "1.0.0",
        Status:  "running",
    }
}

// GetRoutes 返回自定义 API 路由
func (p *MyPlugin) GetRoutes() []Route {
    return []Route{
        {Method: "GET", Path: "/status", Handler: p.handleStatus},
    }
}

// HandleEvent 处理系统事件
func (p *MyPlugin) HandleEvent(event Event) error {
    return nil
}

func (p *MyPlugin) handleStatus(c *gin.Context) {
    c.JSON(200, gin.H{"status": "ok"})
}

// 导出插件实例
var Plugin MyPlugin
```

### 4. 构建插件

```bash
go build -buildmode=plugin -o my-plugin.so main.go
```

### 5. 安装插件

将以下文件复制到 `data/plugins/my-plugin/` 目录：
- `my-plugin.so` - 编译后的插件
- `manifest.json` - 插件配置
- `assets/` - 静态资源（可选）

## manifest.json 详解

### 基本信息

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | ✓ | 唯一标识符，只能包含小写字母、数字和连字符 |
| name | string | ✓ | 显示名称 |
| version | string | ✓ | 语义化版本号 (例如 1.0.0) |
| description | string | ✓ | 插件描述 |
| author | string | ✓ | 作者名称 |
| homepage | string | | 项目主页 URL |
| license | string | | 许可证类型 |
| icon | string | | 图标名称 |
| category | string | | 分类 |
| tags | string[] | | 标签列表 |

### 权限

`permissions` 数组定义插件所需的权限：

```json
{
    "permissions": [
        "docker.read",      // 读取 Docker 信息
        "docker.write",     // 管理 Docker 容器
        "docker.exec",      // 在容器中执行命令
        "files.read",       // 读取文件
        "files.write",      // 写入文件
        "database.read",    // 读取数据库
        "database.write",   // 管理数据库
        "nginx.read",       // 读取 Nginx 配置
        "nginx.write",      // 管理 Nginx
        "settings.read",    // 读取设置
        "settings.write",   // 修改设置
        "users.read",       // 读取用户信息
        "system.exec",      // 执行系统命令
        "notifications",    // 发送通知
        "http"              // HTTP 请求
    ]
}
```

### 菜单配置

```json
{
    "menus": [{
        "id": "my-menu",
        "title": "My Plugin",
        "icon": "puzzle",
        "path": "/plugins/my-plugin",
        "order": 100,
        "children": [{
            "title": "Sub Page",
            "path": "/plugins/my-plugin/sub"
        }]
    }]
}
```

### 设置定义

```json
{
    "settings": [{
        "key": "api_key",
        "type": "string",
        "label": "API Key",
        "description": "Your API key",
        "required": true
    }, {
        "key": "interval",
        "type": "select",
        "label": "Refresh Interval",
        "default": "30",
        "options": [
            {"value": "10", "label": "10 seconds"},
            {"value": "30", "label": "30 seconds"}
        ]
    }, {
        "key": "enabled",
        "type": "bool",
        "label": "Enable Feature",
        "default": true
    }]
}
```

支持的类型：`string`, `int`, `bool`, `select`, `textarea`, `password`

## API 使用

### 设置 API

```go
// 读取设置
value, err := ctx.API.GetSetting("my_key")

// 保存设置
err := ctx.API.SetSetting("my_key", "my_value")
```

### 文件 API

```go
// 读取文件（相对于插件数据目录）
data, err := ctx.API.ReadFile("config.json")

// 写入文件
err := ctx.API.WriteFile("data.json", []byte(`{"key": "value"}`))
```

### HTTP API

```go
// GET 请求
response, err := ctx.API.HTTPGet("https://api.example.com/data")

// POST 请求
response, err := ctx.API.HTTPPost("https://api.example.com/data", jsonData)
```

### 通知 API

```go
err := ctx.API.SendNotification("标题", "消息内容")
```

### 命令执行

```go
output, err := ctx.API.Execute("ls", "-la", "/tmp")
```

## 事件钩子

插件可以监听以下系统事件：

### 容器事件
- `container.create` - 容器创建
- `container.start` - 容器启动
- `container.stop` - 容器停止
- `container.remove` - 容器删除
- `container.restart` - 容器重启

### Nginx 事件
- `nginx.site.created` - 站点创建
- `nginx.site.updated` - 站点更新
- `nginx.site.deleted` - 站点删除
- `nginx.site.enabled` - 站点启用
- `nginx.site.disabled` - 站点禁用
- `nginx.reload` - Nginx 重载

### 数据库事件
- `database.created` - 数据库创建
- `database.deleted` - 数据库删除
- `backup.completed` - 备份完成
- `backup.failed` - 备份失败

### 用户事件
- `user.login` - 用户登录
- `user.logout` - 用户登出
- `user.created` - 用户创建

### 应用事件
- `app.deployed` - 应用部署
- `app.started` - 应用启动
- `app.stopped` - 应用停止

事件处理示例：

```go
func (p *MyPlugin) HandleEvent(event Event) error {
    switch event.Type {
    case "container.start":
        payload := event.Payload.(map[string]interface{})
        containerID := payload["container_id"].(string)
        p.ctx.Logger.Info("Container started", "id", containerID)
    }
    return nil
}
```

## UI 开发

### 基本结构

在 `assets/index.html` 中创建插件 UI：

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>My Plugin</title>
    <style>
        body {
            background: #0f172a;
            color: #f1f5f9;
            font-family: sans-serif;
            padding: 2rem;
        }
    </style>
</head>
<body>
    <h1>My Plugin</h1>
    <div id="content"></div>
    
    <script>
        // 插件 API 基础路径
        const API_BASE = '/api/plugin/my-plugin/api';
        
        // 调用插件 API
        async function getStatus() {
            const response = await fetch(`${API_BASE}/status`);
            const data = await response.json();
            document.getElementById('content').textContent = JSON.stringify(data);
        }
        
        // 通知父窗口插件已就绪
        window.parent.postMessage({ type: 'plugin:ready', pluginId: 'my-plugin' }, '*');
        
        getStatus();
    </script>
</body>
</html>
```

### 与父窗口通信

```javascript
// 发送消息到父窗口
window.parent.postMessage({
    type: 'plugin:notification',
    payload: { title: 'Hello', message: 'World' }
}, '*');

// 导航请求
window.parent.postMessage({
    type: 'plugin:navigate',
    payload: { path: '/docker/containers' }
}, '*');
```

## 最佳实践

### 错误处理

```go
func (p *MyPlugin) Initialize(ctx *PluginContext) error {
    p.ctx = ctx
    
    // 优雅处理错误
    if value, err := ctx.API.GetSetting("required_key"); err != nil {
        ctx.Logger.Warn("Setting not found, using default")
    } else if value == "" {
        ctx.Logger.Warn("Setting is empty")
    }
    
    return nil
}
```

### 资源清理

```go
func (p *MyPlugin) Shutdown() error {
    // 关闭连接
    if p.conn != nil {
        p.conn.Close()
    }
    
    // 停止后台任务
    close(p.done)
    
    // 等待 goroutine 结束
    p.wg.Wait()
    
    return nil
}
```

### 安全考虑

1. **验证输入**：始终验证用户输入和 API 参数
2. **最小权限**：只申请必需的权限
3. **敏感数据**：不要在日志中记录敏感信息
4. **文件访问**：只访问插件数据目录内的文件

## 调试

### 日志

```go
ctx.Logger.Info("Info message", "key", "value")
ctx.Logger.Warn("Warning message", "error", err)
ctx.Logger.Error("Error message", "error", err)
```

### 开发模式

使用 Makefile 快速开发：

```bash
# 构建并安装
make dev

# 监听文件变化自动重建（需要 entr）
make watch
```

## 发布

1. 确保 `manifest.json` 中的版本号正确
2. 编译插件：`make build`
3. 打包文件：
   - `my-plugin.so`
   - `manifest.json`
   - `assets/`（如果有）
   - `README.md`

## 示例项目

参考 `plugins/example/` 目录中的完整示例。

## 常见问题

### Q: 插件加载失败

检查：
1. `manifest.json` 格式是否正确
2. `.so` 文件是否存在且可执行
3. 插件是否导出了 `Plugin` 变量
4. 日志中的具体错误信息

### Q: API 调用返回权限错误

确保 `manifest.json` 中声明了所需的权限。

### Q: UI 无法加载

1. 检查 `assets/index.html` 是否存在
2. 确认静态文件路由配置正确
3. 检查浏览器控制台错误

## 参考链接

- [VPanel SDK 源码](../../../sdk/go/)
- [示例插件](../../../plugins/example/)
- [API 文档](/api)
