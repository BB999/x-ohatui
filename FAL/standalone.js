#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FALUploader {
  constructor() {
    this.apiKey = process.env.FAL_KEY;
    if (!this.apiKey) {
      throw new Error('FAL_KEY が設定されていません');
    }
  }

  async uploadImage(imagePath) {
    return new Promise((resolve, reject) => {
      // Pythonスクリプトのパス
      const pythonScript = path.join(__dirname, 'upload_to_fal_standalone.py');
      
      // ファイルの存在確認
      if (!fs.existsSync(imagePath)) {
        reject(new Error(`画像ファイルが見つかりません: ${imagePath}`));
        return;
      }

      if (!fs.existsSync(pythonScript)) {
        reject(new Error(`Pythonスクリプトが見つかりません: ${pythonScript}`));
        return;
      }

      // Pythonスクリプトを実行（環境変数でFAL_KEYを渡す）
      const pythonProcess = spawn('python3', [pythonScript, imagePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FAL_KEY: this.apiKey }
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          // 成功時はURLを抽出
          const urlMatch = stdout.match(/Remote URL: (https?:\/\/[^\s]+)/);
          const url = urlMatch ? urlMatch[1] : null;
          
          if (url) {
            resolve({
              success: true,
              url: url,
              message: `画像のアップロードに成功しました: ${path.basename(imagePath)}`
            });
          } else {
            reject(new Error(`URLの抽出に失敗しました。出力: ${stdout}`));
          }
        } else {
          reject(new Error(`アップロードに失敗しました (終了コード: ${code})。エラー: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Pythonプロセスの起動に失敗しました: ${error.message}`));
      });
    });
  }
}

// コマンドライン引数解析
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`使い方:
  node standalone.js "画像ファイルパス"`);
  process.exit(1);
}

const imagePath = args[0];

async function main() {
  try {
    const uploader = new FALUploader();
    const result = await uploader.uploadImage(imagePath);
    
    console.log(`✅ ${result.message}`);
    console.log(`🔗 URL: ${result.url}`);
    
    // GitHub Actions用の出力
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `fal-url=${result.url}\n`);
    }
    
  } catch (error) {
    console.error(`❌ エラー: ${error.message}`);
    process.exit(1);
  }
}

main();