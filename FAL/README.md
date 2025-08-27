# FAL MCP Server

fal.aiの画像アップロード機能を提供するMCPサーバーです。

## 機能

- **upload_image_to_fal**: 画像ファイルをfal.aiにアップロードしてリモートURLを取得

## セットアップ

### 1. 依存関係のインストール

```bash
cd /Users/noranekob/cursor/MyPC/mcp/FAL
npm install
```

### 2. 環境設定

`.env` ファイルを作成し、FAL APIキーを設定してください：

```
FAL_KEY=your_fal_api_key_here
```

### 3. Pythonの依存関係

以下のPythonパッケージが必要です：

```bash
pip install fal-client python-dotenv
```

## 使用方法

### MCPサーバーとして起動

```bash
npm start
```

### 利用可能なツール

#### upload_image_to_fal

画像ファイルをfal.aiにアップロードします。

**パラメータ:**
- `image_path` (string): アップロードする画像ファイルのパス

**対応フォーマット:**
- JPG/JPEG
- PNG
- GIF
- WebP
- BMP

**制限:**
- 最大ファイルサイズ: 100MB

**例:**
```json
{
  "name": "upload_image_to_fal",
  "arguments": {
    "image_path": "/path/to/your/image.jpg"
  }
}
```

## 設定ファイル

### mcp-config.json

Claude Codeでこのサーバーを使用するための設定ファイルです：

```json
{
  "mcpServers": {
    "fal-uploader": {
      "command": "node",
      "args": ["/Users/noranekob/cursor/MyPC/mcp/FAL/index.js"],
      "env": {}
    }
  }
}
```

## ファイル構成

```
FAL/
├── index.js           # MCPサーバーのメインファイル
├── package.json       # Node.jsの依存関係
├── mcp-config.json    # MCP設定ファイル
├── upload_to_fal.py   # Python画像アップロードスクリプト
├── .env              # 環境変数（要作成）
└── README.md         # このファイル
```

## トラブルシューティング

### よくあるエラー

1. **FAL_KEY not found**: `.env`ファイルにAPIキーが設定されていません
2. **Image file not found**: 指定された画像ファイルが存在しません
3. **File too large**: ファイルサイズが100MBを超えています
4. **Python not found**: Python3がインストールされていないか、パスが通っていません

### デバッグ

開発モードで起動してログを確認：

```bash
npm run dev
```

## ライセンス

MIT License