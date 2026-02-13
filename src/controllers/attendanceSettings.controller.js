const { pool } = require('../config/database');

/**
 * ADD or UPDATE attendance settings
 * (always keep ONE active row)
 */
exports.addOrUpdateSettings = async (req, res) => {
  try {
    const { work_start_time, work_end_time, weekly_holidays } = req.body;

    // validation
    if (!work_start_time || !work_end_time) {
      return res.status(400).json({
        msg: 'work_start_time and work_end_time are required'
      });
    }

    if (!Array.isArray(weekly_holidays)) {
      return res.status(400).json({
        msg: 'weekly_holidays must be an array'
      });
    }

    // deactivate old settings
    await pool.query(`
      UPDATE attendance_settings
      SET is_active = false
    `);

    // insert new active settings
    const result = await pool.query(
      `INSERT INTO attendance_settings
       (work_start_time, work_end_time, weekly_holidays, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [work_start_time, work_end_time, weekly_holidays]
    );

    res.status(201).json({
      msg: 'Attendance settings saved successfully',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('addOrUpdateSettings error:', err);
    res.status(500).json({ msg: 'Internal server error' });
  }
};

/**
 * GET active attendance settings
 */
exports.getSettings = async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM attendance_settings
      WHERE is_active = true
      LIMIT 1
    `);

    if (result.rowCount === 0) {
      return res.json({ data: null });
    }

    res.json({ data: result.rows[0] });

  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ msg: 'Internal server error' });
  }
};

exports.updateActiveStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ msg: 'id is required' });
    }

    await client.query('BEGIN');

    // 1️⃣ Deactivate all
    await client.query(`
      UPDATE attendance_settings
      SET is_active = false
    `);

    // 2️⃣ Activate selected one
    const result = await client.query(
      `UPDATE attendance_settings
       SET is_active = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ msg: 'Attendance setting not found' });
    }

    await client.query('COMMIT');

    res.json({
      msg: 'Attendance setting activated successfully',
      data: result.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateActiveStatus error:', err);
    res.status(500).json({ msg: 'Internal server error' });
  } finally {
    client.release();
  }
};

exports.getAllSettings = async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM attendance_settings
      ORDER BY updated_at DESC
    `);

    res.json({
      count: result.rowCount,
      data: result.rows
    });

  } catch (err) {
    console.error('getAllSettings error:', err);
    res.status(500).json({ msg: 'Internal server error' });
  }
};

// attendance report single userwise
exports.getAttendanceReports = async (req, res) => {
  try {
    const { month, year, user_id } = req.body;


    if (!month || !year) {
      return res.status(400).json({ status: false, message: "month, year and user_id required" });
    }
    if(!user_id){
      const data = await getMonthlySummary(year,month)
      return res.status(200).send({status:true,data});
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // 1️⃣ Get attendance settings
    const settingResult = await pool.query(`
      SELECT work_start_time, work_end_time, weekly_holidays
      FROM attendance_settings
      WHERE is_active = true
      LIMIT 1
    `);

    if (settingResult.rows.length === 0) {
      return res.status(400).json({ status: false, message: "Attendance settings not configured" });
    }

    const settings = settingResult.rows[0];
    const workStartTime = settings.work_start_time;
    const weeklyHolidays = settings.weekly_holidays; // array

    // 2️⃣ Get holidays
    const holidayResult = await pool.query(`
      SELECT holiday_date
      FROM attendance_holidays
      WHERE holiday_date BETWEEN $1 AND $2
    `, [startDate, endDate]);

    const holidays = holidayResult.rows.map(h => h.holiday_date.toISOString().split('T')[0]);

    // 3️⃣ Get user logs grouped by day
    const logResult = await pool.query(`
      SELECT 
        DATE(device_date_time) as log_date,
        MIN(device_date_time) as first_in
      FROM device_access_logs
      WHERE user_id = $1
      AND device_date_time BETWEEN $2 AND $3
      GROUP BY DATE(device_date_time)
      ORDER BY log_date
    `, [user_id, startDate, endDate]);

    const logsMap = {};
    logResult.rows.forEach(row => {
      logsMap[row.log_date.toISOString().split('T')[0]] = row.first_in;
    });

    // 4️⃣ Generate calendar data
    let presentCount = 0;
    let absentCount = 0;
    let workingDays = 0;

    const calendar = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {

      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay(); // 0 = Sunday

      const isHoliday = holidays.includes(dateStr);
      const isWeekOff = weeklyHolidays.includes(dayOfWeek);

      let status = "ABSENT";
      let inTime = null;
      let late = false;

      if (!isHoliday && !isWeekOff) {
        workingDays++;

        if (logsMap[dateStr]) {
          presentCount++;
          status = "PRESENT";
          inTime = logsMap[dateStr];

          const logTime = new Date(inTime);
          const [startHour, startMin] = workStartTime.split(':');

          const officialStart = new Date(dateStr);
          officialStart.setHours(startHour, startMin, 0);

          if (logTime > officialStart) {
            late = true;
          }

        } else {
          absentCount++;
        }
      } else {
        status = "WEEK_OFF";
      }

      calendar.push({
        date: dateStr,
        status,
        inTime,
        late
      });
    }

    const attendanceRate = workingDays === 0
      ? 0
      : ((presentCount / workingDays) * 100).toFixed(2);

    return res.json({
      status: true,
      data: {
        presentCount,
        absentCount,
        workingDays,
        attendanceRate,
        calendar
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const getMonthlySummary=async(year,month)=>{
  try {
     const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Total employees
    const userResult = await pool.query(`
      SELECT COUNT(*) FROM users WHERE role != 'inmate'
    `);

    const totalEmployees = parseInt(userResult.rows[0].count);

    // Presence grouped
    const logResult = await pool.query(`
      SELECT 
        DATE(device_date_time) as log_date,
        COUNT(DISTINCT user_id) as present_count
      FROM device_access_logs
      WHERE device_date_time BETWEEN $1 AND $2
      GROUP BY DATE(device_date_time)
      ORDER BY log_date
    `, [startDate, endDate]);

    const logMap = {};
    logResult.rows.forEach(r => {
      logMap[r.log_date.toISOString().split('T')[0]] = parseInt(r.present_count);
    });

    const data = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      const present = logMap[dateStr] || 0;
      const absent = totalEmployees - present;

      data.push({
        date: dateStr,
        workingDay: true, // you can add holiday logic here
        present,
        absent
      });
    }

    return { status: true, data, message:"monthly report fetched" }
  } catch (error) {
    return { status:false,message:error.message}
  }
}
exports.getDailySummary = async (req, res) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ status: false, message: "month and year required" });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Total employees
    const userResult = await pool.query(`
      SELECT COUNT(*) FROM users WHERE role != 'inmate'
    `);

    const totalEmployees = parseInt(userResult.rows[0].count);

    // Presence grouped
    const logResult = await pool.query(`
      SELECT 
        DATE(device_date_time) as log_date,
        COUNT(DISTINCT user_id) as present_count
      FROM device_access_logs
      WHERE device_date_time BETWEEN $1 AND $2
      GROUP BY DATE(device_date_time)
      ORDER BY log_date
    `, [startDate, endDate]);

    const logMap = {};
    logResult.rows.forEach(r => {
      logMap[r.log_date.toISOString().split('T')[0]] = parseInt(r.present_count);
    });

    const data = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      const present = logMap[dateStr] || 0;
      const absent = totalEmployees - present;

      data.push({
        date: dateStr,
        workingDay: true, // you can add holiday logic here
        present,
        absent
      });
    }

    return res.json({ status: true, data });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};


