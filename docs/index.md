---
layout: home

hero:
  name: VPanel
  text: Deploy is Easy, Maintenance is the Key
  tagline: 开源、可编程、企业级的服务器运维管理平台。不只是部署工具，更是你的运维搭档。
  image:
    src: /logo.svg
    alt: VPanel
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/
    - theme: alt
      text: 下载安装
      link: /download
    - theme: alt
      text: GitHub
      link: https://github.com/zsoft-vpanel/vpanel

features:
  - icon: 🎯
    title: 运维优先，而非仅部署
    details: 其他工具帮你部署成功，VPanel 帮你持续成功。监控、告警、备份、故障诊断一站式解决
  - icon: 🐳
    title: Docker 容器管理
    details: 完整的 Docker 生命周期管理，支持容器、镜像、网络、卷和 Compose 编排
  - icon: 🌐
    title: Nginx 可视化管理
    details: 站点配置可视化，SSL 证书自动申请续期，反向代理一键配置
  - icon: 🗄️
    title: 多数据库支持
    details: 支持 MySQL、PostgreSQL、Redis、MongoDB 等主流数据库的管理和备份
  - icon: 📊
    title: 实时监控与告警
    details: 服务器性能实时监控，阈值告警，多渠道通知，历史趋势分析
  - icon: 🔒
    title: 企业级安全
    details: RBAC 权限控制、完整审计日志、MFA 认证、防火墙与 Fail2Ban 集成
  - icon: 🔌
    title: 插件生态
    details: 强大的插件系统，官方插件市场，提供完整 SDK 支持自定义扩展
  - icon: 💻
    title: Web 终端 & 文件管理
    details: 浏览器内 SSH 终端，Monaco 在线编辑器，完整文件管理功能
  - icon: ⏰
    title: 计划任务
    details: Cron 任务可视化管理，任务日志和执行历史，失败告警
---

<style>
.vision-section {
  max-width: 900px;
  margin: 80px auto 0;
  padding: 0 24px;
  text-align: center;
}

.vision-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 24px;
}

.vision-quote {
  font-size: 1.5rem;
  font-style: italic;
  color: var(--vp-c-brand-1);
  margin-bottom: 24px;
  padding: 24px;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  border-left: 4px solid var(--vp-c-brand-1);
}

.vision-desc {
  color: var(--vp-c-text-2);
  font-size: 1.1rem;
  line-height: 1.8;
  max-width: 700px;
  margin: 0 auto;
}

.architecture-section {
  max-width: 900px;
  margin: 80px auto 0;
  padding: 0 24px;
}

.architecture-title {
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 32px;
}

.architecture-diagram {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 32px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.4;
  overflow-x: auto;
  border: 1px solid var(--vp-c-divider);
}

.architecture-diagram pre {
  margin: 0;
  white-space: pre;
  color: var(--vp-c-text-1);
}

.comparison-section {
  max-width: 1000px;
  margin: 80px auto 0;
  padding: 0 24px;
}

.comparison-title {
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 32px;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  overflow: hidden;
}

.comparison-table th,
.comparison-table td {
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid var(--vp-c-divider);
}

.comparison-table th {
  background: var(--vp-c-bg-alt);
  font-weight: 600;
}

.comparison-table tr:last-child td {
  border-bottom: none;
}

.comparison-table td:first-child {
  text-align: left;
  font-weight: 500;
}

.stats-section {
  max-width: 1152px;
  margin: 80px auto 0;
  padding: 0 24px;
}

.stats-title {
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 48px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.stat-card {
  text-align: center;
  padding: 32px 24px;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  color: var(--vp-c-text-2);
  margin-top: 8px;
  font-size: 1rem;
}

.cta-section {
  text-align: center;
  padding: 64px 24px;
  background: var(--vp-c-bg-soft);
  margin-top: 80px;
}

.cta-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 16px;
}

.cta-desc {
  color: var(--vp-c-text-2);
  margin-bottom: 32px;
  font-size: 1.1rem;
}

