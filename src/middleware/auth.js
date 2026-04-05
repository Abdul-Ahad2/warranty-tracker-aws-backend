import { CognitoJwtVerifier } from "aws-jwt-verify";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID
});

export const authMiddleware = (handler) => {
  return async (event) => {
    try {
      const token = event.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Unauthorized: No token provided' })
        };
      }

      const payload = await verifier.verify(token);

      event.userId = payload.sub || payload.username;

      if (event.body) {
        if (event.isBase64Encoded && typeof event.body === 'string') {
          event.body = Buffer.from(event.body, 'base64').toString('utf-8');
        }
        if (typeof event.body === 'string') {
          try {
            event.body = JSON.parse(event.body);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
      }

      return await handler(event);
    } catch (error) {
      console.error("JWT Verification failed:", error);
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized: Invalid token' })
      };
    }
  };
};