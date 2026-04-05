import { authMiddleware } from "../../middleware/auth.js";
import { getSettingsService } from "../../services/settings.js";
import { successResponse, errorResponse } from "../../utils/response.js";

const getSettings = async (event) => {
  try {
    const result = await getSettingsService(event.userId);
    return successResponse(result);
  } catch (error) {
    return errorResponse(500, error.message);
  }
};

export const handler = authMiddleware(getSettings);