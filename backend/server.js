
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Tes server
app.get("/", (req, res) => {
  res.json({ message: "Backend E-Spec berhasil berjalan!" });
});

// Tes koneksi database
app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, NOW() AS server_time"
    );

    res.json({
      message: "Koneksi PostgreSQL berhasil!",
      database: result.rows[0].database,
      serverTime: result.rows[0].server_time,
    });
  } catch (error) {
    console.error("Database error:", error.message);
    res.status(500).json({ message: "Koneksi database gagal." });
  }
});

// Simpan dokumen Barang atau Jasa
app.post("/api/documents", async (req, res) => {
  try {
    const formData = req.body.formData;
    const specType = String(
      req.body.specType || "Barang"
    ).trim();

    // Validasi data formulir
    if (
      !formData ||
      typeof formData !== "object" ||
      Array.isArray(formData)
    ) {
      return res.status(400).json({
        message: "Data formulir tidak valid."
      });
    }

    const isJasa = specType.toLowerCase() === "jasa";

    // Mengambil teks pertama yang tidak kosong
    function firstNonEmptyText(values) {
      for (const value of values) {
        if (
          (typeof value === "string" ||
            typeof value === "number") &&
          String(value).trim() !== ""
        ) {
          return String(value).trim();
        }
      }

      return "";
    }

    let materialDescription = "";

    if (isJasa) {
      // Cari nama atau deskripsi jasa dari beberapa kemungkinan nama field
      materialDescription = firstNonEmptyText([
        formData.serviceName,
        formData.serviceTitle,
        formData.serviceDescription,
        formData.namaJasa,
        formData.jasaName,
        formData.judulJasa,
        formData.jenisJasa,
        formData.namaLayanan,
        formData.jenisLayanan,
        formData.description,
        formData.materialDescription
      ]);

      // Pencarian tambahan berdasarkan nama field
      if (!materialDescription) {
        const jasaField = Object.entries(formData).find(
          ([key, value]) =>
            /^(service(name|title|description)?|jasa(name|title|description)?|nama(jasa|layanan)|jenis(jasa|layanan))$/i.test(key) &&
            typeof value === "string" &&
            value.trim() !== ""
        );

        if (jasaField) {
          materialDescription = jasaField[1].trim();
        }
      }

      // Fallback agar formulir Jasa tetap bisa disimpan
      if (!materialDescription) {
        materialDescription = "Spesifikasi Jasa";
      }

    } else {
      // Barang tetap wajib mengisi Material Description
      materialDescription = String(
        formData.materialDescription || ""
      ).trim();

      if (!materialDescription) {
        return res.status(400).json({
          message: "Material Description wajib diisi."
        });
      }
    }

    // Simpan jenis spesifikasi bersama data formulir
    const savedFormData = {
      ...formData,
      specType: isJasa ? "Jasa" : "Barang"
    };

    console.log("Jenis spesifikasi:", savedFormData.specType);
    console.log("Deskripsi dokumen:", materialDescription);
    console.log("Nilai revisionDate:", formData.revisionDate);
    console.log("Nilai createdDate:", formData.createdDate);

    const result = await pool.query(
      `INSERT INTO spec_documents (
        doc_no,
        revision,
        revision_date,
        plant,
        requestor,
        department,
        material_group,
        material_category,
        category,
        reason,
        location,
        material_description,
        material_code,
        form_data,
        status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING id, doc_no, material_description, status, created_at`,
      [
        formData.docNo || null,
        formData.revision || null,
        formData.revisionDate || null,
        formData.plant || null,
        formData.requestor || null,
        formData.department || null,
        formData.materialGroup || null,
        formData.materialCategory || null,
        Array.isArray(formData.category)
          ? formData.category.join(", ")
          : formData.category || null,
        formData.reason || null,
        formData.location || null,
        materialDescription,
        formData.materialCode || null,
        JSON.stringify(savedFormData),
        "Draft"
      ]
    );

    res.status(201).json({
      message: isJasa
        ? "Spesifikasi Jasa berhasil disimpan."
        : "Spesifikasi Barang berhasil disimpan.",
      document: result.rows[0]
    });

  } catch (error) {
    console.error("Gagal menyimpan dokumen:", error);

    res.status(500).json({
      message: "Gagal menyimpan dokumen ke database.",
      error: error.message
    });
  }
});

// Ambil daftar dokumen
app.get("/api/documents", async (req, res) => {
  try {
    const result = await pool.query(
  `SELECT id, doc_no, revision, plant, requestor,
          material_description, material_code, status,
          created_at, updated_at,
          COALESCE(form_data->>'specType', 'Barang') AS spec_type
   FROM spec_documents
   ORDER BY created_at DESC`
);

    res.json({ documents: result.rows });
  } catch (error) {
    console.error("Gagal mengambil dokumen:", error.message);
    res.status(500).json({
      message: "Gagal mengambil daftar dokumen.",
    });
  }
});

// Ambil satu dokumen beserta seluruh data formulir
app.get("/api/documents/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        message: "ID dokumen tidak valid.",
      });
    }

    const result = await pool.query(
      "SELECT * FROM spec_documents WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Dokumen tidak ditemukan.",
      });
    }

    res.json({ document: result.rows[0] });
  } catch (error) {
    console.error("Gagal mengambil detail:", error.message);
    res.status(500).json({
      message: "Gagal mengambil detail dokumen.",
    });
  }
});


/**
 * DELETE /api/documents/:id
 * Menghapus satu dokumen dari PostgreSQL berdasarkan ID.
 */
app.delete("/api/documents/:id", async (req, res) => {
  const id = req.params.id;

// Validasi ID agar hanya menerima bilangan bulat positif.
  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      error: "ID dokumen tidak valid."
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM spec_documents
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Dokumen tidak ditemukan."
      });
    }

    return res.json({
      message: "Dokumen berhasil dihapus.",
      id: result.rows[0].id
    });
  } catch (error) {
    console.error("Gagal menghapus dokumen:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan saat menghapus dokumen."
    });
  }
});


app.listen(PORT, () => {
  console.log(`Server E-Spec berjalan di http://localhost:${PORT}`);
});