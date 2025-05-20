#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import express from 'express';
import {
  ReadWebPageSchema,
  ReaderResponseSchema,
  SearchWebSchema,
  SearchResponseSchema,
  GroundingSchema,
  GroundingResponseSchema,
} from './schemas.js'

// Get your Jina AI API key for free: https://jina.ai/
const JINA_API_KEY = process.env.JINA_API_KEY;

if (!JINA_API_KEY) {
  console.error("JINA_API_KEY environment variable is not set. You can get a key at https://jina.ai/");
  process.exit(1);
}

const server = new Server({
  name: "jina-mcp-server",
  version: "0.1.0",
}, {
  capabilities: {
    tools: {}
  }
});

async function readWebPage(params: z.infer<typeof ReadWebPageSchema>) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${JINA_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (params.with_links) headers['X-With-Links-Summary'] = 'true';
  if (params.with_images) headers['X-With-Images-Summary'] = 'true';
  if (params.with_generated_alt) headers['X-With-Generated-Alt'] = 'true';
  if (params.no_cache) headers['X-No-Cache'] = 'true';

  try {
    console.log("读取网页:", params.url);
    
    const response = await fetch('https://r.jina.ai/', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: params.url,
        options: params.format || 'Default'
      })
    });

    if (!response.ok) {
      throw new Error(`Jina AI API error: ${response.statusText}`);
    }

    // 获取响应文本
    const responseText = await response.text();
    console.log("响应文本长度:", responseText.length);
    
    try {
      // 尝试解析为 JSON
      const data = JSON.parse(responseText);
      console.log("解析成功");
      return ReaderResponseSchema.parse(data);
    } catch (parseError) {
      console.error("JSON 解析错误:", parseError);
      
      // 返回一个格式化的错误响应
      return {
        status: "error",
        error: "无法解析 API 响应",
        rawResponse: responseText.substring(0, 500) // 返回部分原始响应用于调试
      };
    }
  } catch(err) {
    console.log("读取网页出错:", err);
    // 返回一个格式化的错误响应
    return {
      status: "error",
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

async function searchWeb(params: z.infer<typeof SearchWebSchema>) {
  console.log("searchWeb", params, JINA_API_KEY?.substring(0, 5) + "...")
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${JINA_API_KEY}`,
    "X-Respond-With": "no-content",
    // 'X-Retain-Images': params.retain_images,
    // 'X-With-Generated-Alt': params.with_generated_alt.toString(),
    // 'X-Return-Format': params.return_format
  };
  try {
    const queryString = encodeURIComponent(params.query);
    console.log("queryString", queryString)
    const url = `https://s.jina.ai/${queryString}?count=${params.count}`;

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Jina AI Search API error: ${response.statusText}`);
    }

    // 获取响应文本
    const responseText = await response.text();
    console.log("响应文本:", responseText.substring(0, 100) + "...");
    
    return responseText;
  } catch(err) {
    console.log("出错了", err);
    // 返回一个格式化的错误响应
    return {
      status: "error",
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

async function groundStatement(params: z.infer<typeof GroundingSchema>) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${JINA_API_KEY}`,
    'Accept': 'application/json'
  };

  try {
    console.log("事实检查:", params.statement);
    
    const statementQuery = encodeURIComponent(params.statement);
    const url = `https://g.jina.ai/${statementQuery}${params.deepdive ? '?deepdive=true' : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Jina AI Grounding API error: ${response.statusText}`);
    }

    // 获取响应文本
    const responseText = await response.text();
    console.log("响应文本长度:", responseText.length);
    
    try {
      // 尝试解析为 JSON
      const data = JSON.parse(responseText);
      console.log("解析成功");
      return GroundingResponseSchema.parse(data);
    } catch (parseError) {
      console.error("JSON 解析错误:", parseError);
      
      // 返回一个格式化的错误响应
      return {
        status: "error",
        error: "无法解析 API 响应",
        rawResponse: responseText.substring(0, 500) // 返回部分原始响应用于调试
      };
    }
  } catch(err) {
    console.log("事实检查出错:", err);
    // 返回一个格式化的错误响应
    return {
      status: "error",
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_webpage",
        description: "Extract content from a webpage in a format optimized for LLMs",
        inputSchema: zodToJsonSchema(ReadWebPageSchema)
      },
      {
        name: "search_web",
        description: "Search the web using Jina AI's search API",
        inputSchema: zodToJsonSchema(SearchWebSchema)
      },
      {
        name: "fact_check",
        description: "Fact-check a statement using Jina AI's grounding engine",
        inputSchema: zodToJsonSchema(GroundingSchema)
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    switch (request.params.name) {
      case "read_webpage": {
        const args = ReadWebPageSchema.parse(request.params.arguments);
        const result = await readWebPage(args);
        
        // 检查是否有错误响应
        if (result.status === "error") {
          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify(result, null, 2) 
            }] 
          };
        }
        
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "search_web": {
        const args = SearchWebSchema.parse(request.params.arguments);
        const result = await searchWeb(args);
        return { content: [{ type: "text", text: result }] };
      }

      case "fact_check": {
        const args = GroundingSchema.parse(request.params.arguments);
        const result = await groundStatement(args);
        
        // 检查是否有错误响应
        if (result.status === "error") {
          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify(result, null, 2) 
            }] 
          };
        }
        
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            status: "error",
            error: `Invalid arguments: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          }, null, 2) 
        }] 
      };
    }
    
    return { 
      content: [{ 
        type: "text", 
        text: JSON.stringify({
          status: "error",
          error: error instanceof Error ? error.message : String(error)
        }, null, 2) 
      }] 
    };
  }
});

// 存储传输实例，用会话ID索引
const transports: Record<string, SSEServerTransport> = {};

async function runServer() {
  const app = express();
  app.use(express.json());
  
  // SSE 端点用于建立流
  app.get('/mcp', async (req: express.Request, res: express.Response) => {
    console.log('收到 GET 请求到 /mcp (建立 SSE 流)');
    try {
      // 为客户端创建新的 SSE 传输
      // POST 消息的端点是 '/messages'
      const transport = new SSEServerTransport('/messages', res);
      
      // 通过会话 ID 存储传输
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;
      
      // 设置 onclose 处理程序，在关闭时清理传输
      transport.onclose = () => {
        console.log(`会话 ${sessionId} 的 SSE 传输已关闭`);
        delete transports[sessionId];
      };
      
      // 启动 SSE 传输
      await transport.start();
      
      // 将传输连接到 MCP 服务器
      await server.connect(transport);
      console.log(`已建立会话 ID 为 ${sessionId} 的 SSE 流`);
    } catch (error) {
      console.error('建立 SSE 流时出错:', error);
      if (!res.headersSent) {
        res.status(500).send('建立 SSE 流时出错');
      }
    }
  });
  
  // 消息端点用于接收客户端 JSON-RPC 请求
  app.post('/messages', async (req: express.Request, res: express.Response) => {
    console.log('收到 POST 请求到 /messages');
    
    // 从 URL 查询参数中提取会话 ID
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      console.error('请求 URL 中未提供会话 ID');
      res.status(400).send('缺少 sessionId 参数');
      return;
    }
    
    const transport = transports[sessionId];
    if (!transport) {
      console.error(`未找到会话 ID 的活动传输: ${sessionId}`);
      res.status(404).send('未找到会话');
      return;
    }
    
    try {
      // 使用传输处理 POST 消息
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('处理请求时出错:', error);
      if (!res.headersSent) {
        res.status(500).send('处理请求时出错');
      }
    }
  });
  
  // 添加根路径响应
  app.get('/', (req: express.Request, res: express.Response) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Jina AI MCP Server</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>Jina AI MCP Server</h1>
          <p>这是一个运行 MCP (Model Context Protocol) 的服务器，使用 SSE 协议。</p>
          <p>MCP 连接端点: <code>/mcp</code></p>
          <p>消息端点: <code>/messages</code></p>
        </body>
      </html>
    `);
  });
  
  // 启动服务器
  const PORT = process.env.PORT || 3118;
  app.listen(PORT, () => {
    console.log(`Jina AI MCP Server 运行在端口 ${PORT} 上`);
  });
  
  // 处理服务器关闭
  process.on('SIGINT', async () => {
    console.log('正在关闭服务器...');
    // 关闭所有活动传输以正确清理资源
    for (const sessionId in transports) {
      try {
        console.log(`关闭会话 ${sessionId} 的传输`);
        await transports[sessionId].close();
        delete transports[sessionId];
      } catch (error) {
        console.error(`关闭会话 ${sessionId} 的传输时出错:`, error);
      }
    }
    console.log('服务器关闭完成');
    process.exit(0);
  });
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});