#!/usr/bin/env node

import { readFileSync, existsSync, createReadStream } from 'fs';
import { resolve, basename } from 'path';
import FormData from 'form-data';
import dotenv from 'dotenv';

// 環境変数読み込み
dotenv.config();

// Discord送信クラス
class DiscordSender {
  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_KEY;
    if (!this.webhookUrl) {
      throw new Error('DISCORD_WEBHOOK_URL または DISCORD_KEY が設定されていません');
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

    return { success: true, message: '埋め込みメッセージ送信完了' };
  }
}

// コマンドライン引数解析
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`使い方:
  node standalone.js message "メッセージ内容"
  node standalone.js file "ファイルパス" ["メッセージ"]
  node standalone.js embed "タイトル" "説明" [色(16進数)]`);
  process.exit(1);
}

const command = args[0];

async function main() {
  try {
    const discord = new DiscordSender();
    
    switch (command) {
      case 'message': {
        if (args.length < 2) {
          throw new Error('メッセージ内容を指定してください');
        }
        const result = await discord.sendMessage(args[1]);
        console.log(`✅ ${result.message}`);
        break;
      }
      
      case 'file': {
        if (args.length < 2) {
          throw new Error('ファイルパスを指定してください');
        }
        const result = await discord.sendFile(args[1], args[2] || '');
        console.log(`✅ ${result.message}`);
        break;
      }
      
      case 'embed': {
        if (args.length < 3) {
          throw new Error('タイトルと説明を指定してください');
        }
        const embedData = {
          title: args[1],
          description: args[2],
          color: parseInt(args[3] || '0099ff', 16),
          timestamp: new Date().toISOString()
        };
        
        const result = await discord.sendEmbed(embedData);
        console.log(`✅ ${result.message}`);
        break;
      }
      
      default:
        throw new Error(`不明なコマンド: ${command}`);
    }
  } catch (error) {
    console.error(`❌ エラー: ${error.message}`);
    process.exit(1);
  }
}

main();