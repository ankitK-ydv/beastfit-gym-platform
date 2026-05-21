
console.log("🔥 THIS SERVER.JS FILE IS RUNNING 🔥");
const fs = require("fs");
const path = require("path");
require("dotenv").config(); // Load environment variables

// 🔹 Ensure data folder exists (Render/Linux fix)
const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 🔹 Ensure uploads folder exists
const UPLOADS_DIR = path.join(__dirname, "uploads", "homepage");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const multer = require("multer");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");

const app = express();
let submissions = [];

const DATA_FILE = path.join(DATA_DIR, "submissions.json");

if (fs.existsSync(DATA_FILE)) {
  submissions = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

const TEXT_DATA = path.join(DATA_DIR, "homepage-text.json");

if (!fs.existsSync(TEXT_DATA)) {
  fs.writeFileSync(TEXT_DATA, JSON.stringify({}, null, 2));
}

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "beastfit_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: NODE_ENV === "production", // Use secure cookies in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

// ================= ADMIN CREDENTIALS =================
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "12345";

// ================= IMAGE STORAGE =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/homepage");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Only allow images
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

// ================= SAVE TEXT API =================
app.post("/admin/save-text", checkAuth, (req, res) => {
  try {
    const existing = JSON.parse(fs.readFileSync(TEXT_DATA, "utf8"));

    const updated = {
      ...existing,
      ...req.body
    };

    if (NODE_ENV !== "production") {
      fs.writeFileSync(TEXT_DATA, JSON.stringify(updated, null, 2));
    }

    res.json({ success: true, message: "Text updated successfully" });
  } catch (error) {
    console.error("Error saving text:", error);
    res.status(500).json({ success: false, message: "Error saving text" });
  }
});

// ================= READ TEXT API =================
app.get("/homepage-text", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(TEXT_DATA, "utf8"));
    res.json(data);
  } catch (error) {
    console.error("Error reading text:", error);
    res.status(500).json({ error: "Could not read text data" });
  }
});

// ================= FORM SUBMISSION =================
app.post("/contact", (req, res) => {
  try {
    const { fullName, phone, plan, goal } = req.body;

    // Basic validation
    if (!fullName || !phone) {
      return res.status(400).json({
        success: false,
        message: "Full name and phone are required"
      });
    }

    const entry = {
      fullName,
      phone,
      plan: plan || "N/A",
      goal: goal || "N/A",
      date: new Date().toLocaleString()
    };

    submissions.push(entry);

    if (NODE_ENV !== "production") {
      fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
    }

    res.status(200).json({ success: true, message: "Form submitted successfully" });
  } catch (error) {
    console.error("Error submitting form:", error);
    res.status(500).json({ success: false, message: "Error submitting form" });
  }
});

// ================= ADMIN LOGIN =================
app.post("/admin-login", (req, res) => {
  try {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      return res.json({ success: true, message: "Login successful" });
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Login error" });
  }
});

// ================= AUTH MIDDLEWARE =================
function checkAuth(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

// ================= IMAGE UPLOAD (ADMIN ONLY) =================
const IMAGE_DATA = path.join(DATA_DIR, "homepage-images.json");

if (!fs.existsSync(IMAGE_DATA)) {
  fs.writeFileSync(
    IMAGE_DATA,
    JSON.stringify(
      {
        athlete: "",
        img1: "",
        img2: "",
        img3: ""
      },
      null,
      2
    )
  );
}

app.post("/admin/upload-image", checkAuth, upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const images = JSON.parse(fs.readFileSync(IMAGE_DATA, "utf8"));
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({ success: false, message: "Image type required" });
    }

    images[type] = `/uploads/homepage/${req.file.filename}`;

    if (NODE_ENV !== "production") {
      fs.writeFileSync(IMAGE_DATA, JSON.stringify(images, null, 2));
    }

    res.json({ success: true, message: "Image uploaded successfully", path: images[type] });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ success: false, message: "Error uploading image" });
  }
});

// ================= GET HOMEPAGE IMAGES =================
app.get("/homepage-images", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(IMAGE_DATA, "utf8"));
    res.json(data);
  } catch (error) {
    console.error("Error reading images:", error);
    res.status(500).json({ error: "Could not read images data" });
  }
});

