#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DynamoDBJsonConverterStack } from '../lib/stack';

const app = new cdk.App();
new DynamoDBJsonConverterStack(app, 'DynamoDBJsonConverterStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
}); 