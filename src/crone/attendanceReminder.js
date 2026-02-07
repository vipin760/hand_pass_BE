const cron = require('node-cron');
const { pool } = require('../config/database');
const { runAttendanceCheck } = require('../jobs/attendance.job');

let attendanceCron = null;

async function startAttendanceCron() {
  console.log('>>> startAttendanceCron CALLED');

  const res = await pool.query(`
    SELECT work_start_time
    FROM attendance_settings
    WHERE is_active = true
    LIMIT 1
  `);

  console.log('>>> DB result:', res.rows);

  if (res.rowCount === 0) {
    console.log('>>> No active attendance setting');
    return;
  }

  const startTime = res.rows[0].work_start_time;
  const timeStr = typeof startTime === 'string'
    ? startTime
    : startTime.toTimeString();

  const [hour, minute] = timeStr.split(':');

  console.log('>>> Scheduling cron at:', hour, minute);

  attendanceCron = cron.schedule(
    `${minute} ${hour} * * *`,
    async () => {
      console.log('🔥🔥 CRON TRIGGERED at', new Date());
      await runAttendanceCheck(startTime);
    },
    {
      timezone: 'Asia/Kolkata'
    }
  );
}

module.exports = { startAttendanceCron };
