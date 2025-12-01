const { pool } = require("../config/database");
const { connectDevice, addInmateService } = require("../services/device.service");

// exports.connectDeviceController = async(req , res)=>{
//   // const { id } = req.user
//    try {
//     const { sn } = req.body;

//     if (!sn) {
//       return res.status(400).json({ status: 1, msg: "sn is required" });
//     }

//     // Extract device IP (format fix for ::ffff:127.0.0.1)
//     const deviceIp = req.ip.replace("::ffff:", "");

//     const result = await connectDevice(sn, deviceIp,id);

//     res.json(result);
//   } catch (error) {
//     console.error("Connect API error:", error);
//     res.status(500).json({ status: 1, msg: "internal server error" });
//   }
// }
exports.connectDeviceController = async (req, res) => {
  try {
    const { sn } = req.body;

    if (!sn) {
      return res.status(400).json({ code: 1, msg: "sn is required" });
    }

    const deviceIp = req.ip.replace("::ffff:", "");

    await connectDevice(sn, deviceIp);

    return res.json({ code: 0, msg: "success" });

  } catch (error) {
    console.error("Connect API error:", error);
    return res.status(500).json({ code: 1, msg: "internal server error" });
  }
};

exports.fetchAllConnectDevices = async(req ,res)=>{
  try {
    const { page = 1, limit = 10, search = "", status, sort_by = "created_at", sort_order = "DESC" } = req.query;
     const offset = (page - 1) * limit;
       let where = [];
    let params = [];
    let idx = 1;
     if (search) {
      where.push(`(sn ILIKE $${idx} OR device_name ILIKE $${idx} OR device_ip ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (status === "0" || status === "1") {
      where.push(`online_status = $${idx}`);
      params.push(status);
      idx++;
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const allowedSort = ["sn", "device_name", "device_ip", "online_status", "created_at", "updated_at"];
    const sortField = allowedSort.includes(sort_by) ? sort_by : "created_at";
    const sortOrder = sort_order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const query = `
      SELECT id, sn, device_name, device_ip, online_status,
             last_connect_time, firmware_version,
             created_by, updated_by, created_at, updated_at
      FROM devices
      ${whereSQL}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const dataParams = [...params, limit, offset];

    const devices = await pool.query(query, dataParams);

    const totalQuery = `
      SELECT COUNT(*) AS total
      FROM devices
      ${whereSQL}
    `;

    const total = await pool.query(totalQuery, params);

    return res.json({
      status: true,
      message: "Devices fetched successfully",
      pagination: {
        total: Number(total.rows[0].total),
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total.rows[0].total / limit)
      },
      data: devices.rows
    });

  } catch (error) {
    console.log("<><>error",error.message)
    return res.status(500).send({status:false, message:"internal server down"})
  }
}

exports.updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const body = req.body;

    if (!id) {
      return res.status(400).json({ status: false, message: "Device ID required" });
    }

    let setQuery = "";
    let values = [];
    let i = 1;

    // 🔥 IF case updates (no loops)
    if (body.sn) {
      setQuery += `sn = $${i}, `;
      values.push(body.sn);
      i++;
    }

    if (body.device_name) {
      setQuery += `device_name = $${i}, `;
      values.push(body.device_name);
      i++;
    }

    if (body.device_ip) {
      setQuery += `device_ip = $${i}, `;
      values.push(body.device_ip);
      i++;
    }

    if (body.online_status !== undefined) {
      setQuery += `online_status = $${i}, `;
      values.push(body.online_status);
      i++;
    }

    if (body.firmware_version) {
      setQuery += `firmware_version = $${i}, `;
      values.push(body.firmware_version);
      i++;
    }

    // Nothing to update
    if (setQuery === "") {
      return res.status(400).json({
        status: false,
        message: "No fields to update"
      });
    }

    // Add updated_by + updated_at
    setQuery += `updated_by = $${i}, `;
    values.push(userId);
    i++;

    setQuery += `updated_at = now()`;

    // WHERE condition
    values.push(id);

    const query = `
      UPDATE devices
      SET ${setQuery}
      WHERE id = $${i}
      RETURNING *;
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ status: false, message: "Device not found" });
    }

    return res.json({
      status: true,
      message: "Device updated successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("🔥 updateDevice error:", err.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
};

exports.fetchSingleDevice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ status: false, message: "Device ID is required" });
    }

    const result = await pool.query(
      `SELECT *
       FROM devices
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Device not found" });
    }

    return res.json({
      status: true,
      message: "Device fetched successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("🔥 fetchSingleDevice Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ status: false, message: "Device ID is required" });
    }

    // Check if device exists
    const check = await pool.query(
      `SELECT id FROM devices WHERE id = $1`,
      [id]
    );

    if (check.rowCount === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Device not found" });
    }

    // Delete device
    await pool.query(
      `DELETE FROM devices WHERE id = $1`,
      [id]
    );

    return res.json({
      status: true,
      message: "Device deleted successfully",
    });

  } catch (error) {
    console.error("🔥 deleteDevice Error:", error.message);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};


exports.addUserToDeviceController = async(req, res) => {
  try {
    const result = await addInmateService(req.body);
    return res.json(result);
  } catch (error) {
    console.error("Error in /v1/add:", error);
    return res.status(500).json({ status: 1, msg: "Server Error" });
  }
}

