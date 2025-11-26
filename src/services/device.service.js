const { pool } = require("../config/database");


async function connectDevice(sn, ip,userId) {
    console.log(userId)
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const exists = await client.query(
      "SELECT sn FROM devices WHERE sn = $1",
      [sn]
    );

    if (exists.rowCount === 0) {
      // Insert new device
      await client.query(
        `
        INSERT INTO devices (sn, device_ip, online_status,created_by,updated_by)
        VALUES ($1, $2, 1,$3,$3)
        `,
        [sn, ip,userId]
      );
    } else {
      // Update existing device
      await client.query(
        `
        UPDATE devices
        SET online_status = 1,
            device_ip = $2,
            last_connect_time = now(),
            updated_at = now(),
            updated_by = $3
        WHERE sn = $1
        `,
        [sn, ip,userId]
      );
    }

    await client.query("COMMIT");

    return { status: true, message: "success" };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error connecting device:", err);
    throw err;
  } finally {
    client.release();
  }
}

async function addInmateService(data) {
  const {
    sn,
    inmate_id,
    name,
    image_left,
    image_right,
    wiegand_flag,
    admin_auth
  } = data;

  if (!sn || !inmate_id || !name) {
    return { status: 1, msg: "Missing required fields" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // FIND DEVICE
    const deviceRes = await client.query(
      "SELECT id FROM devices WHERE sn = $1",
      [sn]
    );

    if (deviceRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { status: 1, msg: "Device not found" };
    }

    const device_id = deviceRes.rows[0].id;

    // INSERT INMATE AS USER
    await client.query(
      `
      INSERT INTO users (
        id, name, role, image_left, image_right,
        wiegand_flag, admin_auth, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, 'inmate', $2, $3, $4, $5, now(), now()
      )
      `,
      [name, image_left, image_right, wiegand_flag || 0, admin_auth || 0]
    );

    await client.query("COMMIT");
    return { status: 0, msg: "success" };

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Add inmate error:", err);
    return { status: 1, msg: "DB Error" };
  } finally {
    client.release();
  }
}
module.exports = { connectDevice, addInmateService };
