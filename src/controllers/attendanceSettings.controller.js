const { pool } = require('../config/database');

exports.processAttendance = async () => {
  try {

    const query = `
    INSERT INTO attendance_records
    (user_id, sn, attendance_date, check_in, check_out, work_minutes, status)

    SELECT
      user_id,
      sn,
      DATE(device_date_time),
      MIN(device_date_time),
      MAX(device_date_time),
      EXTRACT(EPOCH FROM (MAX(device_date_time) - MIN(device_date_time)))/60,

      CASE
        WHEN MIN(device_date_time)::time > '09:15' THEN 'late'
        ELSE 'present'
      END

    FROM device_access_logs
    GROUP BY user_id, sn, DATE(device_date_time)

    ON CONFLICT (user_id, attendance_date)
    DO UPDATE SET
      check_in = EXCLUDED.check_in,
      check_out = EXCLUDED.check_out,
      work_minutes = EXCLUDED.work_minutes,
      status = EXCLUDED.status,
      updated_at = now()
    `;

    await pool.query(query);

    console.log("Attendance processed");

  } catch (error) {
    console.error("Attendance processing failed", error);
  }
};