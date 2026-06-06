require("dotenv").config();
const express = require("express");

// Import your generated Auth routes
const authRoutes = require("./src/modules/auth/auth.routes.js");

const app = express();

// Middleware to parse incoming JSON payloads
app.use(express.json());

// Mount the Auth routes under the /api/auth prefix
app.use("/api/auth", authRoutes);

// Global Error Handler
// Your CLI was told to pass errors via next(error). This catches them.
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors || [],
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 VendorBridge Server is running on port ${PORT}`);
});
