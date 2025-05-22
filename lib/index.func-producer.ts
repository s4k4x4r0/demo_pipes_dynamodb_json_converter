import { Logger } from "@aws-lambda-powertools/logger";
import {
  correlationPaths,
  search,
} from "@aws-lambda-powertools/logger/correlationId";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { ParseError } from "@aws-lambda-powertools/parser";
import { JSONStringified } from "@aws-lambda-powertools/parser/helpers";
import { parser } from "@aws-lambda-powertools/parser/middleware";
import { APIGatewayProxyEventSchema } from "@aws-lambda-powertools/parser/schemas";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import middy from "@middy/core";
import httpErrorHandler from "@middy/http-error-handler";
import { APIGatewayProxyResult } from "aws-lambda";
import * as createHttpError from "http-errors";
import * as path from "node:path";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

const logger = new Logger({
  serviceName: "Producer",
  correlationIdSearchFn: search,
});

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

const apiGatewayProxyEventBookRideSchema = APIGatewayProxyEventSchema.extend({
  body: JSONStringified(requestSchema),
});

type APIGatewayProxyEventBookRide = z.infer<
  typeof apiGatewayProxyEventBookRideSchema
>;

const baseHandler = async (
  event: APIGatewayProxyEventBookRide
): Promise<APIGatewayProxyResult> => {
  if (path.resolve(event.path) !== path.resolve("/rides")) {
    throw new createHttpError.NotFound();
  }

  if (event.httpMethod !== "POST") {
    throw new createHttpError.MethodNotAllowed();
  }

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
};

const handleZodError = (): middy.MiddlewareObj<unknown, any> => {
  const onError: middy.MiddlewareFn<unknown, any> = async (request) => {
    if (request.error instanceof ParseError) {
      const newError = createHttpError.BadRequest(request.error.message);
      newError.cause = request.error;
      request.error = newError;
    }
  };

  return {
    onError,
  };
};

export const handler = middy()
  .use(
    injectLambdaContext(logger, {
      logEvent: true,
      correlationIdPath: correlationPaths.API_GATEWAY_REST,
    })
  )
  .use(
    httpErrorHandler({
      logger: (e) => {
        logger.error(e);
      },
    })
  )
  .use(handleZodError())
  .use(parser({ schema: apiGatewayProxyEventBookRideSchema }))
  .handler(baseHandler);
