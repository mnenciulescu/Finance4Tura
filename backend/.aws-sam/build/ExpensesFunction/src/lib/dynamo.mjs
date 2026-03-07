import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const endpoint = process.env.DYNAMODB_ENDPOINT;

const client = new DynamoDBClient(
  endpoint
    ? { endpoint, region: "eu-central-1" }
    : {}
);

export const docClient = DynamoDBDocumentClient.from(client);
