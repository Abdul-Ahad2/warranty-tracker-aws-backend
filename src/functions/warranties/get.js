import { authMiddleware } from "../../middleware/auth.js";
import { listWarrantiesService } from "../../services/warranties.js";
import { successResponse, errorResponse } from "../../utils/response.js";

const listWarranties = async (event) => {
  try {
    const result = await listWarrantiesService(event.userId);
    return successResponse(result);
  } catch (error) {
    return errorResponse(500, error.message);
  }
};

export const handler = authMiddleware(listWarranties);