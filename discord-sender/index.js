#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync, createReadStream } from 'fs';
import { resolve, basename } from 'path';
import FormData from 'form-data';

// 環境変数読み込み
import dotenv from 'dotenv';
dotenv.config();

const server = new Server(
  {
    name: 'discord-sender',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Discord送信クラス
class DiscordSender {
  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!this.webhookUrl) {
      throw new Error('DISCORD_WEBHOOK_URL が設定されていません');
    }
  }

  async sendMessage(content, options = {}) {
    const payload = {
      content: content,
      ...options
    };

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return { success: true, message: 'メッセージ送信完了' };
  }

  async sendFile(filePath, message = '') {
    const absolutePath = resolve(filePath);
    
    if (!existsSync(absolutePath)) {
      throw new Error(`ファイルが見つかりません: ${absolutePath}`);
    }

    const form = new FormData();
    form.append('file', createReadStream(absolutePath));
    
    if (message) {
      form.append('payload_json', JSON.stringify({ content: message }));
    }

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return { 
      success: true, 
      message: `ファイル送信完了: ${basename(absolutePath)}` 
    };
  }

  async sendEmbed(embedData) {
    const payload = {
      embeds: [embedData]
    };

    return this.sendMessage('', payload);
  }
}

// ツール一覧
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'discord_send_message',
        description: 'Discordにテキストメッセージを送信',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: '送信するメッセージ内容'
            }
          },
          required: ['content']
        }
      },
      {
        name: 'discord_send_file',
        description: 'Discordに画像・動画ファイルを送信',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: '送信するファイルのパス'
            },
            message: {
              type: 'string',
              description: 'ファイルと一緒に送信するメッセージ（任意）'
            }
          },
          required: ['file_path']
        }
      },
      {
        name: 'discord_send_embed',
        description: 'Discord に埋め込みメッセージを送信',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: '埋め込みのタイトル'
            },
            description: {
              type: 'string',
              description: '埋め込みの説明'
            },
            color: {
              type: 'string',
              description: '色（16進数、例: "00ff00"）',
              default: '0099ff'
            }
          },
          required: ['title', 'description']
        }
      }
    ]
  };
});

// ツール実行ハンドラ
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    const discord = new DiscordSender();
    
    switch (name) {
      case 'discord_send_message': {
        const result = await discord.sendMessage(args.content);
        return {
          content: [
            {
              type: 'text',
              text: `✅ ${result.message}`
            }
          ]
        };
      }
      
      case 'discord_send_file': {
        const result = await discord.sendFile(args.file_path, args.message || '');
        return {
          content: [
            {
              type: 'text', 
              text: `✅ ${result.message}`
            }
          ]
        };
      }
      
      case 'discord_send_embed': {
        const embedData = {
          title: args.title,
          description: args.description,
          color: parseInt(args.color || '0099ff', 16),
          timestamp: new Date().toISOString()
        };
        
        const result = await discord.sendEmbed(embedData);
        return {
          content: [
            {
              type: 'text',
              text: `✅ 埋め込みメッセージ送信完了`
            }
          ]
        };
      }
      
      default:
        throw new Error(`不明なツール: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ エラー: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// サーバー起動
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Discord MCP Server started');
}

main().catch(console.error);