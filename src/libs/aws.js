import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { S3Client } from "@aws-sdk/client-s3";

const awsRegion = "us-east-1";

export const dynamodb = new DynamoDBClient({ region: awsRegion });
export const cognito = new CognitoIdentityProviderClient({ region: awsRegion });
export const s3 = new S3Client({ region: awsRegion });
