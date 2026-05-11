import "./config/env.js";
import app from "./app.js";
import "./jobs/reminderJob.js"; // Import the reminder job to start the cron job


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
