# VPanel - Server Operations Management Platform

<div align="center">
  <h1>🚀 VPanel</h1>
  <h3><em>"Deploy is Easy, Maintenance is the Key"</em></h3>
  <p><strong>Open Source · Programmable · Enterprise Ready</strong></p>
  
  <p>
    <a href="https://github.com/zsoft-vpanel/vpanel/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License">
    </a>
    <a href="https://github.com/zsoft-vpanel/vpanel/releases">
      <img src="https://img.shields.io/github/v/release/zsoft-vpanel/vpanel" alt="Release">
    </a>
    <a href="https://github.com/zsoft-vpanel/vpanel/stargazers">
      <img src="https://img.shields.io/github/stars/zsoft-vpanel/vpanel?style=social" alt="GitHub stars">
    </a>
  </p>
</div>

---

## 🎯 Vision

> **"Deploy is easy, maintenance is the key."**

There's no shortage of deployment tools. Coolify, Dokploy, and others can get your app running. But the real challenge lies beyond deployment:

- What happens when your service crashes at 3 AM?
- Who alerts you before the disk fills up?
- How do you quickly diagnose issues when something goes wrong?

**VPanel is not just another deployment tool — it's your operations guardian for everything that comes after.**

We handle monitoring, alerting, backups, diagnostics, and recovery — keeping your servers healthy and running.

---

## 📐 Architecture

```
+------------------------------------------------------------------+
|                            VPanel                                 |
|              "Deploy is Easy, Maintenance is the Key"             |
+------------------------------------------------------------------+
|                                                                   |
|   +----------------+    +----------------+    +----------------+  |
|   |    DEPLOY      | -> |    MONITOR     | -> |    MAINTAIN    |  |
|   +----------------+    +----------------+    +----------------+  |
|   |                |    |                |    |                |  |
|   | * Docker       |    | * Real-time    |    | * Auto Backup  |  |
|   | * Compose      |    |   Metrics      |    | * Quick Restore|  |
|   | * App Store    |    | * Log Center   |    | * Diagnostics  |  |
|   | * Nginx Sites  |    | * Alerts       |    | * Security     |  |
|   | * Databases    |    | * Audit Trail  |    | * Optimization |  |
|   |                |    |                |    |                |  |
|   +----------------+    +----------------+    +----------------+  |
|                                                                   |
|   ==============================================================  |
|        Others stop here         VPanel's Core Battlefield         |
|                                                                   |
+------------------------------------------------------------------+
|                        ENTERPRISE READY                           |
|   +------------+  +------------+  +------------+  +------------+  |
|   |   RBAC     |  |   Audit    |  |   MFA      |  |  Plugins   |  |
|   |  Roles &   |  |   Logs &   |  |  Multi-    |  |  SDK &     |  |
|   |   Teams    |  |  Tracing   |  |  Factor    |  | Marketplace|  |
|   +------------+  +------------+  +------------+  +------------+  |
+------------------------------------------------------------------+
```

---

## 🆚 Why VPanel

| Feature | BT Panel | 1Panel | Coolify | Dokploy | **VPanel** |
|---------|----------|--------|---------|---------|------------|
| Open Source | ❌ | ✅ | ✅ | ✅ | ✅ |
| Tech Stack | PHP | Go+Vue | Node.js | Node.js | **Go+React** |
| Focus | Traditional | Docker | PaaS | Deploy | **Full Ops** |
| Plugin System | 💰 Paid | ⚠️ Limited | ❌ | ❌ | **✅ Full SDK** |
| RBAC & Audit | ⚠️ Basic | ⚠️ Basic | ❌ | ❌ | **✅ Enterprise** |
| Monitoring & Alert | ✅ | ⚠️ | ⚠️ | ❌ | **✅ Full** |
| Backup & Restore | 💰 Paid | ✅ | ⚠️ | ❌ | **✅ Auto** |
| i18n | ❌ CN Only | ⚠️ | ✅ | ✅ | **✅ Native** |

