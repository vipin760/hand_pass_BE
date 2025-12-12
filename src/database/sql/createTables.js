const { pool } = require('../../config/database');

async function createTablesIfNotExist() {
  try {
    await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  password_hash TEXT,
  sn VARCHAR(50),
  user_id VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'inmate' CHECK (role IN ('admin', 'superadmin', 'inmate', 'staff', 'guard')),
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
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

  -- device group create
  CREATE TABLE  IF NOT EXISTS access_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  group_name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE  IF NOT EXISTS group_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_allowed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE  IF NOT EXISTS access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE,
  rule_name VARCHAR(100),                -- e.g., "Weekday Shift", "Night Shift"
  is_active BOOLEAN DEFAULT TRUE,
  days JSONB,                            -- ["Mon", "Fri"]
  start_time TIME NOT NULL,              -- "10:00"
  end_time TIME NOT NULL,                -- "18:00"
  allow_cross_midnight BOOLEAN DEFAULT FALSE,   -- TRUE if end < start
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_access_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sn VARCHAR(50) NOT NULL,               -- Device serial number
        name VARCHAR(100) NOT NULL,            -- User name
        user_id VARCHAR(100),                  -- Optional user ID
        palm_type VARCHAR(10) NOT NULL CHECK (palm_type IN ('left', 'right')),
        device_date_time TIMESTAMP NOT NULL,   -- Access time from device
        created_at TIMESTAMP DEFAULT now()     -- Record creation time
      );

      CREATE TABLE IF NOT EXISTS system_info (
  sn VARCHAR(50) PRIMARY KEY NOT NULL,                           -- Device serial number (unique)
  latest_firmware_version VARCHAR(20) NOT NULL DEFAULT '1.0.0', -- Latest firmware version
  firmware_url VARCHAR(255) NOT NULL DEFAULT 'https://example.com/firmware/default.tgz', -- Firmware download URL
  batch_import_url VARCHAR(255) NOT NULL DEFAULT 'https://example.com/batch/default.csv', -- Batch import file URL
  updated_at TIMESTAMP DEFAULT now()                             -- Last update time
);



    `);

    console.log("✅ Tables checked/created successfully.");
  } catch (err) {
    console.error("❌ Failed to create tables:", err);
    throw err;
  }
}


module.exports = { createTablesIfNotExist };
