# EventBridge Pipes の Enrichment（強化）で DynamoDB 形式の JSON を標準形式に変換する Lambda を実行するデモ

TODO: WIP

## デモ実行前の事前準備

1. `.envrc` の設定

```bash:.envrc
export AWS_ACCESS_KEY_ID="<secret>"
export AWS_SECRET_ACCESS_KEY="<secret>"
export AWS_SESSION_TOKEN="<secret>"
```

2. `cdk bootstrap`の実行

TODO: WIP

```bash: テストコマンド
curl -X POST -d '{"userId": "USER#123", "location":{"latitude": 35.1, "longitude": 135.1}}' 'https://q7ahx1t5l0.execute-api.ap-northeast-1.amazonaws.com/prod/'
```