---

## ✨ Core Features

### 🎯 Operations First
- Real-time monitoring dashboard with historical trends
- Multi-channel alerting (Email, Webhook, Slack, etc.)
- Unified log center with search and filtering
- One-click diagnostics and health checks

### 🐳 Docker Management
- Full container lifecycle management
- Docker Compose orchestration
- Image management and building
- Container logs and terminal access

### 🌐 Nginx Management
- Visual site configuration
- Automatic SSL certificate provisioning (Let's Encrypt)
- Reverse proxy with one click
- Real-time access log analysis

### 🗄️ Database Management
- MySQL/MariaDB, PostgreSQL support
- Redis/MongoDB management
- Automated backup and restore
- Performance monitoring

### 🔐 Enterprise Security
- RBAC with roles and teams
- Complete audit trail
- Multi-Factor Authentication (MFA)
- Firewall & Fail2Ban integration
- SSH key management

### 🔌 Plugin Ecosystem
- Dynamic plugin loading/unloading
- Official plugin marketplace
- Full SDK for custom development
- Plugin dependency management

### 💻 Developer Tools
- Web SSH terminal (xterm.js)
- Monaco online code editor
- Full file manager
- Cron job visual management

---

## 🚀 Quick Start

### One-Click Installation

```bash
curl -sSL https://vpanel.zsoft.cc | bash
```

### Development Environment

```bash
# Clone repository
git clone https://github.com/zsoft-vpanel/vpanel.git
cd vpanel

# Start development (backend + frontend)
./dev.sh dev
```

Or manually:

```bash
# Backend
cd panel && go run ./cmd/server

# Frontend (new terminal)
cd web && npm install && npm run dev
```

---

## 📦 Plugin Development

VPanel provides a powerful plugin system for extending functionality.

### Plugin Types
1. **Service Plugins** - Install and manage specific services
2. **Tool Plugins** - Additional management tools
3. **Monitoring Plugins** - Extended monitoring capabilities
4. **Theme Plugins** - UI customization

### Example

```go
package main

import "github.com/vpanel/sdk-go/plugin"

func main() {
    p := plugin.New(&plugin.Config{
        ID:          "my-plugin",
        Name:        "My Plugin",
        Version:     "1.0.0",
        Description: "A custom plugin for VPanel",
    })

    p.RegisterRoute("GET", "/status", handleStatus)
    p.RegisterMenu(&plugin.MenuItem{
        Title: "My Plugin",
        Icon:  "plugin",
        Path:  "/plugins/my-plugin",
    })

    p.Run()
}
```

---

## 🛣️ Roadmap

### Phase 1: Core (Current)
- [x] Docker full lifecycle management
- [x] Nginx visual configuration
- [x] Database management
- [x] File manager & Web terminal
- [x] RBAC & Audit logs
- [ ] App Store MVP
- [ ] Plugin SDK documentation

### Phase 2: Differentiation (3-6 months)
- [ ] AI Operations Assistant
- [ ] Plugin Marketplace
- [ ] GitOps integration
- [ ] Multi-node management

### Phase 3: Enterprise (6-12 months)
- [ ] Multi-cloud management
- [ ] Kubernetes support
- [ ] LDAP/SSO integration
- [ ] Compliance certifications

---

## 📄 License

Apache License 2.0

---

## ⭐ Star History

<div align="center">
  <a href="https://star-history.com/#zsoft-vpanel/vpanel&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=zsoft-vpanel/vpanel&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=zsoft-vpanel/vpanel&type=Date" />
      <img src="https://api.star-history.com/svg?repos=zsoft-vpanel/vpanel&type=Date" alt="Star History Chart" />
    </picture>
  </a>
</div>

---

<div align="center">
  <p><strong>VPanel</strong> — Deploy is just the beginning. We handle what comes after.</p>
  <p>Made with ❤️ by VPanel Team</p>
</div>
