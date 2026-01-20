// file: cron/markOfflineDevices.js
const cron = require('node-cron');
const { pool } = require('../config/database');
const { runAttendanceCheck } = require("../jobs/attendance.job")

// Runs every 2 minutes – extremely accurate and survives server restarts
cron.schedule('* * * * *', async () => {
    console.log("crone job starting")
    try {
        const result = await pool.query(`
          UPDATE devices 
          SET online_status = 0, updated_at = NOW()
          WHERE online_status = 1 
            AND last_connect_time < NOW() - INTERVAL '10 seconds' RETURNING*
        `);
        // const result = await pool.query(`SELECT * FROM devices WHERE online_status=1`)
        console.log("<><>result", result.rows)
        const attendanceData = await pool.query(`SELECT work_start_time FROM attendance_settings WHERE is_active = true LIMIT 1`);
        if(attendanceData.rows.length != 0){
            const now  = new Date()
            const currentHMM = String(now.getHours()).padStart(2,'0') +":"+ String(now.getMinutes()).padStart(2,'0')+":"+String(now.getSeconds()).padStart(2,"0");
            const dbHmm = attendanceData.rows[0].work_start_time
                console.log("<><>dbHmm",dbHmm,"===",currentHMM)
                await runAttendanceCheck(attendanceData.rows[0].work_start_time)
            if(dbHmm === currentHMM){
               await runAttendanceCheck(attendanceData.rows[0].work_start_time)
            }
        }

        if (result.rowCount > 0) {
            console.log(`Marked ${result.rowCount} device(s) offline – no heartbeat in 5 min`);
        }
    } catch (err) {
        console.error('Offline cron failed:', err);
    }
});

exports.restartDatabase = async () => {
    try {
        const result = await pool.query(`SELECT * FROM devices WHERE online_status=0`)
        console.log("<><>result", result.rows)
    } catch (error) {
        console.log("<><>working")
    }
}