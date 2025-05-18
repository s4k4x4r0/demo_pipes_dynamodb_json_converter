import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBStreamEvent } from "aws-lambda";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import middy from "@middy/core";
import { parser } from "@aws-lambda-powertools/parser/middleware";
import { DynamoDBStreamRecord } from "@aws-lambda-powertools/parser/schemas/dynamodb";
import { z } from "zod";

const logger = new Logger({ serviceName: "Converter" });

type MyEvent = {
  events: Record<string, unknown>[];
};

const pipesDynamoDBStreamSchema = z.array(DynamoDBStreamRecord);

type PipesDynamoDBStream = z.infer<typeof pipesDynamoDBStreamSchema>;

const baseHandler = async (
  event: PipesDynamoDBStream
): Promise<MyEvent | {}> => {
  return {
    events: event
      .map((record) => {
        return record.dynamodb.NewImage;
      })
      .filter((v) => v !== undefined),
  };
};

export const handler = middy()
  .use(injectLambdaContext(logger, { logEvent: true }))
  .use(parser({ schema: pipesDynamoDBStreamSchema }))
  .handler(baseHandler);
