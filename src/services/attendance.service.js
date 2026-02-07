const { pool } = require('../config/database');

async function getUsersWithoutPunchIn(startTime) {
  const result = await pool.query(`
    SELECT u.id, u.name, u.email
    FROM users u
    LEFT JOIN device_access_logs d
      ON d.user_id = u.user_id
      AND d.device_date_time::date = CURRENT_DATE
      AND d.device_date_time::time <= $1
    WHERE u.email IS NOT NULL
      AND d.id IS NULL
  `, [startTime]);

  return result.rows; // users who did NOT punch
}

module.exports = { getUsersWithoutPunchIn };
