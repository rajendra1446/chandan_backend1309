export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const userRole = req.user ? `[User:${req.user.id}|${req.user.role}]` : "[Guest]";
    console.log(
      `[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} - ${duration}ms ${userRole} (IP: ${ip})`
    );
  });

  next();
};

export default requestLogger;
