import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";
import { s3 } from "../libs/aws.js";

export const getPresignedUploadUrlService = async (userId) => {
  const fileId = uuid();
  const fileName = `warranties/${userId}/${fileId}.jpg`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return {
    uploadUrl,
    fileId,
    pictureUrl: `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${fileName}`,
  };
};
