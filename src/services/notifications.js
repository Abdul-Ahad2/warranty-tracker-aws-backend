import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { dynamodb } from "../libs/aws.js";

export const getNotificationsService = async (userId) => {
  // 1. Fetch History from 'notifications' table
  const historyCommand = new QueryCommand({
    TableName: "notifications",
    IndexName: "userId-createdAt-index",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": { S: userId },
    },
    ScanIndexForward: false,
  });

  const historyResult = await dynamodb.send(historyCommand);
  const historyNotifications = historyResult.Items
    .map((item) => unmarshall(item))
    .filter(n => n.message); // Only show actual triggered alerts, not registration logs

  // 2. Fetch Live Alerts from 'warranties' table (< 60 days remaining)
  const warrantiesCommand = new QueryCommand({
    TableName: "warranties",
    IndexName: "userId-index",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: { ":userId": { S: userId } },
  });

  const warrantiesResult = await dynamodb.send(warrantiesCommand);
  const now = new Date();
  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(now.getDate() + 60);

  const dynamicAlerts = warrantiesResult.Items
    .map(item => unmarshall(item))
    .filter(w => {
      const expiry = new Date(w.expiryDate);
      return expiry <= sixtyDaysFromNow; // Expired or expiring soon
    })
    .map(w => {
      const expiry = new Date(w.expiryDate);
      const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      const expired = daysLeft <= 0;

      return {
        id: `alert-${w.id}`,
        userId: w.userId,
        warrantyId: w.id,
        productName: w.productName,
        type: expired ? "EXPIRED" : "EXPIRY_WARNING",
        title: expired ? "WARRANTY EXPIRED" : "EXPIRY WARNING",
        message: expired
          ? `Your ${w.productName} warranty has expired.`
          : `Your ${w.productName} warranty expires in ${daysLeft} days.`,
        daysLeft,
        isRead: false,
        createdAt: w.createdAt,
        expiresAt: w.expiryDate,
        isDynamic: true
      };
    });

  // 3. Merge and Sort (Newest alert or notification first)
  const allNotifications = [...dynamicAlerts, ...historyNotifications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    notifications: allNotifications,
    unreadCount: allNotifications.filter((n) => !n.isRead).length,
  };
};
