import { authMiddleware } from "../../middleware/auth.js";
import { getPresignedUploadUrlService } from "../../services/uploads.js";
import { successResponse, errorResponse } from "../../utils/response.js";

const getUploadUrl = async (event) => {
  try {
    const result = await getPresignedUploadUrlService(event.userId);
    return successResponse(result);
  } catch (error) {
    return errorResponse(500, error.message);
  }
};

export const handler = authMiddleware(getUploadUrl);