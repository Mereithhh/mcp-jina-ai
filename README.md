# MCP Jina AI

MCP (Model Context Protocol) server for Jina AI services.

不返回 json，直接返回格式化的文本，对 AI 有好一点， sse 协议的。

## 安装

### 本地开发安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/sse-jina-ai.git
cd mcp-jina-ai

# 安装依赖
npm install

# 构建项目
npm run build

# 运行开发服务器
npm run dev
```

### 全局安装

```bash
# 使用 npm 全局安装
npm install -g mcp-jina-ai

# 或者使用 npx 直接运行（推荐）
npx --yes mcp-jina-ai
```

> 注意：如果使用 `npx` 命令时出现问题，请尝试使用完整的 `--yes` 标志代替 `-y`。

## 使用方法

1. 设置 Jina AI API 密钥：

```bash
export JINA_API_KEY=your_jina_api_key
```

2. 运行服务器：

```bash
# 如果全局安装
mcp-jina-ai

# 如果使用 npx
npx --yes mcp-jina-ai

# 开发模式
npm run dev
```

3. 使用 MCP Inspector 进行测试：

```bash
npm run inspector
```

# Jina AI MCP 服务器

这是一个使用 Model Context Protocol (MCP) 的服务器，提供 Jina AI 的 Web 搜索、网页阅读和事实检查功能。服务器使用 SSE (Server-Sent Events) 协议进行通信。

## 功能

- **Web 搜索**：使用 Jina AI 的搜索 API 搜索网络
- **网页阅读**：提取网页内容，以优化的格式返回给 LLM
- **事实检查**：使用 Jina AI 的验证引擎对语句进行事实检查

## 先决条件

- Node.js 16+
- Jina AI API 密钥 (可在 [https://jina.ai/](https://jina.ai/) 获取)

## RUN
```bash
npx -y mcp-jina-ai
```

## 配置

设置环境变量 `JINA_API_KEY` 为你的 Jina AI API 密钥：

```bash
export JINA_API_KEY=your-api-key
```

## 使用方法

### 启动服务器

```bash
# 使用 TypeScript 直接运行（开发模式）
npm run dev

# 或者先构建然后运行
npm run build
npm start
```

服务器将在 http://localhost:3118 上运行。

### 端点

- **SSE 连接**：`GET /sse`
- **消息传递**：`POST /messages?sessionId=<session-id>`

### 运行示例客户端

```bash
npm run client
```

这将运行一个示例客户端，连接到服务器并演示所有可用工具的使用。

## API 工具

### 1. read_webpage

从网页提取内容，以优化的格式返回给 LLM。

参数：
- `url`：要读取的网页 URL
- `with_links`：（可选）是否包含链接摘要
- `with_images`：（可选）是否包含图片摘要
- `with_generated_alt`：（可选）是否包含生成的替代文本
- `no_cache`：（可选）是否禁用缓存
- `format`：（可选）输出格式

### 2. search_web

使用 Jina AI 的搜索 API 搜索网络。

参数：
- `query`：搜索查询
- `count`：返回结果数量

### 3. fact_check

使用 Jina AI 的验证引擎对语句进行事实检查。

参数：
- `statement`：要检查的语句
- `deepdive`：（可选）是否进行深度分析

## 错误处理

所有工具都包含完善的错误处理机制。当发生错误时，响应将包含以下格式：

```json
{
  "status": "error",
  "error": "错误信息描述"
}
```

## 许可证

[MIT](LICENSE)