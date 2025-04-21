const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const usbDetect = require("usb-detection");
const { exec } = require("child_process");
const http = require("http");
const socketIo = require("socket.io");
const mysql = require("mysql2");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;
const LOGS_FOLDER = path.join(__dirname, "logs");
const LOG_PATH = path.join(LOGS_FOLDER, "usb_log.csv");

let currentUser = null;
let usbJustRemoved = false;
let formCompleted = false;

// Setup MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "your_mysql_user", // Change this
  password: "your_mysql_password", // Change this
  database: "usb_logs", // Make sure this DB exists
});

db.connect((err) => {
  if (err) {
    console.error("MySQL connection failed:", err);
  } else {
    console.log("Connected to MySQL database.");
  }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Create logs folder if missing
if (!fs.existsSync(LOGS_FOLDER)) {
  fs.mkdirSync(LOGS_FOLDER);
}

// (Optional) Create CSV backup file
if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, "Timestamp,Name,Phone\n");
}

// Handle form submission
app.post("/submit", (req, res) => {
  const { user_name, phone } = req.body;
  const timestamp = new Date().toISOString();

  // Backup log to CSV (optional)
  fs.appendFileSync(LOG_PATH, `"${timestamp}","${user_name}","${phone}"\n`);

  // Save to MySQL
  db.query(
    "INSERT INTO usb_users (timestamp, user_name, phone) VALUES (?, ?, ?)",
    [timestamp, user_name, phone],
    (err) => {
      if (err) {
        console.error("MySQL insert error:", err);
        return res.status(500).send("Database error.");
      }

      currentUser = user_name;
      formCompleted = true;
      enableUSBDrive("D");
      enableUSBDrive("E");
      res.send("Data saved to database. You can now use the USB.");
    }
  );
});

// View logs from database
app.get("/log", (_, res) => {
  db.query(
    "SELECT * FROM usb_users ORDER BY timestamp DESC",
    (err, results) => {
      if (err) {
        console.error("Error fetching logs:", err);
        return res.status(500).send("Failed to fetch logs.");
      }
      res.json(results);
    }
  );
});

// Handle socket connection
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  usbDetect.on("remove", (device) => {
    console.log("USB removed:", device);
    usbJustRemoved = true;
    socket.emit("usb-removed", { removed: usbJustRemoved, user_name: currentUser });
    usbJustRemoved = false;
  });
});

// Start server
server.listen(PORT, () => {
  usbDetect.startMonitoring();

  usbDetect.on("add", (device) => {
    console.log("USB inserted:", device);

    // Hide the drive immediately regardless of form status
    disableUSBDrive("D");
    disableUSBDrive("E");

    // Check if device is storage
    if (
      device.deviceDescriptor &&
      device.deviceDescriptor.deviceClass === 0x08 &&
      device.deviceDescriptor.deviceSubclass === 0x06
    ) {
      console.log("USB is a storage device.");

      if (formCompleted) {
        console.log("Form completed — re-enabling drives.");
        enableUSBDrive("D");
        enableUSBDrive("E");
      } else {
        console.log("Form NOT completed — USB stays hidden.");
      }
    } else {
      console.log("Device is not USB storage or missing descriptor.");
    }

    exec(`start http://localhost:${PORT}`);
  });

  console.log(`Server running at http://localhost:${PORT}`);
});

// Enable drive (using diskpart script)
function enableUSBDrive(driveLetter) {
  const scriptPath = path.join(
    __dirname,
    "scripts",
    `enable_usb_${driveLetter}.txt`
  );
  exec(`diskpart /s ${scriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error enabling ${driveLetter}: ${error}`);
      return;
    }
    console.log(`Enabled ${driveLetter} drive:`, stdout);
    if (stderr) console.error(`stderr: ${stderr}`);
  });
}

// Disable drive (using diskpart script)
function disableUSBDrive(driveLetter) {
  const scriptPath = path.join(
    __dirname,
    "scripts",
    `disable_usb_${driveLetter}.txt`
  );
  exec(`diskpart /s ${scriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error disabling ${driveLetter}: ${error}`);
      return;
    }
    console.log(`Disabled ${driveLetter} drive:`, stdout);
    if (stderr) console.error(`stderr: ${stderr}`);
  });
}
