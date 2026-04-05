import { QueryCommand } from "@aws-sdk/client-dynamodb";
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

  const notifications = result.Items.map((item) => {
    const notification = unmarshall(item);
    const expiresAt = new Date(notification.expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

    const type = daysLeft < 0 ? "EXPIRED" : "EXPIRY_WARNING";
    const title = daysLeft < 0 ? "EXPIRED" : "EXPIRY WARNING";
    const message = daysLeft < 0
      ? `Your ${notification.productName} warranty has expired. You can no longer file claims.`
      : `Your ${notification.productName} warranty expires in ${daysLeft} days. Consider filing any pending claims.`;

    return {
      id: notification.id,
      userId: notification.userId,
      warrantyId: notification.warrantyId,
      productName: notification.productName,
      type,
      title,
      message,
      daysLeft,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      expiresAt: notification.expiresAt,
    };
  });

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.isRead).length,
  };
};
