const { pool } = require("../config/database")
const userData = require("../data/data")
const { validationResult } = require("express-validator")
const fs = require('fs');
const path = require('path');
const ERR = require("../utils/errorCodes");

exports.fetchAllUsers = async(req , res)=>{
    try {
        const usersData = await pool.query('SELECT * FROM users')
        return res.status(200).send({status:true,data:usersData.rows})
    } catch (error) {
        return res.status(500).send({status:false,message:"internal server down"})
    }
}

exports.addUserData = async (req, res) => {
  console.log("<><>working add user data")
   console.log("<><>req.body",req.body)
  try {
     const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.json({ ...ERR.PARAM_ERROR, errors: errors.array() });
    }
    // const { sn, id, name, image_left, image_right, wiegand_flag = 0, admin_auth = 0 } = req.body;
   
    const { sn, id, name, image_left, image_right, wiegand_flag = 0, admin_auth = 0 } = req.body;
    // 1. Basic validation
    if (!sn || !id || !name || !image_left || !image_right) {
      return res.json({ code: 1, msg: "Missing required fields" });
    }

    // 2. Optional: Save raw files for debugging
    const saveDir = path.join(__dirname, '../../uploads/palm_raw');
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    const timestamp = Date.now();
    const saveFile = (base64, side) => {
      try {
        const buffer = Buffer.from(base64.split('base64,')[1] || base64, 'base64');
        const filename = `${sn}_${id}_${side}_${timestamp}.raw`;
        fs.writeFileSync(path.join(saveDir, filename), buffer);
        console.log(`Saved ${side} palm raw: ${filename}`);
      } catch (e) {
        console.warn("Save raw failed:", e.message);
      }
    };

    saveFile(image_left, 'left');
    saveFile(image_right, 'right');

    // 3. Check if already registered on this device
    const { rows: exists } = await pool.query(
      `SELECT 1 FROM users WHERE sn = $1 AND user_id = $2 LIMIT 1`,
      [sn, id]
    );

    if (exists.length > 0) {
      return res.json({ code: 1, msg: "User already registered on this device" });
    }

    // 4. Save to database (raw base64 - same as old system)
    await pool.query(`
      INSERT INTO users (
        sn,role, user_id, name,
        image_left, image_right,
        wiegand_flag, admin_auth,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7,$8, NOW(), NOW())
    `, [sn,role="inmate", id, name, image_left, image_right, wiegand_flag, admin_auth]);

    console.log(`Palm registered: ${name} (${id}) on device ${sn}`);
    return res.json({ code: 0, msg: "success" });

  } catch (error) {
    console.log("<><>addUserData failed:", error);
    return res.json({ code: 1, msg: "Registration failed" });
  }
};

exports.addUserData1 = async (req, res) => {
  console.log("<><>working add user data")
   console.log("<><>req.body",req.body)
};