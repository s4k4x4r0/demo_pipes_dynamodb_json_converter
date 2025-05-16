import { DynamoDBStreamEvent } from 'aws-lambda';

export const handler = async (event: DynamoDBStreamEvent) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const original = record.dynamodb.NewImage;
    const converted = record.dynamodb.convertedImage;

    console.log('Original data:', JSON.stringify(original, null, 2));
    console.log('Converted data:', JSON.stringify(converted, null, 2));
    console.log('Timestamp:', new Date().toISOString());
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Logging completed successfully'
    })
  };
}; 