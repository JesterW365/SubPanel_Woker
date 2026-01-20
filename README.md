# SubPanel Worker

一个基于 Cloudflare Workers 的轻量级 Clash 订阅与节点管理面板，代码由AI生成。

- 如果觉得不好，可以关注SubStore
- 需要一个域名(如果与workers.dev连通性不好时)
- 最多添加5个订阅链接
- 最多添加5个个人节点
- 最多添加5个模板

最终订阅链接将以provider形式，节点将以proxies形式放置到指定模板中。

具有一个默认模板，为作者另一个项目的[默认模板](https://raw.githubusercontent.com/JesterW365/Clash_Rulesets_Template/master/Custom_templates/default_template.yaml "JesterW365/Clash_Rulesets_Template")

默认模板无法在worker中修改，如果需要更改可以到SUBPANEL_KV中修改template0的值。

使用自定义模板时，确保模板中缺少且仅缺少'proxies'和'proxy-groups'字段，否则无法生成正确的配置文件。

## 🌟 核心特性

- **订阅管理**：支持添加多个远程订阅链接，面板自动进行连通性检测。
- **节点管理**：支持手动录入单体节点（JSON 或 YAML 格式），并自动转换为单行JSON格式。
- **模板系统**：支持本地文本模板与远程 URL 模板。自动识别 URL 并抓取，具备策略组和规则的 YAML 格式校验(不检查内容和格式)。
- **配置合并**：自由勾选多个订阅与节点，选择模板，一键合并生成最终的 Clash 配置文件。
- **管理员登录**：内置 Web 登录验证（默认密码 `admin`），确保只有授权用户能操作面板，如果需要修改密码，需要到SUBPANEL_KV中修改ADMIN_PASSWORD的值。
- **链接加密**：生成的订阅链接包含随机加密后缀，支持手动重置 Token，防止订阅地址泄露后被恶意抓取。
- **安全保障**：所有 API 均经过密码校验；编辑订阅时自动隐藏原始链接，防止敏感信息泄漏。

## 🚀 快速开始

### 1. 部署环境

- 在 Cloudflare 中创建一个新的 Worker。
- 创建一个 KV 命名空间，并将其绑定到 Worker，变量名为 `SUBPANEL_KV` (重要)。

### 2. 部署代码

- 将 `main.js` 的内容复制到 Worker 编辑器并保存发布。
- subpanel.域名 为主界面，subpanel.域名/config 为最终生成的订阅地址。
- 设置subpanel域名的路由。

### 3. 开始使用

- 访问 subpanel.'你的域名' 即可打开管理面板。
- **第一步**：在登录框输入管理员密码（默认为 `admin`）登录进入。
- **第二步**：在模板管理中点击“默认模板”旁的 **更新** 按钮，获取基础配置，或者手动添加自己的模板。
- **第三步**：添加你的订阅链接或节点。
- **第四步**：在“合并操作”区勾选所需项，生成配置。

## 📥 配置链接

生成配置后，你可以在面板底部获得带加密后缀的 `subpanel.'你的域名'/config='随机加密后缀'` 订阅地址。如需更换地址，可点击“重置加密后缀”。将该地址填入客户端中即可。

---