// exports.getAllDevices1 = async (req, res) => {
//   try {
//     const devices = await Device.findAll({
//       order: [['last_connect_time', 'DESC']] // Sort by last connection time in descending order
//     });
//     return res.json({
//       ...ERR.SUCCESS,
//       data: { deviceList: devices } // Return device list
//     });
//   } catch (error) {
//     console.error('Error querying device list:', error);
//     return res.json({ ...ERR.DB_QUERY_ERROR, msg: `Device query failed: ${error.message}` });
//   }
// };

// exports.getAllDevices = async (req, res) => {
//   try {
//    res.status(200)
//   } catch (error) {
//     return res.json({ ...ERR.DB_QUERY_ERROR, msg: `Device query failed: ${error.message}` });
//   }
// };

// exports.updateDeviceStatus = async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) return res.json({ ...ERR.PARAM_ERROR });

//     const { sn, online_status, device_ip = '' } = req.body;
//     // Check if the device exists; create if not (auto-register new devices)
//     const [device, created] = await Device.findOrCreate({
//       where: { sn },
//       defaults: { online_status, device_ip, last_connect_time: new Date() }
//     });
//     // If the device exists, update its status and IP
//     if (!created) {
//       await device.update({ 
//         online_status, 
//         device_ip, 
//         last_connect_time: new Date() 
//       });
//     }
//     return res.json({ ...ERR.SUCCESS, data: { device, isNew: created } });
//   } catch (error) {
//     console.error('Error updating device status:', error);
//     return res.json({ ...ERR.DB_UPDATE_ERROR, msg: `Device status update failed: ${error.message}` });
//   }
// };

// exports.getUsersByDeviceSn = async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       console.warn('参数校验失败:', errors.array());
//       return res.json({ ...ERR.PARAM_ERROR });
//     }
//     const { sn } = req.body;
//     const users = await User.findAll({
//       where: { sn },
//       attributes: ['user_id', 'name', 'wiegand_flag', 'admin_auth', 'image_left', 'image_right'],
//       order: [['user_id', 'ASC']]
//     });

//     /**
//      * @param {string} rawBase64  
//      * @returns {string|null}  
//      */
//     const convertRawBase64ToPngBase64 = async (rawBase64) => {
       
//       if (!rawBase64) {
//         console.warn('raw base64 数据为空');
//         return null;
//       }

//       try {
//          const pureRawBase64 = rawBase64.includes('base64,') 
//           ? rawBase64.split('base64,')[1] 
//           : rawBase64;

//          const rawBuffer = Buffer.from(pureRawBase64, 'base64');

//          const expectedRawSize = 768 * 988 * 1; // 768宽×988高×1通道（8位灰度图）
//         if (rawBuffer.length !== expectedRawSize) {
//           console.error(`raw 数据大小不匹配：预期 ${expectedRawSize} 字节，实际 ${rawBuffer.length} 字节`);
//           return null;
//         }

//         const pngBuffer = await sharp(rawBuffer, {
//           raw: {
//             width: 768,    // 必须与原始 raw 图像宽度一致
//             height: 988,   // 必须与原始 raw 图像高度一致
//             channels: 1    // 1=灰度图，与原始 raw 通道数一致
//           }
//         })
//         .normalize() // 优化对比度（解决图像灰暗问题）
//         .linear(1.5, 20) // 增强亮度（斜率1.5=增亮，偏移20=提亮暗部）
//         .gamma(1.2) // 修正伽马值（1.0-3.0范围，优化画质）
//         .toFormat('png') // 输出格式指定为 PNG
//         .toBuffer(); // 生成 PNG 二进制 Buffer（内存中）

//         const pngBase64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;
//         console.log('raw 转 PNG base64 成功（长度：%d 字符）', pngBase64.length);
//         return pngBase64;

//       } catch (convertError) {
//         console.error('raw 转 PNG base64 失败:', convertError);
//         return null; 
//       }
//     };

//     const processedUsers = await Promise.all(
//       users.map(async (user) => {
//         const userObj = user.toJSON();
//         const [imageLeftPng, imageRightPng] = await Promise.all([
//           convertRawBase64ToPngBase64(userObj.image_left),
//           convertRawBase64ToPngBase64(userObj.image_right)
//         ]);

//         return {
//           ...userObj,
//           image_left: imageLeftPng,  // 替换为 PNG base64
//           image_right: imageRightPng // 替换为 PNG base64
//         };
//       })
//     );

//     return res.json({
//       ...ERR.SUCCESS,
//       data: {
//         userList: processedUsers, // 转换后的用户列表（含 PNG base64）
//         count: processedUsers.length
//       }
//     });

//   } catch (error) {
//     console.error('查询设备用户全局错误:', error);
//     return res.json({
//       ...ERR.DB_QUERY_ERROR,
//       msg: `User query failed: ${error.message}`
//     });
//   }
// };

// // 4. Query access records by device sn (adapts to Requirement 4: View access records of the current device, sorted by time in descending order)
// exports.getPassRecordsByDeviceSn = async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) return res.json({ ...ERR.PARAM_ERROR });

//     const { sn } = req.body;
//     // Query all access records under this device, sorted by access time in descending order
//     const passRecords = await PassRecord.findAll({
//       where: { sn },
//       attributes: ['id', 'name', 'user_id', 'palm_type', 'device_date_time', 'created_at'],
//       order: [['device_date_time', 'DESC']] // Core: Sort by access time in descending order
//     });
//     return res.json({
//       ...ERR.SUCCESS,
//       data: { passRecordList: passRecords, count: passRecords.length }
//     });
//   } catch (error) {
//     console.error('Error querying access records by device:', error);
//     return res.json({ ...ERR.DB_QUERY_ERROR, msg: `Access record query failed: ${error.message}` });
//   }
// };