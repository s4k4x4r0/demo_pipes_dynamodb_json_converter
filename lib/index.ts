import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambda_nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import * as pipes from "@aws-cdk/aws-pipes-alpha";
import { Construct } from "constructs";
import {
  DynamoDBSource,
  DynamoDBStartingPosition,
} from "@aws-cdk/aws-pipes-sources-alpha";
import { LambdaFunction } from "@aws-cdk/aws-pipes-targets-alpha";
import { LambdaEnrichment } from "@aws-cdk/aws-pipes-enrichments-alpha";
import * as path from "path";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as logs from "aws-cdk-lib/aws-logs";

export class DemoPipesDynamodbJsonConverterStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const parameterPrefix = `/${this.stackName}`;

    const producer = new lambda_nodejs.NodejsFunction(
      this,
      "FunctionProducer",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(import.meta.dirname, `index.func-producer.ts`),
        bundling: {
          format: lambda_nodejs.OutputFormat.ESM,
          target: "es2022",
        },
        environment: {
          PARAMETER_PREFIX: parameterPrefix,
        },
        logRetention: logs.RetentionDays.ONE_DAY,
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
        },
        logRetention: logs.RetentionDays.ONE_DAY,
      }
    );

    const consumer = new lambda_nodejs.NodejsFunction(
      this,
      "FunctionConsumer",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(import.meta.dirname, `index.func-consumer.ts`),
        bundling: {
          format: lambda_nodejs.OutputFormat.ESM,
          target: "es2022",
        },
        logRetention: logs.RetentionDays.ONE_DAY,
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
