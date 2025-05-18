import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import middy from "@middy/core";

const logger = new Logger({ serviceName: "Consumer" });

export const handler = middy()
  .use(injectLambdaContext(logger, { logEvent: true }))
  .handler(async () => {});
