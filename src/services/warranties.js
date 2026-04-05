import { PutItemCommand, UpdateItemCommand, QueryCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { v4 as uuid } from "uuid";
import { dynamodb } from "../libs/aws.js";

export const createWarrantyService = async (userId, body) => {
  const warrantyId = uuid();

  const requiredFields = ['productName', 'brand', 'category', 'warrantyProvider', 'purchaseDate', 'expiryDate', 'coverageDetails', 'pictureUrl'];
  for (const field of requiredFields) {
    if (!body[field]) {
      throw new Error(`Validation Error: All fields must be filled (${field} is missing)`);
    }
  }

  // Create warranty
  const warrantyCommand = new PutItemCommand({
    TableName: "warranties",
    Item: {
      id: { S: warrantyId },
      userId: { S: userId },
      productName: { S: body.productName },
      brand: { S: body.brand },
      category: { S: body.category },
      warrantyProvider: { S: body.warrantyProvider },
      purchaseDate: { S: body.purchaseDate },
      expiryDate: { S: body.expiryDate },
      coverageDetails: { S: body.coverageDetails },
      pictureUrl: { S: body.pictureUrl },
    },
  });

  await dynamodb.send(warrantyCommand);

  // Create notification
  const notificationCommand = new PutItemCommand({
    TableName: "notifications",
    Item: {
      id: { S: uuid() },
      userId: { S: userId },
      warrantyId: { S: warrantyId },
      productName: { S: body.productName },
      isRead: { BOOL: false },
      createdAt: { S: new Date().toISOString() },
      expiresAt: { S: body.expiryDate },
    },
  });

  await dynamodb.send(notificationCommand);

  return { message: "Warranty created successfully", warrantyId };
};

export const listWarrantiesService = async (userId) => {
  const command = new QueryCommand({
    TableName: "warranties",
    IndexName: "userId-index",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": { S: userId },
    },
  });

  const result = await dynamodb.send(command);

  return {
    warranties: result.Items.map(item => unmarshall(item)),
    count: result.Count,
  };
};

export const updateWarrantyService = async (userId, warrantyId, body) => {
  if (!warrantyId) throw new Error("Validation Error: id is required");

  const fields = ['productName', 'brand', 'category', 'warrantyProvider', 'purchaseDate', 'expiryDate', 'coverageDetails', 'pictureUrl'];
  const updates = [];
  const values = {};

  fields.forEach(field => {
    if (body[field]) {
      updates.push(`${field} = :${field}`);
      values[`:${field}`] = { S: body[field] };
    }
  });

  if (updates.length === 0) {
    throw new Error("Validation Error: No fields to update");
  }

  values[":userId"] = { S: userId };

  const command = new UpdateItemCommand({
    TableName: "warranties",
    Key: {
      id: { S: warrantyId },
    },
    UpdateExpression: `SET ${updates.join(", ")}`,
    ConditionExpression: "userId = :userId",
    ExpressionAttributeValues: values,
  });

  await dynamodb.send(command);

  // Cascade Update Notifications
  if (body.productName || body.expiryDate) {
    const notifUpdates = [];
    const notifValues = {};

    if (body.productName) {
      notifUpdates.push("productName = :productName");
      notifValues[":productName"] = { S: body.productName };
    }
    if (body.expiryDate) {
      notifUpdates.push("expiresAt = :expiresAt");
      notifValues[":expiresAt"] = { S: body.expiryDate };
    }

    const queryCommand = new QueryCommand({
      TableName: "notifications",
      IndexName: "userId-createdAt-index",
      KeyConditionExpression: "userId = :userId",
      FilterExpression: "warrantyId = :warrantyId",
      ExpressionAttributeValues: {
        ":userId": { S: userId },
        ":warrantyId": { S: warrantyId },
      },
    });

    const notificationsResult = await dynamodb.send(queryCommand);

    for (const item of notificationsResult.Items) {
      const updateNotifCommand = new UpdateItemCommand({
        TableName: "notifications",
        Key: {
          id: item.id,
        },
        UpdateExpression: `SET ${notifUpdates.join(", ")}`,
        ExpressionAttributeValues: notifValues,
      });
      await dynamodb.send(updateNotifCommand);
    }
  }

  return { message: "Warranty updated successfully" };
};

export const removeWarrantyService = async (userId, warrantyId) => {
  if (!warrantyId) throw new Error("Validation Error: id is required");

  const command = new DeleteItemCommand({
    TableName: "warranties",
    Key: {
      id: { S: warrantyId },
    },
    ConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": { S: userId },
    },
  });

  await dynamodb.send(command);

  // --- Cascade Delete Notifications ---
  const queryCommand = new QueryCommand({
    TableName: "notifications",
    IndexName: "userId-createdAt-index",
    KeyConditionExpression: "userId = :userId",
    FilterExpression: "warrantyId = :warrantyId",
    ExpressionAttributeValues: {
      ":userId": { S: userId },
      ":warrantyId": { S: warrantyId },
    },
  });

  const notificationsResult = await dynamodb.send(queryCommand);

  for (const item of notificationsResult.Items) {
    const deleteNotifCommand = new DeleteItemCommand({
      TableName: "notifications",
      Key: {
        id: item.id,
      },
    });
    await dynamodb.send(deleteNotifCommand);
  }

  return { message: "Warranty deleted successfully" };
};
