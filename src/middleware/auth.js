import { successResponse, errorResponse } from "../utils/response.js";

export const authMiddleware = (handler) => {
  return async (event) => {
    try {
      // 1. Extract claims from the Native HTTP API Authorizer
      const claims = event.requestContext?.authorizer?.jwt?.claims;

      if (!claims) {
        return errorResponse(401, "Unauthorized: Native authentication failed");
      }

      // 2. Set userId for downstream handlers (compatible with existing code)
      event.userId = claims.sub || claims.username;

      // 3. Keep body parsing logic if it's still needed (common for HTTP API)
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
      console.error("Auth Middleware Error:", error);
      return errorResponse(401, "Unauthorized: Authentication error");
    }
  };
};