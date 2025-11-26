const { pool } = require('../../config/database');

async function createTablesIfNotExist() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  password_hash TEXT,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'superadmin', 'inmate', 'staff', 'guard')),
  image_left TEXT,
  image_right TEXT,
  wiegand_flag INT DEFAULT 0,
  admin_auth INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sn VARCHAR(50) UNIQUE NOT NULL,
  device_name VARCHAR(100),
  device_ip VARCHAR(50),
  online_status SMALLINT NOT NULL DEFAULT 0,
  last_connect_time TIMESTAMP DEFAULT now(),
  firmware_version VARCHAR(20) DEFAULT '1.0.0',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pass_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sn VARCHAR(50) REFERENCES devices(sn) ON DELETE CASCADE,
  name VARCHAR(100),
  inmate_id VARCHAR(50),
  palm_type VARCHAR(10) CHECK (palm_type IN ('left','right')),
  device_date_time VARCHAR(20),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS firmware_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sn VARCHAR(50) REFERENCES devices(sn) ON DELETE CASCADE,
  latest_firmware_version VARCHAR(20) NOT NULL,
  firmware_url TEXT NOT NULL,
  need_upgrade BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batch_import_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sn VARCHAR(50) REFERENCES devices(sn) ON DELETE CASCADE,
  batch_url TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT now()
);

    `);

    console.log("✅ Tables checked/created successfully.");
  } catch (err) {
    console.error("❌ Failed to create tables:", err);
    throw err;
  }
}


module.exports = { createTablesIfNotExist };
