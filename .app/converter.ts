import middy from '@middy/core';
import { DynamoDBStreamEvent } from 'aws-lambda';

interface DynamoDBRecord {
  eventID: string;
  eventName: string;
  eventVersion: string;
  eventSource: string;
  awsRegion: string;
  dynamodb: {
    ApproximateCreationDateTime: number;
    Keys: Record<string, any>;
    NewImage: Record<string, any>;
    SequenceNumber: string;
    SizeBytes: number;
    StreamViewType: string;
    convertedImage?: Record<string, any>;
  };
}

interface Event {
  Records: DynamoDBRecord[];
}

const convertDynamoDBItem = (item: Record<string, any>): any => {
  if (!item) return null;

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(item)) {
    if (typeof value === 'object' && value !== null) {
      if ('S' in value) {
        result[key] = value.S;
      } else if ('N' in value) {
        result[key] = Number(value.N);
      } else if ('B' in value) {
        result[key] = value.B;
      } else if ('BOOL' in value) {
        result[key] = value.BOOL;
      } else if ('NULL' in value) {
        result[key] = null;
      } else if ('L' in value) {
        result[key] = value.L.map(convertDynamoDBItem);
      } else if ('M' in value) {
        result[key] = convertDynamoDBItem(value.M);
      } else if ('SS' in value) {
        result[key] = value.SS;
      } else if ('NS' in value) {
        result[key] = value.NS.map(Number);
      } else if ('BS' in value) {
        result[key] = value.BS;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
};

const converterMiddleware = (): middy.MiddlewareObj => {
  return {
    before: async (request: { event: Event }) => {
      const event = request.event;
      
      for (const record of event.Records) {
        if (record.dynamodb.NewImage) {
          record.dynamodb.convertedImage = convertDynamoDBItem(record.dynamodb.NewImage);
        }
      }
      
      return request;
    }
  };
};

export const handler = middy()
  .use(converterMiddleware())
  .handler(async (event: Event) => {
    return event;
  }); 