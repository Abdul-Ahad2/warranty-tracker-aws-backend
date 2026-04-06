import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: "us-east-1" });

/**
 * Sends a transactional email via AWS SES
 * @param {Object} params 
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.body - HTML/Text body
 */
export const sendEmail = async ({ to, subject, body }) => {
  const params = {
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: body,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: subject,
      },
    },
    Source: `${process.env.SES_DOMAIN}`, // You must verify this domain or email in SES
  };

  try {
    const command = new SendEmailCommand(params);
    const result = await ses.send(command);
    console.log("Email sent successfully:", result.MessageId);
    return result;
  } catch (error) {
    console.error("SES Send Error:", error);
    throw error;
  }
};
