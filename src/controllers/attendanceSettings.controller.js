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
