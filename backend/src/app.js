const express = require("express");
const cors = require("cors");
const plantRoutes = require("./routes/plant.routes");
const departmentRoutes = require("./routes/department.routes");
const materialGroupRoutes = require("./routes/material-group.routes");
const materialCategoryRoutes = require("./routes/material-category.routes");
const reasonToProcureRoutes = require("./routes/reason-to-procure.routes");
const specificationRoutes = require("./routes/specification.routes");
const specificationTypeRoutes = require("./routes/specification-type.routes");
const authRoutes = require("./routes/auth.routes");
const approvalRoutes = require("./routes/approval.routes");

// Import routes
const healthRoutes = require("./routes/health.routes");

// Import middleware
const notFoundMiddleware = require("./middlewares/not-found.middleware");
const errorMiddleware = require("./middlewares/error.middleware");

// Inisialisasi Express
const app = express();

// Middleware utama
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check server
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend E-Spec berjalan dengan Nodemon!",
  });
});

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/plants", plantRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/material-groups", materialGroupRoutes);
app.use("/api/material-categories", materialCategoryRoutes);
app.use("/api/reason-to-procure", reasonToProcureRoutes);
app.use("/api/specifications", specificationRoutes);
app.use("/api/specification-types", specificationTypeRoutes);

// Middleware 404
app.use(notFoundMiddleware);

// Error handler (harus paling akhir)
app.use(errorMiddleware);

module.exports = app;
