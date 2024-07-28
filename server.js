import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "./server/config.js";
import routes from "./server/routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app and create HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Increase payload size limit
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// File upload endpoint
app.post("/api/upload-file", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }
  res.json({
    path: req.file.path,
    originalName: req.file.originalname,
    filename: req.file.filename,
  });
});

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(config.API_KEY);

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("A user connected");
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// Set up API routes
app.use("/api", routes(genAI, upload, io));

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
