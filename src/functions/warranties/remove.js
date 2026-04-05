import { authMiddleware } from "../../middleware/auth.js";
import { removeWarrantyService } from "../../services/warranties.js";
import { successResponse, badRequestResponse, errorResponse } from "../../utils/response.js";

const deleteWarranty = async (event) => {
  try {
    const userId = event.userId;
    const warrantyId = event.pathParameters?.id || event.body?.id;

    const result = await removeWarrantyService(userId, warrantyId);
    return successResponse(result);
  } catch (error) {
    if (error.message.startsWith("Validation Error")) {
      return badRequestResponse(error.message);
    }
    return errorResponse(500, error.message);
  }
};

export const handler = authMiddleware(deleteWarranty);