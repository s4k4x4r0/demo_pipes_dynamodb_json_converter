import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { JSONStringified } from "@aws-lambda-powertools/parser/helpers";
import { parser } from "@aws-lambda-powertools/parser/middleware";
import { APIGatewayProxyEventSchema } from "@aws-lambda-powertools/parser/schemas";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import middy from "@middy/core";
import { APIGatewayProxyResult } from "aws-lambda";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

const logger = new Logger({ serviceName: "Producer" });

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const eventsTableName = async () => {
  if (!process.env.PARAMETER_PREFIX) {
    throw new Error("PARAMETER_PREFIX is not set");
  }
  return await getParameter(
    `${process.env.PARAMETER_PREFIX}/events-table-name`
  );
};

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const requestSchema = z.object({
  userId: z.string().startsWith("USER#"),
  location: locationSchema,
});

const eventSchema = APIGatewayProxyEventSchema.extend({
  body: JSONStringified(requestSchema),
});

type EventSchema = z.infer<typeof eventSchema>;

const baseHandler = async (
  event: EventSchema
): Promise<APIGatewayProxyResult> => {
  try {
    const { userId, location } = event.body;

    const eventId = uuidv7();
    const entityId = `RIDE#${uuidv7()}`;
    const now = new Date().toISOString();

    const item = {
      entityId,
      eventId,
      type: "RIDE_BOOKED",
      createdAt: now,
      payload: {
        userId: `${userId}`,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      },
    };

    await docClient.send(
      new PutCommand({
        TableName: await eventsTableName(),
        Item: item,
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "イベントが正常に作成されました",
        eventId,
        entityId,
      }),
    };
  } catch (error) {
    logger.error("エラーが発生しました", { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "内部サーバーエラーが発生しました" }),
    };
  }
};

export const handler = middy()
  .use(injectLambdaContext(logger, { logEvent: true }))
  .use(parser({ schema: eventSchema }))
  .handler(baseHandler);
