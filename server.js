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
const io = socketIo(server); // Socket.io instanciranje

const PORT = 3000;

const LOGS_FOLDER = path.join(__dirname, "logs");
const LOG_PATH = path.join(LOGS_FOLDER, "usb_log.csv");

let currentUser = null;
let usbJustRemoved = false;

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
  res.send("Data saved. You can now use the USB.");
});

app.get("/log", (req, res) => {
  const csv = fs.readFileSync(LOG_PATH, "utf-8");
  const lines = csv.trim().split("\n").slice(1);
  const rows = lines.map((line) =>
    line.split(",").map((cell) => cell.replace(/\"/g, ""))
  );
  res.json(rows);
});

// Socket.io: obavesti klijenta kada je USB uklonjen
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  // Detekcija uklanjanja USB-a
  usbDetect.on("remove", (device) => {
    console.log("USB removed:", device);
    usbJustRemoved = true;
    socket.emit("usb-removed", { removed: usbJustRemoved, name: currentUser });
    usbJustRemoved = false; // Resetovanje nakon slanja obaveštenja
  });
});

server.listen(PORT, () => {
  usbDetect.startMonitoring();

  usbDetect.on("add", (device) => {
    console.log("USB inserted:", device);
    exec(`start http://localhost:${PORT}`);
  });

  console.log(`Server running at http://localhost:${PORT}`);
});
