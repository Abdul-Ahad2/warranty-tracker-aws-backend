import { PutItemCommand, UpdateItemCommand, QueryCommand, DeleteItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuid } from "uuid";
import { dynamodb, s3 } from "../libs/aws.js";
import { scheduleExpiryNotifications, deleteExpiryNotifications } from "./scheduler.js";

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

  const warranty = {
    id: warrantyId,
    userId: userId,
    productName: body.productName,
    expiryDate: body.expiryDate,
  };

  try {
    await scheduleExpiryNotifications(warranty);
  } catch (err) {
    console.error("Critical: Failed to schedule expiry alarms:", err);
  }

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

  // If the expiry date is changed, we must re-calculate schedules
  if (body.expiryDate) {
    // 1. Delete old schedules & 2. Re-schedule (Awaiting ensures logs are captured)
    try {
      await deleteExpiryNotifications(warrantyId);

      const getCommand = new QueryCommand({
        TableName: "warranties",
        KeyConditionExpression: "id = :id",
        ExpressionAttributeValues: { ":id": { S: warrantyId } }
      });

      const res = await dynamodb.send(getCommand);
      if (res.Items && res.Items[0]) {
        const fullWarranty = unmarshall(res.Items[0]);
        await scheduleExpiryNotifications(fullWarranty);
      }
    } catch (err) {
      console.error("Critical: Failed to update notification schedules:", err);
    }
  }

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

  // 1. Fetch warranty to get pictureUrl for S3 cleanup
  const getCommand = new GetItemCommand({
    TableName: "warranties",
    Key: { id: { S: warrantyId } },
  });

  const getResult = await dynamodb.send(getCommand);
  if (getResult.Item) {
    const warranty = unmarshall(getResult.Item);
    
    // Check ownership
    if (warranty.userId !== userId) {
      throw new Error("Access Denied: You do not own this warranty");
    }

    // 2. Delete image from S3 if it exists
    if (warranty.pictureUrl && warranty.pictureUrl.includes(process.env.S3_BUCKET_NAME)) {
      try {
        const url = new URL(warranty.pictureUrl);
        const key = url.pathname.substring(1); // Remove leading slash
        
        await s3.send(new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key,
        }));
        console.log(`Deleted S3 object: ${key}`);
      } catch (err) {
        console.warn("Failed to delete S3 object (might already be gone):", err.message);
      }
    }
  }

  // 3. Delete from DynamoDB
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

  try {
    await deleteExpiryNotifications(warrantyId);
  } catch (err) {
    console.error("Critical: Failed to cleanup schedules on delete:", err);
  }

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
