const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const usbDetect = require("usb-detection");
const { exec } = require("child_process");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;
const LOGS_FOLDER = path.join(__dirname, "logs");
const LOG_PATH = path.join(LOGS_FOLDER, "usb_log.csv");

let currentUser = null;
let usbJustRemoved = false;
let formCompleted = false;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(LOGS_FOLDER)) {
  fs.mkdirSync(LOGS_FOLDER);
}

if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(LOG_PATH, "Timestamp,Name,Phone\n");
}

app.post("/submit", (req, res) => {
  const { name, phone } = req.body;
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_PATH, `"${timestamp}","${name}","${phone}"\n`);
  currentUser = name;
  formCompleted = true; // Kada je forma popunjena, omogućavamo USB pristup

  // Pozivanje skripti za omogućavanje pristupa za D: i E: drive
  enableUSBDrive("D");
  enableUSBDrive("E");

  res.send("Data saved. You can now use the USB.");
});

app.get("/log", (_, res) => {
  const csv = fs.readFileSync(LOG_PATH, "utf-8");
  const lines = csv.trim().split("\n").slice(1);
  const rows = lines.map((line) =>
    line.split(",").map((cell) => cell.replace(/\"/g, ""))
  );
  res.json(rows);
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  usbDetect.on("remove", (device) => {
    console.log("USB removed:", device);
    usbJustRemoved = true;
    socket.emit("usb-removed", { removed: usbJustRemoved, name: currentUser });
    usbJustRemoved = false;
  });
});

// Pokreni monitoring USB uređaja
server.listen(PORT, () => {
  usbDetect.startMonitoring();

  usbDetect.on("add", (device) => {
    console.log("USB inserted:", device);

    // Provera da li je uređaj USB storage
    if (
      device.deviceDescriptor &&
      device.deviceDescriptor.deviceClass === 0x08 &&
      device.deviceDescriptor.deviceSubclass === 0x06
    ) {
      console.log("USB is a storage device.");

      // Ako forma nije popunjena, blokiraj pristup i pokreni skriptu za onemogućavanje pristupa
      if (!formCompleted) {
        console.log(
          "USB detected but form not completed. Blocking USB access."
        );
        disableUSBDrive("D");
        disableUSBDrive("E");
      }
    } else {
      console.log("USB is not a storage device or lacks device descriptor.");
    }

    exec(`start http://localhost:${PORT}`);
  });

  console.log(`Server running at http://localhost:${PORT}`);
});

// Funkcija za omogućavanje USB diska
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

// Funkcija za onemogućavanje USB diska
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
