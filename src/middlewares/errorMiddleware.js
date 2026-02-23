export const errorHandler = (err, req, res, next) => {
  console.error("ERROR:", err);
  
  // Ensure we always return JSON
  res.status(err.status || 500).json({ 
    message: err.message || "Server Error",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
