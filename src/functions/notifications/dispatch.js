import { cognito, dynamodb } from "../../libs/aws.js";
import { AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { sendEmail } from "../../libs/email.js";
import { v4 as uuidv4 } from "uuid";

export const handler = async (event) => {
  console.log("Dispatching notification for event:", JSON.stringify(event, null, 2));

  const { userId, warrantyId, productName, expiryDate, type } = event;

  try {
    // 1. Get User Email from Cognito
    const cognitoParams = {
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: userId,
    };
    const userRes = await cognito.send(new AdminGetUserCommand(cognitoParams));
    const emailAttr = userRes.UserAttributes.find(attr => attr.Name === "email");
    const userEmail = emailAttr?.Value;

    if (!userEmail) {
      console.warn("No email found for user:", userId);
      return;
    }

    // 2. Prepare Email Content
    const isFinal = type === "final";
    const subject = isFinal
      ? `URGENT: Your warranty for ${productName} expires today!`
      : `REMINDER: Your warranty for ${productName} expires in 7 days`;

    const body = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333;">Warranty Notice</h2>
        <p>This is an automated reminder from <strong>Warrantor</strong>.</p>
        <p>The warranty for your <strong>${productName}</strong> is ${isFinal ? "expiring TODAY" : "expiring on " + expiryDate.split('T')[0]}.</p>
        <p>Make sure to check your product's condition and file any claims if necessary.</p>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #777;">Warrantor - Helping you keep track of what matters.</p>
      </div>
    `;

    // 3. Send Email via SES
    await sendEmail({
      to: userEmail,
      subject: subject,
      body: body
    });

    // 4. Save Notification to DynamoDB
    const notification = {
      id: uuidv4(),
      userId: userId,
      warrantyId: warrantyId,
      productName: productName,
      message: subject,
      type: "EXPIRY_NOTICE",
      createdAt: new Date().toISOString(),
      read: false
    };

    await dynamodb.send(new PutItemCommand({
      TableName: "notifications",
      Item: marshall(notification)
    }));

    console.log(`Successfully dispatched ${type} notification for ${userId}`);
  } catch (error) {
    console.error("Dispatch Notification Error:", error);
    throw error;
  }
};
