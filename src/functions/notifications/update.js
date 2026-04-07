import { authMiddleware } from "../../middleware/auth.js";
import { markNotificationReadService } from "../../services/notifications.js";
import { successResponse, errorResponse } from "../../utils/response.js";

const updateNotification = async (event) => {
  try {
    const { id } = event.pathParameters;
    const result = await markNotificationReadService(event.userId, id);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error.statusCode || 500, error.message);
  }
};

export const handler = authMiddleware(updateNotification);