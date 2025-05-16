import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as pipes from 'aws-cdk-lib/aws-pipes';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class DynamoDBJsonConverterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB テーブル
    const table = new dynamodb.Table(this, 'SampleTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 変換用 Lambda 関数
    const converterFunction = new lambda.Function(this, 'ConverterFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'converter.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../src')),
      timeout: cdk.Duration.seconds(30),
    });

    // テスト用 Lambda 関数
    const loggerFunction = new lambda.Function(this, 'LoggerFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'logger.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../src')),
      timeout: cdk.Duration.seconds(30),
    });

    // EventBridge Pipes の IAM ロール
    const pipeRole = new iam.Role(this, 'PipeRole', {
      assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
    });

    // DynamoDB Streams の読み取り権限
    pipeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:DescribeStream', 'dynamodb:GetRecords', 'dynamodb:GetShardIterator', 'dynamodb:ListStreams'],
        resources: [table.tableStreamArn!],
      })
    );

    // Lambda の実行権限
    pipeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [converterFunction.functionArn, loggerFunction.functionArn],
      })
    );

    // EventBridge Pipes
    new pipes.CfnPipe(this, 'DynamoDBToLambdaPipe', {
      roleArn: pipeRole.roleArn,
      source: table.tableStreamArn!,
      enrichment: converterFunction.functionArn,
      target: loggerFunction.functionArn,
    });

    // 出力
    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
      description: 'DynamoDB Table Name',
    });
  }
} 