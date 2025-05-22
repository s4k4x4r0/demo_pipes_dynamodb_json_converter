import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DynamoDBRecord } from "aws-lambda";

type MyEvent = {
  events: Record<string, unknown>[];
};

export const handler = async (
  event: DynamoDBRecord[]
): Promise<MyEvent | {}> => {
  return {
    events: event
      .map((record) => {
        if (record.dynamodb?.NewImage) {
          return unmarshall(
            record.dynamodb.NewImage as Record<string, AttributeValue>
          );
        } else {
          return undefined;
        }
      })
      .filter((v) => v !== undefined),
  };
};
