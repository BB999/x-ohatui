#!/bin/bash

# X API自動投稿スクリプト（シンプル版）
# 使い方: ./post_to_x_simple.sh [テキスト] [メディアファイル1] [メディアファイル2] ...
# 例: ./post_to_x_simple.sh "こんにちは" image.jpg video.mp4

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# .envファイルを読み込み
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -E '^X_' "$SCRIPT_DIR/.env" | xargs)
else
    echo "エラー: .envファイルが見つかりません"
    exit 1
fi

# 必要な環境変数のチェック
if [ -z "$X_API_KEY" ] || [ -z "$X_API_SECRET" ] || [ -z "$X_ACCESS_TOKEN" ] || [ -z "$X_ACCESS_TOKEN_SECRET" ]; then
    echo "エラー: X API認証情報が設定されていません"
    echo "以下の環境変数を.envファイルに設定してください:"
    echo "  - X_API_KEY"
    echo "  - X_API_SECRET"  
    echo "  - X_ACCESS_TOKEN"
    echo "  - X_ACCESS_TOKEN_SECRET"
    exit 1
fi

# コマンドライン引数から内容を取得
TWEET_TEXT="${1:-☆彡}"
shift # 最初の引数（テキスト）を除去
MEDIA_FILES=("$@") # 残りの引数をメディアファイルとして扱う

# メディアファイルのチェック関数
check_media_file() {
    local file="$1"
    
    if [ ! -f "$file" ]; then
        echo "❌ ファイルが見つかりません: $file"
        return 1
    fi
    
    # ファイルサイズチェック (15MB制限)
    local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    local max_size=$((15 * 1024 * 1024))
    
    if [ "$size" -gt "$max_size" ]; then
        echo "❌ ファイルサイズが大きすぎます: $file ($(($size / 1024 / 1024))MB > 15MB)"
        return 1
    fi
    
    # ファイル形式チェック
    local mime_type=$(file --mime-type -b "$file")
    case "$mime_type" in
        image/jpeg|image/png|image/gif|image/webp)
            echo "📷 画像ファイル: $file ($mime_type)"
            return 0
            ;;
        video/mp4|video/mov|video/avi|video/webm)
            echo "🎬 動画ファイル: $file ($mime_type)"
            return 0
            ;;
        *)
            echo "❌ サポートされていないファイル形式: $file ($mime_type)"
            return 1
            ;;
    esac
}

