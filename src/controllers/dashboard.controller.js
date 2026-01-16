const { pool } = require("../config/database");

exports.fetchDashboard = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const [
      totalUsers,
      activeDevices,
      todayGranted,
      todayDenied,
      logs
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users`),
      pool.query(`SELECT COUNT(*) FROM devices WHERE online_status = 1`),
      pool.query(`
        SELECT COUNT(*) 
        FROM group_users 
        WHERE is_allowed = true 
        AND DATE(created_at) = CURRENT_DATE
      `),
      pool.query(`
        SELECT COUNT(*) 
        FROM group_users 
        WHERE is_allowed = false 
        AND DATE(created_at) = CURRENT_DATE
      `),
      pool.query(`
        SELECT *
        FROM device_access_logs
        ORDER BY device_date_time DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset])
    ]);

    return res.status(200).json({
      status: true,
      data: {
        totalUsers: Number(totalUsers.rows[0].count),
        activeDevices: Number(activeDevices.rows[0].count),
        todayGranted: Number(todayGranted.rows[0].count),
        todayDenied: Number(todayDenied.rows[0].count),
        recentLogs: logs.rows
      }
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
};
