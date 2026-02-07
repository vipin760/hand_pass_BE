const { pool } = require('../../config/database');

async function createTablesIfNotExist() {
  try {
    await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  password_hash TEXT,
  sn VARCHAR(50),
  user_id VARCHAR(100),
  master_user_id VARCHAR(100),
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

CREATE TABLE IF NOT EXISTS attendance_settings (
  id SERIAL PRIMARY KEY,
  work_start_time TIME NOT NULL,
  work_end_time TIME NOT NULL,
  weekly_holidays INT[] NOT NULL, 
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_holidays (
  id SERIAL PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);




    `);

    console.log("✅ Tables checked/created successfully.");
  } catch (err) {
    console.error("❌ Failed to create tables:", err);
    throw err;
  }
}


module.exports = { createTablesIfNotExist };
