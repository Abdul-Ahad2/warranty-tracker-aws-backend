import { authMiddleware } from "../../middleware/auth.js";
import { updateSettingsService } from "../../services/settings.js";
import { successResponse, errorResponse } from "../../utils/response.js";

const updateSettings = async (event) => {
  try {
    const userId = event.userId;
    const body = event.body || event;

    const result = await updateSettingsService(userId, body);
    return successResponse(result);
  } catch (error) {
    console.error("Error updating settings:", error);
    return errorResponse(500, error.message);
  }
};

export const handler = authMiddleware(updateSettings);