.cta-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
}

.cta-btn.primary {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
}

.cta-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);
}

.cta-btn.secondary {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.cta-btn.secondary:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
</style>

<div class="vision-section">
  <h2 class="vision-title">Our Vision</h2>
  <div class="vision-quote">
    "Deploy is easy, maintenance is the key."
  </div>
  <p class="vision-desc">
    市面上不缺部署工具，Coolify、Dokploy 都能帮你把应用跑起来。但真正的挑战在于：凌晨 3 点服务挂了怎么办？磁盘快满了谁来告警？出了问题如何快速定位？
    <br><br>
    <strong>VPanel 的定位不是又一个部署工具，而是「部署之后」的运维守护者。</strong>
    <br><br>
    我们帮你监控、告警、备份、诊断、恢复——让服务器持续健康运行。
  </p>
</div>

<div class="architecture-section">
  <h2 class="architecture-title">Product Architecture</h2>
  <div class="architecture-diagram">
<pre>
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
</pre>
  </div>
</div>

<div class="comparison-section">
  <h2 class="comparison-title">Why VPanel</h2>
  <table class="comparison-table">
    <tr>
      <th>Feature</th>
      <th>BT Panel</th>
      <th>1Panel</th>
      <th>Coolify</th>
      <th>Dokploy</th>
      <th>VPanel</th>
    </tr>
    <tr>
      <td>Open Source</td>
      <td>❌</td>
      <td>✅</td>
      <td>✅</td>
      <td>✅</td>
      <td>✅</td>
    </tr>
    <tr>
      <td>Tech Stack</td>
      <td>PHP</td>
      <td>Go+Vue</td>
      <td>Node.js</td>
      <td>Node.js</td>
      <td>Go+React</td>
    </tr>
    <tr>
      <td>Focus</td>
      <td>Traditional</td>
      <td>Docker</td>
      <td>PaaS Deploy</td>
      <td>Deploy</td>
      <td>Full Ops</td>
    </tr>
    <tr>
      <td>Plugin System</td>
      <td>💰 Paid</td>
      <td>⚠️ Limited</td>
      <td>❌</td>
      <td>❌</td>
      <td>✅ SDK</td>
    </tr>
    <tr>
      <td>RBAC & Audit</td>
      <td>⚠️ Basic</td>
      <td>⚠️ Basic</td>
      <td>❌</td>
      <td>❌</td>
      <td>✅ Full</td>
    </tr>
    <tr>
      <td>Monitoring & Alert</td>
      <td>✅</td>
      <td>⚠️ Basic</td>
      <td>⚠️ Basic</td>
      <td>❌</td>
      <td>✅ Full</td>
    </tr>
    <tr>
      <td>Auto Backup & Restore</td>
      <td>💰 Paid</td>
      <td>✅</td>
      <td>⚠️ Limited</td>
      <td>❌</td>
      <td>✅</td>
    </tr>
    <tr>
      <td>i18n</td>
      <td>❌ CN Only</td>
      <td>⚠️ Limited</td>
      <td>✅</td>
      <td>✅</td>
      <td>✅</td>
    </tr>
  </table>
</div>

<div class="stats-section">
  <h2 class="stats-title">VPanel in Numbers</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-number">100%</div>
      <div class="stat-label">Open Source</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">5min</div>
      <div class="stat-label">Quick Deploy</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">10+</div>
      <div class="stat-label">Core Features</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">∞</div>
      <div class="stat-label">Plugin Extensions</div>
    </div>
  </div>
</div>

<div class="cta-section">
  <h2 class="cta-title">Ready to Get Started?</h2>
  <p class="cta-desc">One command to install. Forever free.</p>
  <div class="cta-buttons">
    <a href="/download" class="cta-btn primary">
      📦 Download
    </a>
    <a href="/guide/" class="cta-btn secondary">
      📖 Documentation
    </a>
  </div>
</div>
