import { authMiddleware } from "../../middleware/auth.js";
import { getNotificationsService } from "../../services/notifications.js";
import { successResponse, errorResponse } from "../../utils/response.js";

const getNotifications = async (event) => {
  try {
    const result = await getNotificationsService(event.userId);
    return successResponse(result);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return errorResponse(500, error.message);
  }
};

export const handler = authMiddleware(getNotifications);