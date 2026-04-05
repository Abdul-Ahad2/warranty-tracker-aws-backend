export const successResponse = (body) => ({
  statusCode: 200,
  body: JSON.stringify(body),
});

export const createdResponse = (body) => ({
  statusCode: 201,
  body: JSON.stringify(body),
});

export const errorResponse = (statusCode, message) => ({
  statusCode,
  body: JSON.stringify({ message }),
});

export const badRequestResponse = (message) => ({
  statusCode: 400,
  body: JSON.stringify({ error: message }),
});