# Pythonでの投稿処理
post_tweet_python() {
    # メディアファイルを環境変数で渡す
    if [ ${#MEDIA_FILES[@]} -gt 0 ]; then
        export PYTHON_MEDIA_FILES=$(IFS='|'; echo "${MEDIA_FILES[*]}")
    fi
    
    python3 - <<EOF
import os
import sys
import json
import time
import random
import hmac
import hashlib
import base64
import urllib.parse
import urllib.request
import mimetypes

# 環境変数から認証情報を取得
API_KEY = os.environ.get('X_API_KEY')
API_SECRET = os.environ.get('X_API_SECRET')
ACCESS_TOKEN = os.environ.get('X_ACCESS_TOKEN')
ACCESS_TOKEN_SECRET = os.environ.get('X_ACCESS_TOKEN_SECRET')

# メディアファイルを取得
media_files = os.environ.get('PYTHON_MEDIA_FILES', '').split('|') if os.environ.get('PYTHON_MEDIA_FILES') else []
media_files = [f for f in media_files if f]  # 空文字列を除去

def create_oauth_signature(method, url, params, api_secret, token_secret):
    """OAuth 1.0a 署名を生成"""
    # パラメータをソート
    sorted_params = sorted(params.items())
    param_string = '&'.join([f"{k}={v}" for k, v in sorted_params])
    
    # 署名ベース文字列
    signature_base = f"{method}&{urllib.parse.quote(url, safe='')}&{urllib.parse.quote(param_string, safe='')}"
    
    # 署名キー
    signing_key = f"{api_secret}&{token_secret}"
    
    # HMAC-SHA1署名
    signature = base64.b64encode(
        hmac.new(
            signing_key.encode(),
            signature_base.encode(),
            hashlib.sha1
        ).digest()
    ).decode()
    
    return urllib.parse.quote(signature, safe='')

def upload_media_simple(file_path):
    """シンプルなメディアアップロード"""
    
    upload_url = "https://upload.twitter.com/1.1/media/upload.json"
    
    try:
        # OAuth 1.0a認証
        oauth_params = {
            'oauth_consumer_key': API_KEY,
            'oauth_nonce': str(random.randint(0, 1000000000)),
            'oauth_signature_method': 'HMAC-SHA1',
            'oauth_timestamp': str(int(time.time())),
            'oauth_token': ACCESS_TOKEN,
            'oauth_version': '1.0'
        }
        
        # 署名生成
        oauth_params['oauth_signature'] = create_oauth_signature('POST', upload_url, oauth_params, API_SECRET, ACCESS_TOKEN_SECRET)
        
        # Authorization ヘッダー
        auth_header = 'OAuth ' + ', '.join([f'{k}="{v}"' for k, v in sorted(oauth_params.items())])
        
        # ファイル読み込み
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        # マルチパートボディ作成
        boundary = f'----WebKitFormBoundary{random.randint(1000000000, 9999999999)}'
        
        body_parts = []
        body_parts.append(f'--{boundary}')
        body_parts.append('Content-Disposition: form-data; name="media"; filename="upload"')
        body_parts.append('Content-Type: application/octet-stream')
        body_parts.append('')
        
        body_prefix = '\\r\\n'.join(body_parts) + '\\r\\n'
        body_suffix = f'\\r\\n--{boundary}--\\r\\n'
        
        body = body_prefix.encode() + file_data + body_suffix.encode()
        
        # リクエスト送信
        req = urllib.request.Request(upload_url, data=body, headers={
            'Authorization': auth_header,
            'Content-Type': f'multipart/form-data; boundary={boundary}'
        })
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            media_id = result.get('media_id_string')
            if media_id:
                print(f"✅ メディアアップロード成功: {file_path} → {media_id}")
                return media_id
            else:
                print(f"❌ メディアIDが取得できませんでした: {file_path}")
                return None
                
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"❌ メディアアップロードエラー: {e.code} - {e.reason}")
        print(f"   ファイル: {file_path}")
        print(f"   詳細: {error_body}")
        return None
    except Exception as e:
        print(f"❌ メディアアップロード例外: {file_path} - {e}")
        return None

def post_tweet(text, media_files):
    """ツイート投稿"""
    
    url = "https://api.twitter.com/2/tweets"
    
    # メディアアップロード
    uploaded_media_ids = []
    if media_files:
        print(f"📤 {len(media_files)}個のメディアファイルをアップロード中...")
        for media_file in media_files:
            print(f"📤 アップロード中: {media_file}")
            media_id = upload_media_simple(media_file)
            if media_id:
                uploaded_media_ids.append(media_id)
            else:
                print(f"⚠️  メディアアップロードに失敗、テキストのみで投稿を続行: {media_file}")
    
    # OAuth パラメータ
    oauth_params = {
        'oauth_consumer_key': API_KEY,
        'oauth_nonce': str(random.randint(0, 1000000000)),
        'oauth_signature_method': 'HMAC-SHA1',
        'oauth_timestamp': str(int(time.time())),
        'oauth_token': ACCESS_TOKEN,
        'oauth_version': '1.0'
    }
    
    # 署名生成
    oauth_params['oauth_signature'] = create_oauth_signature('POST', url, oauth_params, API_SECRET, ACCESS_TOKEN_SECRET)
    
    # Authorizationヘッダー作成
    auth_header = 'OAuth ' + ', '.join([f'{k}="{v}"' for k, v in sorted(oauth_params.items())])
    
    # リクエストボディ
    tweet_data = {'text': text}
    if uploaded_media_ids:
        tweet_data['media'] = {'media_ids': uploaded_media_ids}
        print(f"📎 メディア添付: {len(uploaded_media_ids)}個")
    
    body = json.dumps(tweet_data).encode('utf-8')
    
    # リクエスト送信
    req = urllib.request.Request(url, data=body, headers={
        'Authorization': auth_header,
        'Content-Type': 'application/json'
    })
    
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            print(f"✅ ツイートを投稿しました: {text}")
            if uploaded_media_ids:
                print(f"   メディア: {len(uploaded_media_ids)}個のファイル")
            print(f"   ツイートID: {result['data']['id']}")
            print(f"   URL: https://twitter.com/i/web/status/{result['data']['id']}")
            return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"❌ ツイート投稿エラー: {e.code} - {e.reason}")
        print(f"   詳細: {error_body}")
        return False

# メイン処理
if __name__ == "__main__":
    tweet_text = "$TWEET_TEXT"
    
    if not all([API_KEY, API_SECRET, ACCESS_TOKEN, ACCESS_TOKEN_SECRET]):
        print("❌ 認証情報が不足しています")
        sys.exit(1)
    
    success = post_tweet(tweet_text, media_files)
    sys.exit(0 if success else 1)
EOF
}

# メディアファイルのチェック
if [ ${#MEDIA_FILES[@]} -gt 0 ]; then
    echo "メディアファイルをチェック中..."
    for media_file in "${MEDIA_FILES[@]}"; do
        if ! check_media_file "$media_file"; then
            exit 1
        fi
    done
fi

# メイン処理
echo "================================"
echo "X API 自動投稿スクリプト（シンプル版）"
echo "================================"
echo ""
echo "投稿内容: ${TWEET_TEXT}"
if [ ${#MEDIA_FILES[@]} -gt 0 ]; then
    echo "メディアファイル: ${#MEDIA_FILES[@]}個"
    for media_file in "${MEDIA_FILES[@]}"; do
        echo "  - $media_file"
    done
fi
echo ""

# Python版を使用
if command -v python3 &> /dev/null; then
    echo "Pythonを使用して投稿中..."
    post_tweet_python
    exit $?
fi

echo "❌ Python3が見つかりません。"
exit 1