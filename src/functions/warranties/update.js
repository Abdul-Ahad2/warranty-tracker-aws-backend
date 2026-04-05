import { authMiddleware } from "../../middleware/auth.js";
import { updateWarrantyService } from "../../services/warranties.js";
import { successResponse, badRequestResponse, errorResponse } from "../../utils/response.js";

const updateWarranty = async (event) => {
  try {
    const userId = event.userId;
    const warrantyId = event.pathParameters?.id;
    const body = event.body || event;

    const result = await updateWarrantyService(userId, warrantyId, body);
    return successResponse(result);
  } catch (error) {
    if (error.message.startsWith("Validation Error")) {
      return badRequestResponse(error.message);
    }
    return errorResponse(500, error.message);
  }
};

export const handler = authMiddleware(updateWarranty);