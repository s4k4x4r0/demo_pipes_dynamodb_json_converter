import * as pipes from "@aws-cdk/aws-pipes-alpha";
import { LambdaEnrichment } from "@aws-cdk/aws-pipes-enrichments-alpha";
import {
  DynamoDBSource,
  DynamoDBStartingPosition,
} from "@aws-cdk/aws-pipes-sources-alpha";
import { LambdaFunction } from "@aws-cdk/aws-pipes-targets-alpha";
import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LayerVersion } from "aws-cdk-lib/aws-lambda";
import * as lambda_nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as path from "path";

export class DemoPipesDynamodbJsonConverterStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const parameterPrefix = `/${this.stackName}`;

    const powertoolsLayer = LayerVersion.fromLayerVersionArn(
      this,
      "PowertoolsLayer",
      StringParameter.valueForStringParameter(
        this,
        "/aws/service/powertools/typescript/generic/all/latest"
      )
    );

    const producer = new lambda_nodejs.NodejsFunction(
      this,
      "FunctionProducer",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(import.meta.dirname, `index.func-producer.ts`),
        layers: [powertoolsLayer],
        bundling: {
          format: lambda_nodejs.OutputFormat.ESM,
          target: "es2022",
          mainFields: ["module", "main"],
          sourcesContent: false,
          minify: true,
          metafile: true,
          externalModules: ["@aws-lambda-powertools/*", "@aws-sdk/*"],
          banner:
            "const require = (await import('node:module')).createRequire(import.meta.url);const __filename = (await import('node:url')).fileURLToPath(import.meta.url);const __dirname = (await import('node:path')).dirname(__filename);",
        },
        environment: {
          PARAMETER_PREFIX: parameterPrefix,
        },
        logRetention: logs.RetentionDays.ONE_DAY,
        loggingFormat: lambda.LoggingFormat.JSON,
        systemLogLevelV2: lambda.SystemLogLevel.DEBUG,
        applicationLogLevelV2: lambda.ApplicationLogLevel.TRACE,
      }
    );

    const apigw = new LambdaRestApi(this, "ApiGateway", {
      handler: producer,
    });

    const eventTable = new dynamodb.TableV2(this, "EventsTable", {
      partitionKey: {
        name: "entityId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "eventId",
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      dynamoStream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    const eventsTableNameParameter = new ssm.StringParameter(
      this,
      "EventsTableNameParameter",
      {
        parameterName: `${parameterPrefix}/events-table-name`,
        stringValue: eventTable.tableName,
      }
    );

    eventsTableNameParameter.grantRead(producer);

    const converter = new lambda_nodejs.NodejsFunction(
      this,
      "FunctionConverter",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(import.meta.dirname, `index.func-converter.ts`),
        bundling: {
          format: lambda_nodejs.OutputFormat.ESM,
          target: "es2022",
          mainFields: ["module", "main"],
          sourcesContent: false,
          minify: true,
          metafile: true,
          externalModules: ["@aws-lambda-powertools/*", "@aws-sdk/*"],
          banner:
            "const require = (await import('node:module')).createRequire(import.meta.url);const __filename = (await import('node:url')).fileURLToPath(import.meta.url);const __dirname = (await import('node:path')).dirname(__filename);",
        },
        logRetention: logs.RetentionDays.ONE_DAY,
        loggingFormat: lambda.LoggingFormat.JSON,
        systemLogLevelV2: lambda.SystemLogLevel.DEBUG,
        applicationLogLevelV2: lambda.ApplicationLogLevel.TRACE,
      }
    );

    const consumer = new lambda_nodejs.NodejsFunction(
      this,
      "FunctionConsumer",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(import.meta.dirname, `index.func-consumer.ts`),
        layers: [powertoolsLayer],
        bundling: {
          format: lambda_nodejs.OutputFormat.ESM,
          target: "es2022",
          mainFields: ["module", "main"],
          sourcesContent: false,
          minify: true,
          metafile: true,
          externalModules: ["@aws-lambda-powertools/*", "@aws-sdk/*"],
          banner:
            "const require = (await import('node:module')).createRequire(import.meta.url);const __filename = (await import('node:url')).fileURLToPath(import.meta.url);const __dirname = (await import('node:path')).dirname(__filename);",
        },
        logRetention: logs.RetentionDays.ONE_DAY,
        loggingFormat: lambda.LoggingFormat.JSON,
        systemLogLevelV2: lambda.SystemLogLevel.DEBUG,
        applicationLogLevelV2: lambda.ApplicationLogLevel.TRACE,
      }
    );

    eventTable.grantReadWriteData(producer);

    new pipes.Pipe(this, "EventConsumerPipe", {
      source: new DynamoDBSource(eventTable, {
        startingPosition: DynamoDBStartingPosition.LATEST,
        maximumRetryAttempts: 3,
      }),
      enrichment: new LambdaEnrichment(converter),
      target: new LambdaFunction(consumer, {}),
      filter: new pipes.Filter([
        pipes.FilterPattern.fromObject({
          eventName: ["INSERT"],
        }),
      ]),
    });
  }
}
