# EventBridge Pipes の Enrichment（強化）で DynamoDB 形式の JSON を標準形式に変換するデモ

CDK でデプロイできる。

## デモ実行前の事前準備

1. `.envrc` の設定

AWS の認証情報は次のように設定できる。

```bash:.envrc
export AWS_ACCESS_KEY_ID="<secret>"
export AWS_SECRET_ACCESS_KEY="<secret>"
export AWS_SESSION_TOKEN="<secret>"
```

2. `cdk bootstrap`の実行

CDK を使ったことない AWS アカウント、および、リージョンの場合、bootstrap を実行する必要がある。

```bash: デプロイコマンド
cdk bootstrap
```

3. `cdk deploy` の実行

```bash: デプロイコマンド
cdk deploy
```

4. デモ実行

```bash: テストコマンド
curl -X POST -d '{"userId": "USER#123", "location":{"latitude": 35.123, "longitude": 135.1}}' 'https://<API GatewayのFQDN>/prod/rides'
```

5. ログ確認

AWS マネジメントコンソールの Lambda のログから結果を確認できる。
