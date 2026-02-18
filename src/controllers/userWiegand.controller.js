const { pool } = require("../config/database");

exports.addUserWiegand = async (req, res) => {
  try {
    const { sn, user_id, group_id = '', timestamp, del_flag = false } = req.body;
    // Basic validation
    if (!sn || !user_id || !timestamp) {
      return res.status(400).json({
        success: false,
        message: "sn, user_id and timestamp are required"
      });
    }
    const userExisting = await pool.query(`SELECT * FROM user_wiegands WHERE user_id=$1 AND group_id =$2`,[user_id,group_id])
    if(userExisting.rows.length != 0){
         return res.status(400).json({success:false,message:"user with same group already existing"})
    }
    const existWiegandGrp = await pool.query(`SELECT group_id, id FROM wiegand_groups WHERE group_id = $1`,[group_id])
    if(existWiegandGrp.rows.length == 0 ){
        return res.status(400).json({success:false,message:"could not able to find group"})
    }
    
    const query = `
      INSERT INTO user_wiegands (sn, user_id, group_id,group_uuid, timestamp, del_flag)
      VALUES ($1, $2, $3, $4, $5,$6)
      RETURNING *;
    `;

    const values = [
      sn,
      user_id,
      group_id,
      existWiegandGrp.rows[0].id,
      timestamp,
      del_flag
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Add UserWiegand Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getUserWiegand = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      del_flag,
      sort_by = "timestamp",
      sort_order = "DESC"
    } = req.query;

    // ---- Pagination ----
    page = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 100) limit = 100;

    const offset = (page - 1) * limit;

    // ---- Sorting ----
    const validSortColumns = ["user_id", "sn", "group_id", "timestamp"];
    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "timestamp";

    const sortDirection =
      sort_order && sort_order.toUpperCase() === "ASC"
        ? "ASC"
        : "DESC";

    // ---- Dynamic WHERE ----
    let whereClauses = [];
    let values = [];
    let paramIndex = 1;

    // del_flag filter (convert string to boolean properly)
    if (del_flag !== undefined) {
      const parsedFlag =
        del_flag === "true" || del_flag === true
          ? true
          : del_flag === "false" || del_flag === false
          ? false
          : null;

      if (parsedFlag !== null) {
        whereClauses.push(`del_flag = $${paramIndex}`);
        values.push(parsedFlag);
        paramIndex++;
      }
    }

    // Search filter
    if (search) {
      whereClauses.push(`(
        CAST(user_id AS TEXT) ILIKE $${paramIndex}
        OR sn ILIKE $${paramIndex}
        OR group_id ILIKE $${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereSQL = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // ---- Data Query ----
    const dataQuery = `
      SELECT *
      FROM user_wiegands
      ${whereSQL}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1};
    `;

    values.push(limit);
    values.push(offset);

    // ---- Count Query ----
    const countQuery = `
      SELECT COUNT(*) 
      FROM user_wiegands
      ${whereSQL};
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, values),
      pool.query(countQuery, values.slice(0, paramIndex - 1))
    ]);

    const totalRecords = parseInt(countResult.rows[0].count);

    return res.status(200).json({
      success: true,
      total_records: totalRecords,
      current_page: page,
      total_pages: Math.ceil(totalRecords / limit),
      data: dataResult.rows
    });

  } catch (error) {
    console.error("查询用户韦根关联失败：", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.softDeleteUserWiegand = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required"
      });
    }

    // Check if exists and not already deleted
    const checkQuery = `
      SELECT id 
      FROM user_wiegands
      WHERE id = $1 AND del_flag = false
    `;

    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Record not found or already deleted"
      });
    }

    // Soft delete
    const updateQuery = `
      UPDATE user_wiegands
      SET del_flag = true
      WHERE id = $1
      RETURNING *;
    `;

    const updateResult = await pool.query(updateQuery, [id]);

    return res.status(200).json({
      success: true,
      message: "User Wiegand soft deleted successfully",
      data: updateResult.rows[0]
    });

  } catch (error) {
    console.error("软删除用户韦根关联失败：", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateUserWiegand = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { sn, user_id, group_id, timestamp } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "id is required"
      });
    }

    await client.query("BEGIN");

    // Check if record exists and not deleted
    const existing = await client.query(
      `SELECT * FROM user_wiegands 
       WHERE id = $1 AND del_flag = false`,
      [id]
    );

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Record not found or already deleted"
      });
    }

    let group_uuid = existing.rows[0].group_uuid;

    // If group_id provided → validate & fetch uuid
    if (group_id) {
      const groupResult = await client.query(
        `SELECT id FROM wiegand_groups WHERE group_id = $1`,
        [group_id]
      );

      if (groupResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Group not found"
        });
      }

      group_uuid = groupResult.rows[0].id;
    }

    // Prevent duplicate (user_id + group_id)
    if (user_id || group_id) {
      const duplicateCheck = await client.query(
        `SELECT id FROM user_wiegands
         WHERE user_id = $1 
         AND group_id = $2
         AND id != $3`,
        [
          user_id || existing.rows[0].user_id,
          group_id || existing.rows[0].group_id,
          id
        ]
      );

      if (duplicateCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "User already assigned to this group"
        });
      }
    }

    // Build dynamic update
    const updateQuery = `
      UPDATE user_wiegands
      SET
        sn = COALESCE($1, sn),
        user_id = COALESCE($2, user_id),
        group_id = COALESCE($3, group_id),
        group_uuid = COALESCE($4, group_uuid),
        timestamp = COALESCE($5, timestamp)
      WHERE id = $6
      RETURNING *;
    `;

    const updateResult = await client.query(updateQuery, [
      sn || null,
      user_id || null,
      group_id || null,
      group_id ? group_uuid : null,
      timestamp ? Number(timestamp) : null,
      id
    ]);

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "User Wiegand updated successfully",
      data: updateResult.rows[0]
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update UserWiegand Error:", error);

    if (error.code === "23505") {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry not allowed"
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message
    });

  } finally {
    client.release();
  }
};





