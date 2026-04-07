import { QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { dynamodb } from "../libs/aws.js";

export const getNotificationsService = async (userId) => {
  const command = new QueryCommand({
    TableName: "notifications",
    IndexName: "userId-createdAt-index",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": { S: userId },
    },
    ScanIndexForward: false,
  });

  const result = await dynamodb.send(command);
  
  // Clean up: filter out any "broken" notifications missing critical data
  const notifications = result.Items
    .map((item) => unmarshall(item))
    .filter(n => n.message && n.type);

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.isRead).length,
  };
};

export const markNotificationReadService = async (userId, id) => {
  // Update the notification using a ConditionExpression for security (verify ownership)
  const updateCommand = new UpdateItemCommand({
    TableName: "notifications",
    Key: {
      id: { S: id },
    },
    UpdateExpression: "SET isRead = :isRead",
    ConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":isRead": { BOOL: true },
      ":userId": { S: userId },
    },
  });

  try {
    await dynamodb.send(updateCommand);
    return { message: "Notification marked as read" };
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      throw { statusCode: 403, message: "Notification not found or access denied" };
    }
    throw error;
  }
};