// ================= ADMIN DATA (PROTECTED) =================
app.get("/admin/data", checkAuth, (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    res.json(data);
  } catch (error) {
    console.error("Error reading data:", error);
    res.status(500).json({ error: "Could not read data" });
  }
});

// ================= ADMIN PAGE (PROTECTED) =================
app.get("/adminlogin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "adminlogin.html"));
});

app.get("/admin.html", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "private", "admin.html"));
});

// ================= LOGOUT =================
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Logout error" });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// ================= EXPORT FORM SUBMISSIONS TO EXCEL =================
const XLSX = require("xlsx");

app.get("/admin/export-excel", checkAuth, (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    if (!data || data.length === 0) {
      return res.status(400).json({ success: false, message: "No data to export" });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Form Submissions");

    const filePath = path.join(__dirname, "BeastFit_Form_Submissions.xlsx");

    XLSX.writeFile(workbook, filePath);

    res.download(filePath, "BeastFit_Form_Submissions.xlsx", (err) => {
      if (!err && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath); // Cleanup
      }
    });
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    res.status(500).json({ success: false, message: "Error exporting data" });
  }
});

// ================= STATIC FILES =================
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ================= DELETE SELECTED RECORDS =================
app.post("/admin/delete-selected", checkAuth, (req, res) => {
  try {
    const { indexes } = req.body;

    if (!Array.isArray(indexes)) {
      return res.status(400).json({ success: false, message: "Invalid indexes" });
    }

    submissions = submissions.filter((_, i) => !indexes.includes(i));

    if (NODE_ENV !== "production") {
      fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
    }

    res.json({ success: true, message: "Records deleted successfully" });
  } catch (error) {
    console.error("Error deleting records:", error);
    res.status(500).json({ success: false, message: "Error deleting records" });
  }
});

// ================= DELETE ALL RECORDS =================
app.post("/admin/delete-all", checkAuth, (req, res) => {
  try {
    submissions = [];

    if (NODE_ENV !== "production") {
      fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
    }

    res.json({ success: true, message: "All records deleted successfully" });
  } catch (error) {
    console.error("Error deleting all records:", error);
    res.status(500).json({ success: false, message: "Error deleting all records" });
  }
});

// ================= PRICE MANAGEMENT =================
const PRICE_FILE = path.join(DATA_DIR, "prices.json");

if (!fs.existsSync(PRICE_FILE)) {
  fs.writeFileSync(
    PRICE_FILE,
    JSON.stringify(
      {
        monthly: "1500",
        quarterly: "4000",
        yearly: "12000"
      },
      null,
      2
    )
  );
}

// Get prices (public)
app.get("/homepage-prices", (req, res) => {
  try {
    const prices = JSON.parse(fs.readFileSync(PRICE_FILE, "utf8"));
    res.json(prices);
  } catch (error) {
    console.error("Error reading prices:", error);
    res.status(500).json({ error: "Could not read prices" });
  }
});

// Save prices (admin)
app.post("/admin/save-prices", checkAuth, (req, res) => {
  try {
    const existing = JSON.parse(fs.readFileSync(PRICE_FILE, "utf8"));

    const updated = {
      ...existing,
      ...req.body
    };

    if (NODE_ENV !== "production") {
      fs.writeFileSync(PRICE_FILE, JSON.stringify(updated, null, 2));
    }

    res.json({ success: true, message: "Prices updated successfully" });
  } catch (error) {
    console.error("Error saving prices:", error);
    res.status(500).json({ success: false, message: "Error saving prices" });
  }
});

// ================= TEST ROUTE =================
app.get("/test-route", (req, res) => {
  res.send("TEST ROUTE WORKS ✅");
});

// ================= HOME PAGE =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================= ERROR HANDLING =================
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

// ================= 404 HANDLER =================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// ================= START SERVER =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`🌍 Homepage: http://localhost:${PORT}`);
});
  const entry = {
    fullName: req.body.fullName,
    phone: req.body.phone,
    plan: req.body.plan,
    goal: req.body.goal,
    date: new Date().toLocaleString()
  };

  submissions.push(entry);
 if (process.env.NODE_ENV !== "production") {
  fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
}

  // ✅ IMPORTANT CHANGE
  res.status(200).json({ success: true });
});


