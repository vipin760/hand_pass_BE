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
  inmate_id VARCHAR(100),
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
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

  -- device group create
  CREATE TABLE  IF NOT EXISTS access_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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




    `);

    console.log("✅ Tables checked/created successfully.");
  } catch (err) {
    console.error("❌ Failed to create tables:", err);
    throw err;
  }
}


module.exports = { createTablesIfNotExist };
