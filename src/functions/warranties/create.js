import { authMiddleware } from "../../middleware/auth.js";
import { createWarrantyService } from "../../services/warranties.js";
import { createdResponse, badRequestResponse, errorResponse } from "../../utils/response.js";

const createWarranty = async (event) => {
  try {
    const userId = event.userId;
    const body = event.body || event;

    const result = await createWarrantyService(userId, body);
    return createdResponse(result);
  } catch (error) {
    if (error.message.startsWith("Validation Error")) {
      return badRequestResponse(error.message);
    }
    return errorResponse(500, error.message);
  }
};

export const handler = authMiddleware(createWarranty);