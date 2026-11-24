const app = require("./src/app");
const env = require("./src/config/env");

// Menjalankan server
const server = app.listen(env.PORT, () => {
  console.log(
    `Server E-Spec berjalan di http://localhost:${env.PORT}`
  );
});

// Menangani error saat server berjalan
server.on("error", (error) => {
  console.error("Server gagal dijalankan:", error.message);
});

// Menangani penghentian server dengan baik
process.on("SIGINT", () => {
  console.log("\nServer E-Spec sedang dihentikan...");
  server.close(() => {
    console.log("Server berhasil dihentikan.");
    process.exit(0);
  });
});