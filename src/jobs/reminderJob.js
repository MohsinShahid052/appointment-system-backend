import cron from "node-cron";
import { scanAndSendReminders } from "../controllers/notificationController.js";

// Fake req/res/next for controller
const fakeReq = {};
const fakeRes = {
  json: (data) => console.log("[CRON RESULT]", data),
};
const fakeNext = (err) => {
  if (err) console.error("[CRON ERROR]", err);
};

// 1️⃣ RUN IMMEDIATELY ON STARTUP
(async () => {
  console.log("[CRON] Running reminder scan immediately...");
  await scanAndSendReminders(fakeReq, fakeRes, fakeNext);
})();

// 2️⃣ SCHEDULE HOURLY (you can change later)
cron.schedule("0 * * * *", async () => {
  console.log("[CRON] Running scheduled reminder scan...");
  await scanAndSendReminders(fakeReq, fakeRes, fakeNext);
});
