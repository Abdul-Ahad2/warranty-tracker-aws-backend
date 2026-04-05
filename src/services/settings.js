import { GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { AdminGetUserCommand, AdminUpdateUserAttributesCommand, AdminSetUserPasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { dynamodb, cognito } from "../libs/aws.js";

export const getSettingsService = async (userId) => {
  // Get app settings from DynamoDB
  const settingsCommand = new GetItemCommand({
    TableName: "settings",
    Key: { userId: { S: userId } },
  });
  const settingsResult = await dynamodb.send(settingsCommand);
  const appSettings = settingsResult.Item ? unmarshall(settingsResult.Item) : {
    lang: "en-US",
    notificationsEnabled: true,
  };

  // Get user info from Cognito
  const cognitoCommand = new AdminGetUserCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID,
    Username: userId,
  });
  const cognitoUser = await cognito.send(cognitoCommand);

  // Extract email and name from Cognito
  const email = cognitoUser.UserAttributes.find(attr => attr.Name === "email")?.Value;
  const name = cognitoUser.UserAttributes.find(attr => attr.Name === "name")?.Value;

  return {
    email,
    name,
    lang: appSettings.lang || "en-US",
    notificationsEnabled: appSettings.notificationsEnabled ?? true,
  };
};

export const updateSettingsService = async (userId, body) => {
  // Update name if provided
  if (body.name) {
    const cognitoCommand = new AdminUpdateUserAttributesCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: userId,
      UserAttributes: [{ Name: "name", Value: body.name }],
    });

    await cognito.send(cognitoCommand);
  }

  // Update password if provided
  if (body.newPassword) {
    const passwordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: userId,
      Password: body.newPassword,
      Permanent: true,
    });

    await cognito.send(passwordCommand);
  }

  // Update app settings (lang, notifications)
  if (body.lang || body.notificationsEnabled !== undefined) {
    const updates = [];
    const values = {};

    if (body.lang) {
      updates.push("lang = :lang");
      values[":lang"] = { S: body.lang };
    }
    if (body.notificationsEnabled !== undefined) {
      updates.push("notificationsEnabled = :notificationsEnabled");
      values[":notificationsEnabled"] = { BOOL: body.notificationsEnabled };
    }

    if (updates.length > 0) {
      const settingsCommand = new UpdateItemCommand({
        TableName: "settings",
        Key: { userId: { S: userId } },
        UpdateExpression: `SET ${updates.join(", ")}`,
        ExpressionAttributeValues: values,
      });

      await dynamodb.send(settingsCommand);
    }
  }

  return { message: "Settings updated successfully" };
};
