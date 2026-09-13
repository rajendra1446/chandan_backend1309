import dotenv from "dotenv";

dotenv.config();

import app from "./app.js";
import { connectDB } from "./dbConfig/db.js";
import { initDb } from "./dbConfig/initDb.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    console.log("Database connection successful");

    // Initialize collections, indexes and seed demo data
    await initDb();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
};

startServer();