// ================= ADMIN LOGIN =================
app.post("/admin-login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  } else {
    return res.status(401).json({
      success: false,
      message: "Invalid username or password"
    });
  }
});


// ================= AUTH MIDDLEWARE =================
function checkAuth(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect("/adminlogin.html");
  }
}

// ================= IMAGE UPLOAD (ADMIN ONLY) =================
const IMAGE_DATA = path.join(DATA_DIR, "homepage-images.json");

if (!fs.existsSync(IMAGE_DATA)) {
  fs.writeFileSync(
    IMAGE_DATA,
    JSON.stringify(
      {
        athlete: "",
        img1: "",
        img2: "",
        img3: ""
      },
      null,
      2
    )
  );
}

app.post("/admin/upload-image", checkAuth, upload.single("image"), (req, res) => {
  const images = JSON.parse(fs.readFileSync(IMAGE_DATA));
  const { type } = req.body;

  images[type] = `/uploads/homepage/${req.file.filename}`;

if (process.env.NODE_ENV !== "production") {
  fs.writeFileSync(IMAGE_DATA, JSON.stringify(images, null, 2));
}
  res.json({ success: true });
});

// ================= HOMEPAGE IMAGES =================
app.get("/homepage-images", (req, res) => {
  const data = JSON.parse(fs.readFileSync(IMAGE_DATA));
  res.json(data);
});



// ================= ADMIN DATA (PROTECTED) =================
app.get("/admin/data", checkAuth, (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  res.json(data);
});

// ================= ADMIN PAGE (PROTECTED) =================
app.get("/adminlogin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "adminlogin.html"));
});

app.get("/admin.html", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "private", "admin.html"));
});


// ================= LOGOUT =================
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/adminlogin.html");
  });
});


// ===== EXPORT FORM SUBMISSIONS TO EXCEL =====
const XLSX = require("xlsx");

app.get("/admin/export-excel", checkAuth, (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));



  if (!data || data.length === 0) {
    return res.status(400).send("No data to export");
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Form Submissions");

  const filePath = path.join(__dirname, "BeastFit_Form_Submissions.xlsx");

  XLSX.writeFile(workbook, filePath);

  res.download(filePath, "BeastFit_Form_Submissions.xlsx", err => {
    if (!err && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // cleanup
    }
  });
});


// ================= STATIC FILES =================
app.use(express.static("public"));




app.use("/uploads", express.static(path.join(__dirname, "uploads")));




// Delete selected records

app.post("/admin/delete-selected", checkAuth, (req, res) => {
  const indexes = req.body.indexes;

  submissions = submissions.filter((_, i) => !indexes.includes(i));

 if (process.env.NODE_ENV !== "production") {
  fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
}
  res.json({ success: true });
});


// Delete all records
 
app.post("/admin/delete-all", checkAuth, (req, res) => {
  submissions = [];

  if (process.env.NODE_ENV !== "production") {
  fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
}

  res.json({ success: true });
});



//PRICE APIs

const PRICE_FILE = path.join(DATA_DIR, "prices.json");

if (!fs.existsSync(PRICE_FILE)) {
  fs.writeFileSync(
    PRICE_FILE,
    JSON.stringify(
      {
        monthly: "1500",
        quarterly: "4000",
        yearly: "12000"
      },
      null,
      2
    )
  );
}

// Get prices (homepage)
app.get("/homepage-prices", (req, res) => {
  const prices = JSON.parse(fs.readFileSync(PRICE_FILE, "utf8"));
  res.json(prices);
});

// Save prices (admin)
app.post("/admin/save-prices", checkAuth, (req, res) => {
  const existing = JSON.parse(fs.readFileSync(PRICE_FILE, "utf8"));

  const updated = {
    ...existing,
    ...req.body
  };

  if (process.env.NODE_ENV !== "production") {
  fs.writeFileSync(PRICE_FILE, JSON.stringify(updated, null, 2));
}

  res.json({ success: true });
});


app.get("/test-route", (req, res) => {
  res.send("TEST ROUTE WORKS");
});


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});



app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});



