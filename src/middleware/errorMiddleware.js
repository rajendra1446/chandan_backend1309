export class BusinessValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "BusinessValidationError";
    this.statusCode = statusCode;
  }
}

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route ${req.method} ${req.originalUrl} not found on Chandan Steel Traceability Server.`
  });
};

export const errorHandler = (error, req, res, next) => {
  // MongoDB duplicate key violation (code 11000)
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || "identifier";
    const value = error.keyValue ? error.keyValue[field] : "";
    return res.status(409).json({
      success: false,
      message: `Conflict: Duplicate record detected. A record with ${field} '${value}' already exists.`,
      error: "DUPLICATE_KEY_VIOLATION"
    });
  }

  // Mongoose Schema Validation Error
  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors || {}).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: `Validation Error: ${messages.join("; ")}`,
      error: "VALIDATION_ERROR"
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid format for parameter '${error.path}': '${error.value}' is not a valid identifier.`,
      error: "INVALID_IDENTIFIER"
    });
  }

  // PostgreSQL fallback
  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message: `Conflict: Duplicate record detected. Detail: ${error.detail || "A record with this identifier already exists."}`,
      error: "DUPLICATE_KEY_VIOLATION"
    });
  }

  // Check if error is custom or has explicit statusCode (e.g. 400)
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: error.statusCode === 400 ? "BUSINESS_VALIDATION_ERROR" : "REQUEST_ERROR"
    });
  }

  // Detect common business rule violation keywords to return HTTP 400 Bad Request
  const msg = error.message || "";
  const isBusinessValidation = 
    msg.includes("cannot exceed") ||
    msg.includes("Insufficient") ||
    msg.includes("Invalid return plant") ||
    msg.includes("Invalid target plant") ||
    msg.includes("must be greater than 0") ||
    msg.includes("exceeds available") ||
    msg.includes("Rolling yield cannot exceed") ||
    msg.includes("not found in casting database") ||
    msg.includes("already exists");

  if (isBusinessValidation) {
    return res.status(400).json({
      success: false,
      message: error.message,
      error: "BUSINESS_VALIDATION_ERROR"
    });
  }

  console.error("Unhandled Error Caught:", error);

  const statusCode = 500;
  res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error occurred.",
    error: process.env.NODE_ENV === "development" ? error.stack : undefined
  });
};
