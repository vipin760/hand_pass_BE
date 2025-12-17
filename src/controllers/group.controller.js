const { pool } = require("../config/database");

exports.createAccessGroup = async (req, res) => {
  try {
    const { group_name, description, device_id } = req.body;
    if (!group_name) {
      return res.status(400).json({ status: 1, msg: "group_name required" });
    }
    if (!device_id) {
      return res.status(400).json({ status: 1, msg: "device_id required" });
    }

    const deviceExist = await pool.query(`SELECT * FROM devices WHERE id = $1`, [device_id])
    if (!deviceExist.rows.length) {
      return res.status(400).send({ status: 1, message: "could not find device" })
    }

    const groupExist = await pool.query(`SELECT * FROM access_groups WHERE device_id=$1`, [device_id])

    if (groupExist.rows.length) {
      return res.status(400).send({ status: 1, message: "same device group already exist" })
    }

    const result = await pool.query(
      `
      INSERT INTO access_groups (group_name, description, device_id)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [group_name, description || null, device_id]
    );

    return res.json({
      code: 0,
      msg: "group created successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("createAccessGroup error:", error);
    return res.status(500).json({ code: 1, msg: "server error" });
  }
};

// GET /api/group   (or whatever your route is)
exports.getAllAccessGroups1 = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      is_active,
      sort_by = "created_at",
      sort_order = "desc"
    } = req.query;

    // Sanitize inputs
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const validSortColumns = ["group_name", "description", "is_active", "created_at", "updated_at", "id"];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : "created_at";
    const sortDirection = sort_order.toLowerCase() === "asc" ? "ASC" : "DESC";

    // Build WHERE clause
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (search.trim()) {
      whereConditions.push(`(group_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (is_active !== undefined) {
      const activeBool = is_active === "true" || is_active === true;
      whereConditions.push(`is_active = $${paramIndex}`);
      params.push(activeBool);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

    // Add pagination params
    params.push(limitNum, offset);

    // 1. Query for data
    const dataQuery = `
      SELECT id, group_name, description, is_active, created_at, updated_at
      FROM access_groups
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // 2. Query for total count (same WHERE clause, different params)
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM access_groups
      ${whereClause}
    `;

    // Run both queries
    const dataResult = await pool.query(dataQuery, params);
    const countResult = await pool.query(countQuery, params.slice(0, -2)); // remove limit & offset for count

    const data = dataResult.rows;
    const total = parseInt(countResult.rows[0].total, 10);

    return res.json({
      code: 0,
      msg: "success",
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
        has_next: pageNum < Math.ceil(total / limitNum),
        has_prev: pageNum > 1
      }
    });

  } catch (error) {
    console.error("getAllAccessGroups error:", error);
    return res.status(500).json({ code: 1, msg: "server error" });
  }
};
exports.getAllAccessGroups = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      is_active,
      sort_by = "created_at",
      sort_order = "desc"
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const validSortColumns = ["group_name", "description", "is_active", "created_at", "updated_at", "id"];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : "created_at";
    const sortDirection = sort_order.toLowerCase() === "asc" ? "ASC" : "DESC";

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (search.trim()) {
      whereConditions.push(`(group_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (is_active !== undefined) {
      const activeBool = is_active === "true" || is_active === true;
      whereConditions.push(`is_active = $${paramIndex}`);
      params.push(activeBool);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

    // Fetch groups with device info
    const dataQuery = `
      SELECT ag.id, ag.group_name, ag.description, ag.is_active, ag.created_at, ag.updated_at,
             json_agg(json_build_object(
               'device_id', d.id,
               'device_name', d.device_name,
               'sn', d.sn,
               'device_ip', d.device_ip,
               'group_name', ag.group_name
             )) AS devices
      FROM access_groups ag
      LEFT JOIN devices d ON ag.device_id = d.id
      ${whereClause}
      GROUP BY ag.id
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limitNum, offset);

    // Total count query
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM access_groups
      ${whereClause}
    `;

    const dataResult = await pool.query(dataQuery, params);
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    const data = dataResult.rows.map(group => {
      // Convert devices from array with null check
      return {
        ...group,
        devices: group.devices[0].device_id ? group.devices : []
      };
    });

    const total = parseInt(countResult.rows[0].total, 10);

    return res.json({
      code: 0,
      msg: "success",
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
        has_next: pageNum < Math.ceil(total / limitNum),
        has_prev: pageNum > 1
      }
    });

  } catch (error) {
    console.error("getAllAccessGroups error:", error);
    return res.status(500).json({ code: 1, msg: "server error" });
  }
};


// GET /api/group/:id   or   GET /api/group/single?id=...
exports.getSingleAccessGroup1 = async (req, res) => {
  try {
    // Support both route param (:id) and query param (?id=...)
    const groupId = req.params.id || req.query.id;

    if (!groupId) {
      return res.status(400).json({
        code: 1,
        msg: "Group ID is required",
      });
    }

    // Optional: validate UUID format (highly recommended in production)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(groupId)) {
      return res.status(400).json({
        code: 1,
        msg: "Invalid UUID format",
      });
    }

    const query = `
      SELECT 
        id, group_name, description, is_active, created_at, updated_at
      FROM access_groups
      WHERE id = $1
    `;

    const result = await pool.query(query, [groupId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 1,
        msg: "Access group not found",
      });
    }

    return res.json({
      code: 0,
      msg: "success",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("getSingleAccessGroup error:", error);
    return res.status(500).json({
      code: 1,
      msg: "server error",
    });
  }
};
exports.getSingleAccessGroup = async (req, res) => {
  try {
    // Support both route param (:id) and query param (?id=...)
    const groupId = req.params.id || req.query.id;

    if (!groupId) {
      return res.status(400).json({
        code: 1,
        msg: "Group ID is required",
      });
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(groupId)) {
      return res.status(400).json({
        code: 1,
        msg: "Invalid UUID format",
      });
    }

    const query = `
      SELECT 
        ag.id, ag.group_name, ag.description, ag.is_active, ag.created_at, ag.updated_at,
        json_agg(json_build_object(
          'device_id', d.id,
          'device_name', d.device_name,
          'sn', d.sn,
          'device_ip', d.device_ip,
          'online_status', d.online_status
        )) AS devices
      FROM access_groups ag
      LEFT JOIN devices d ON ag.device_id = d.id
      WHERE ag.id = $1
      GROUP BY ag.id
    `;

    const result = await pool.query(query, [groupId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 1,
        msg: "Access group not found",
      });
    }

    // Ensure devices array is empty if no devices
    const group = result.rows[0];
    group.devices = group.devices[0].device_id ? group.devices : [];

    return res.json({
      code: 0,
      msg: "success",
      data: group,
    });

  } catch (error) {
    console.error("getSingleAccessGroup error:", error);
    return res.status(500).json({
      code: 1,
      msg: "server error",
    });
  }
};


// PUT /api/group/:id   or   PATCH /api/group/:id
exports.updateAccessGroup1 = async (req, res) => {
  try {
    const groupId = req.params.id;

    // Validate UUID in URL
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!groupId || !uuidRegex.test(groupId)) {
      return res.status(400).json({
        code: 1,
        msg: "Valid Group ID is required",
      });
    }

    const { group_name, description, is_active } = req.body;

    // At least one field must be provided
    if (!group_name && !description && is_active === undefined) {
      return res.status(400).json({
        code: 1,
        msg: "Nothing to update. Provide group_name, description, or is_active",
      });
    }

    // Build dynamic SET clause
    let setClauses = [];
    let params = [];
    let paramIndex = 1;

    if (group_name !== undefined) {
      if (typeof group_name !== "string" || group_name.trim() === "") {
        return res.status(400).json({ code: 1, msg: "group_name must be a non-empty string" });
      }
      setClauses.push(`group_name = $${paramIndex}`);
      params.push(group_name.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(description === "" ? null : description.trim());
      paramIndex++;
    }

    if (is_active !== undefined) {
      const activeBool = is_active === true || is_active === "true";
      setClauses.push(`is_active = $${paramIndex}`);
      params.push(activeBool);
      paramIndex++;
    }

    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);

    // Final query
    const query = `
      UPDATE access_groups
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, group_name, description, is_active, created_at, updated_at
    `;
    params.push(groupId);

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: 1,
        msg: "Access group not found",
      });
    }

    // Check for unique violation (group_name already exists)
    if (result.rows.length === 0 && result.rowCount === 0) {
      // This catches PostgreSQL error if duplicate group_name
      // But better: catch unique violation explicitly in catch block below
    }

    return res.json({
      code: 0,
      msg: "Group updated successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("updateAccessGroup error:", error);

    // Handle unique constraint violation (group_name already exists)
    if (error.code === "23505" && error.constraint === "access_groups_group_name_key") {
      return res.status(409).json({
        code: 1,
        msg: "Group name already exists. Choose a different name.",
      });
    }

    return res.status(500).json({
      code: 1,
      msg: "server error",
    });
  }
};

exports.updateAccessGroup = async (req, res) => {
  try {
    const groupId = req.params.id;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!groupId || !uuidRegex.test(groupId)) {
      return res.status(400).json({ code: 1, msg: "Valid Group ID is required" });
    }

    const { group_name, description, is_active, device_id } = req.body;

    // Nothing to update
    if (!group_name && !description && is_active === undefined && !device_id) {
      return res.status(400).json({ code: 1, msg: "Provide at least one field to update" });
    }

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    // group_name
    if (group_name !== undefined) {
      if (typeof group_name !== "string" || group_name.trim() === "") {
        return res.status(400).json({ code: 1, msg: "group_name must be a non-empty string" });
      }
      setClauses.push(`group_name = $${paramIndex}`);
      params.push(group_name.trim());
      paramIndex++;
    }

    // description
    if (description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(description === "" ? null : description.trim());
      paramIndex++;
    }

    // is_active
    if (is_active !== undefined) {
      const activeBool = is_active === true || is_active === "true";
      setClauses.push(`is_active = $${paramIndex}`);
      params.push(activeBool);
      paramIndex++;
    }

    // device_id
    if (device_id !== undefined) {
      // Validate that device exists
      const deviceExist = await pool.query(`SELECT * FROM devices WHERE id = $1`, [device_id]);
      if (deviceExist.rows.length === 0) {
        return res.status(400).json({ code: 1, msg: "Device not found" });
      }
      const deviceInGroup = await pool.query(
        `SELECT * FROM access_groups WHERE device_id = $1 AND id <> $2`,
        [device_id, groupId]
      );

      if (deviceInGroup.rows.length > 0) {
        return res.status(400).json({ code: 1, msg: "Device is already assigned to another group" });
      }
      setClauses.push(`device_id = $${paramIndex}`);
      params.push(device_id);
      paramIndex++;
    }

    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);

    const query = `
      UPDATE access_groups
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, group_name, description, is_active, device_id, created_at, updated_at
    `;
    params.push(groupId);

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 1, msg: "Access group not found" });
    }

    return res.json({
      code: 0,
      msg: "Group updated successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("updateAccessGroup error:", error);

    if (error.code === "23505" && error.constraint === "access_groups_group_name_key") {
      return res.status(409).json({ code: 1, msg: "Group name already exists" });
    }

    return res.status(500).json({ code: 1, msg: "Server error" });
  }
};


// DELETE /api/group/:id
exports.deleteAccessGroup = async (req, res) => {
  try {
    const groupId = req.params.id;

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!groupId || !uuidRegex.test(groupId)) {
      return res.status(400).json({
        code: 1,
        msg: "Valid Group ID is required",
      });
    }

    // Optional: check if you're allowing hard delete
    // const hardDelete = req.query.hard === "true" || req.body.hard === true;

    let query, params, successMsg;

    // ⚠️ HARD DELETE — only allow if you really mean it
    query = `
        DELETE FROM access_groups 
        WHERE id = $1 
        RETURNING id, group_name
      `;
    params = [groupId];
    successMsg = "Group permanently deleted";

    // if (hardDelete) {
    //   // ⚠️ HARD DELETE — only allow if you really mean it
    //   query = `
    //     DELETE FROM access_groups 
    //     WHERE id = $1 
    //     RETURNING id, group_name
    //   `;
    //   params = [groupId];
    //   successMsg = "Group permanently deleted";
    // } 
    // else {
    //   // SOFT DELETE (default & recommended)
    //   query = `
    //     UPDATE access_groups 
    //     SET is_active = false, updated_at = NOW()
    //     WHERE id = $1 AND is_active = true
    //     RETURNING id, group_name, is_active
    //   `;
    //   params = [groupId];
    //   successMsg = "Group deactivated successfully";
    // }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: 1,
        msg: "Group not found or already deactivated",
      });
    }

    return res.json({
      code: 0,
      msg: successMsg,
      data: result.rows[0],
    });

  } catch (error) {
    console.error("deleteAccessGroup error:", error);
    return res.status(500).json({
      code: 1,
      msg: "server error",
    });
  }
};

//////////////////add user to group//////////////////////////////////////////////////////////

// get user by group
exports.getUsersByGroup = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sort_by = "created_at",
      sort_order = "desc"
    } = req.query;

    const { id: group_id } = req.params;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Map frontend sort keys to actual DB columns with aliases
    const columnMap = {
      name: "u.name",
      email: "u.email",
      created_at: "gu.created_at", // when user was added to group
      updated_at: "gu.updated_at"
    };
    const sortColumn = columnMap[sort_by] || "gu.created_at";
    const sortDirection = sort_order.toLowerCase() === "asc" ? "ASC" : "DESC";

    // Build WHERE clause
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (group_id) {
      whereConditions.push(`gu.group_id = $${paramIndex}`);
      params.push(group_id);
      paramIndex++;
    }

    if (search.trim()) {
      whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

    // Query users with group info
    const dataQuery = `
      SELECT 
        g.id AS group_id,
        g.group_name,
        g.description,
        g.is_active,
        u.id AS user_id,
        u.name,
        u.email,
        u.role,
        u.wiegand_flag,
        u.admin_auth,
        gu.is_allowed,
        gu.created_at AS added_at,
        gu.id
      FROM group_users gu
      JOIN users u ON u.id = gu.user_id
      JOIN access_groups g ON g.id = gu.group_id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limitNum, offset);

    // Query total count
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM group_users gu
      JOIN users u ON u.id = gu.user_id
      JOIN access_groups g ON g.id = gu.group_id
      ${whereClause}
    `;

    const dataResult = await pool.query(dataQuery, params);
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    const total = parseInt(countResult.rows[0].total, 10);

    return res.json({
      code: 0,
      msg: "success",
      data: dataResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
        has_next: pageNum < Math.ceil(total / limitNum),
        has_prev: pageNum > 1
      }
    });

  } catch (error) {
    console.error("getUsersByGroup error:", error);
    return res.status(500).json({ code: 1, msg: "server error" });
  }
};


// src/controllers/group.controller.js
exports.addUserToGroup = async (req, res) => {
  try {
    const { group_id, user_id } = req.body;

    const groupExist = await pool.query(`SELECT * FROM access_groups WHERE  id=$1`, [group_id])
    if (!groupExist.rows.length) {
      return res.status(400).send({ code: 1, message: "could not able to find group" });
    }

    const userExist = await pool.query(`SELECT * FROM users WHERE  id=$1`, [user_id])
    if (!userExist.rows.length) {
      return res.status(400).send({ code: 1, message: "could not able to find user" });
    }
    if (!group_id || !user_id) {
      return res.status(400).json({
        code: 1,
        msg: "group_id and user_id are required",
      });
    }

    // Optional: UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(group_id) || !uuidRegex.test(user_id)) {
      return res.status(400).json({
        code: 1,
        msg: "Invalid group_id or user_id format",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO group_users (group_id, user_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (group_id, user_id) DO NOTHING
      RETURNING group_id, user_id, created_at
      `,
      [group_id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({
        code: 1,
        msg: "User is already in this group",
      });
    }

    return res.json({
      code: 0,
      msg: "User added to group successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("addUserToGroup error:", error);
    if (error.code === "23503") {
      return res.status(404).json({
        code: 1,
        msg: "Group or user not found",
      });
    }
    return res.status(500).json({ code: 1, msg: "server error" });
  }
};

exports.addUserToMultipleGroups = async (req, res) => {
  const client = await pool.connect();

  try {
    const { user_id, group_ids } = req.body;

    // Basic validation
    if (!user_id || !Array.isArray(group_ids) || group_ids.length === 0) {
      return res.status(400).json({
        code: 1,
        msg: "user_id and group_ids array are required",
      });
    }

    // UUID validation
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(user_id) || group_ids.some(id => !uuidRegex.test(id))) {
      return res.status(400).json({
        code: 1,
        msg: "Invalid UUID format in user_id or group_ids",
      });
    }

    await client.query("BEGIN");

    /** 1️⃣ Check user exists */
    const userExist = await client.query(
      `SELECT id FROM users WHERE id = $1`,
      [user_id]
    );

    if (!userExist.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        code: 1,
        msg: "User not found",
      });
    }

    /** 2️⃣ Check all groups exist */
    const groupResult = await client.query(
      `
      SELECT id 
      FROM access_groups 
      WHERE id = ANY($1::uuid[])
      `,
      [group_ids]
    );

    if (groupResult.rows.length !== group_ids.length) {
      const foundIds = groupResult.rows.map(r => r.id);
      const missingGroups = group_ids.filter(id => !foundIds.includes(id));

      await client.query("ROLLBACK");
      return res.status(400).json({
        code: 1,
        msg: "Some groups do not exist",
        missing_groups: missingGroups,
      });
    }

    /** 3️⃣ Bulk insert */
    const insertQuery = `
      INSERT INTO group_users (group_id, user_id, created_at)
      SELECT unnest($1::uuid[]), $2, NOW()
      ON CONFLICT (group_id, user_id) DO NOTHING
      RETURNING group_id, user_id, created_at
    `;

    const result = await client.query(insertQuery, [group_ids, user_id]);

    await client.query("COMMIT");

    return res.json({
      code: 0,
      msg: "User added to groups successfully",
      added_count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("addUserToMultipleGroups error:", error);

    return res.status(500).json({
      code: 1,
      msg: "Server error",
    });
  } finally {
    client.release();
  }
};


// src/controllers/group.controller.js
exports.getAllGroupMembersWithNames = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      group_id,
      role,
      is_allowed,
      sort_by = "gu.created_at",
      sort_order = "desc"
    } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Sorting whitelist
    const validSort = [
      "group_name", "user_name", "email", "role", "is_allowed", "gu.created_at"
    ];
    const sortCol = validSort.includes(sort_by) ? sort_by : "gu.created_at";
    const sortDir = sort_order.toLowerCase() === "asc" ? "ASC" : "DESC";

    // Build WHERE conditions
    let where = [];
    let params = [];
    let idx = 1;

    // Search across group name, user name, email
    if (search.trim()) {
      where.push(`(
        ag.group_name ILIKE $${idx} OR
        u.name ILIKE $${idx} OR
        u.email ILIKE $${idx}
      )`);
      params.push(`%${search.trim()}%`);
      idx++;
    }

    if (group_id) {
      where.push(`gu.group_id = $${idx}`);
      params.push(group_id);
      idx++;
    }

    if (role) {
      where.push(`u.role = $${idx}`);
      params.push(role);
      idx++;
    }

    if (is_allowed !== undefined) {
      const allowed = is_allowed === "true" || is_allowed === true;
      where.push(`gu.is_allowed = $${idx}`);
      params.push(allowed);
      idx++;
    }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    // Main Query
    const query = `
      SELECT 
        gu.id,
        gu.group_id,
        ag.group_name,
        gu.user_id,
        u.name AS user_name,
        u.email,
        u.role,
        gu.is_allowed,
        gu.created_at
      FROM group_users gu
      LEFT JOIN access_groups ag ON gu.group_id = ag.id AND ag.is_active = true
      LEFT JOIN users u ON gu.user_id = u.id
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM group_users gu
      LEFT JOIN access_groups ag ON gu.group_id = ag.id AND ag.is_active = true
      LEFT JOIN users u ON gu.user_id = u.id
      ${whereClause}
    `;

    const finalParams = [...params, limitNum, offset];

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, finalParams),
      pool.query(countQuery, params)
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    return res.json({
      code: 0,
      msg: "success",
      data: dataResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
        has_next: pageNum < Math.ceil(total / limitNum),
        has_prev: pageNum > 1
      }
    });

  } catch (error) {
    console.error("getAllGroupMembersWithNames error:", error);
    return res.status(500).json({ code: 1, msg: "server error" });
  }
};

// src/controllers/group.controller.js
exports.getSingleGroupMember = async (req, res) => {
  try {
    const { id } = req.params; // ← the group_users.id (UUID)

    if (!id) {
      return res.status(400).json({
        code: 1,
        msg: "Member ID is required"
      });
    }

    const query = `
      SELECT 
        gu.id,
        gu.group_id,
        ag.group_name,
        gu.user_id,
        u.name AS user_name,
        u.email,
        u.role,
        gu.is_allowed,
        gu.created_at
      FROM group_users gu
      LEFT JOIN access_groups ag ON gu.group_id = ag.id AND ag.is_active = true
      LEFT JOIN users u ON gu.user_id = u.id
      WHERE gu.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 1,
        msg: "Group member not found"
      });
    }

    return res.json({
      code: 0,
      msg: "success",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("getSingleGroupMember error:", error);
    return res.status(500).json({ code: 1, msg: "server error" });
  }
};

// src/controllers/group.controller.js
exports.dynamicUpdateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { group_id, user_id, is_allowed } = req.body;

    if (!id) {
      return res.status(400).json({ code: 1, msg: "Missing URL id parameter" });
    }

    // Build dynamic SET clause
    const updates = [];
    const values = [];
    let index = 1;

    if (is_allowed !== undefined && is_allowed !== null) {
      const boolValue =
        is_allowed === true ||
        is_allowed === "true" ||
        is_allowed === 1 ||
        is_allowed === "1";
      updates.push(`is_allowed = $${index++}`);
      values.push(boolValue);
    }

    // if (group_id) {
    //   updates.push(`group_id = $${index++}`);
    //   values.push(group_id);
    // }
    if (group_id || user_id) {
      const checkSql = `
    SELECT id FROM group_users 
    WHERE group_id = COALESCE($1, group_id)
      AND user_id = COALESCE($2, user_id)
      AND id <> $3
    LIMIT 1
  `;
      const check = await pool.query(checkSql, [group_id, user_id, id]);

      if (check.rowCount > 0) {
        return res.status(409).json({
          code: 1,
          msg: "Combination of group_id and user_id already exists"
        });
      }
    }

    if (user_id) {
      updates.push(`user_id = $${index++}`);
      values.push(user_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        code: 1,
        msg: "No valid fields to update (is_allowed, group_id, user_id)"
      });
    }

    // Always match by URL id
    const whereClause = `WHERE id = $${index}`;
    values.push(id);

    const sql = `
      UPDATE group_users
      SET ${updates.join(", ")}
      ${whereClause}
      RETURNING *
    `;

    const result = await pool.query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 1, msg: "No matching record found" });
    }

    return res.json({
      code: 0,
      msg: `Updated ${result.rowCount} record(s)`,
      data: result.rows
    });

  } catch (error) {
    console.error("dynamicUpdateMember error:", error);
    return res.status(500).json({ code: 1, msg: "Server error" });
  }
};

exports.deleteGroupMember = async (req, res) => {
  try {
    const { id } = req.params; // ← the group_users.id (UUID)

    if (!id) {
      return res.status(400).json({
        code: 1,
        msg: "Member ID is required"
      });
    }

    const query = `
      DELETE FROM group_users
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: 1,
        msg: "Group member not found"
      });
    }

    return res.json({
      code: 0,
      msg: "Group member deleted successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("deleteGroupMember error:", error);
    return res.status(500).json({ code: 1, msg: "Server error" });
  }
};

//////////////////group rules////////////////////////////////////////////////////
// src/controllers/accessRule.controller.js
exports.createAccessRule = async (req, res) => {
  try {
    const {
      group_id,
      rule_name,
      days,                    // ← Will be auto-converted to JSONB by pg driver
      start_time,
      end_time,
      allow_cross_midnight = false,
      is_active = true
    } = req.body;

    // === REQUIRED FIELDS ===
    if (!group_id || !start_time || !end_time) {
      return res.status(400).json({
        code: 1,
        msg: "group_id, start_time, and end_time are required"
      });
    }

    // === TIME FORMAT VALIDATION ===
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      return res.status(400).json({
        code: 1,
        msg: "start_time and end_time must be in HH:MM format"
      });
    }

    // === DAYS VALIDATION (optional but strict) ===
    let daysJson = null;
    if (days !== undefined && days !== null) {
      if (!Array.isArray(days) || days.length === 0) {
        return res.status(400).json({ code: 1, msg: "days must be a non-empty array" });
      }
      const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const invalid = days.filter(d => !validDays.includes(d));
      if (invalid.length > 0) {
        return res.status(400).json({ code: 1, msg: `Invalid days: ${invalid.join(", ")}` });
      }
      daysJson = JSON.stringify(days) // ← Let node-pg serialize it correctly
    }

    // === INSERT (pg driver auto-converts array → JSONB) ===
    console.log("<><>daysJson", daysJson)
    const result = await pool.query(
      `
      INSERT INTO access_rules (
        group_id, rule_name, days, start_time, end_time,
        allow_cross_midnight, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        group_id,
        rule_name || null,
        daysJson,                    // ← CORRECT: pass array directly
        start_time,
        end_time,
        Boolean(allow_cross_midnight),
        Boolean(is_active)
      ]
    );

    return res.status(201).json({
      code: 0,
      msg: "Access rule created successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("createAccessRule error:", error);

    if (error.code === "23503") {
      return res.status(404).json({ code: 1, msg: "Group not found" });
    }
    if (error.code === "22P02") {
      return res.status(400).json({ code: 1, msg: "Invalid JSON format for 'days'" });
    }

    return res.status(500).json({ code: 1, msg: "Server error" });
  }
};

// src/controllers/group.controller.js
exports.getAllAccessRules = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      is_active,
      sort_by = "ag.group_name",
      sort_order = "asc"
    } = req.query;

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Sorting whitelist
    const validSort = [
      "ag.group_name",
      "ar.rule_name",
      "ar.start_time",
      "ar.end_time",
      "ar.created_at",
      "ar.is_active"
    ];
    const sortCol = validSort.includes(sort_by) ? sort_by : "ag.group_name";
    const sortDir = sort_order.toLowerCase() === "desc" ? "DESC" : "ASC";

    // Build WHERE
    let where = [];
    let params = [];
    let idx = 1;

    // Search by rule_name OR group_name
    if (search.trim()) {
      where.push(`(
        ar.rule_name ILIKE $${idx} OR 
        ag.group_name ILIKE $${idx}
      )`);
      params.push(`%${search.trim()}%`);
      idx++;
    }

    // Filter by is_active (on access_rules)
    if (is_active !== undefined) {
      const active = is_active === "true" || is_active === true;
      where.push(`ar.is_active = $${idx}`);
      params.push(active);
      idx++;
    }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    // Main Query — LEFT JOIN to get group_name
    const query = `
      SELECT 
        ar.id,
        ar.group_id,
        ag.group_name,
        ar.rule_name,
        ar.days,
        ar.start_time,
        ar.end_time,
        ar.allow_cross_midnight,
        ar.is_active,
        ar.created_at
      FROM access_rules ar
      LEFT JOIN access_groups ag ON ar.group_id = ag.id
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM access_rules ar
      LEFT JOIN access_groups ag ON ar.group_id = ag.id
      ${whereClause}
    `;

    const finalParams = [...params, limitNum, offset];

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, finalParams),
      pool.query(countQuery, params)
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    return res.json({
      code: 0,
      msg: "success",
      data: dataResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(total / limitNum),
        has_next: pageNum < Math.ceil(total / limitNum),
        has_prev: pageNum > 1
      }
    });

  } catch (error) {
    console.error("getAllAccessRules error:", error);
    return res.status(500).json({ code: 1, msg: "server error" });
  }
};

// src/controllers/accessRule.controller.js
exports.getSingleAccessRule = async (req, res) => {
  try {
    const { id } = req.params; // ← access_rules.id

    if (!id) {
      return res.status(400).json({
        code: 1,
        msg: "Rule ID is required"
      });
    }

    const query = `
      SELECT 
        ar.id,
        ar.group_id,
        ag.group_name,
        ar.rule_name,
        ar.days,
        ar.start_time,
        ar.end_time,
        ar.allow_cross_midnight,
        ar.is_active,
        ar.created_at,
        ar.updated_at
      FROM access_rules ar
      LEFT JOIN access_groups ag ON ar.group_id = ag.id
      WHERE ar.id = $1
        AND ar.is_active = true  -- optional: hide deactivated rules
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 1,
        msg: "Access rule not found"
      });
    }

    return res.json({
      code: 0,
      msg: "success",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("getSingleAccessRule error:", error);
    return res.status(500).json({ code: 1, msg: "server error" });
  }
};

// src/controllers/accessRule.controller.js
exports.updateAccessRule = async (req, res) => {
  try {
    const { id } = req.params; // ← access_rules.id
    const {
      rule_name,
      group_id,
      days,
      start_time,
      end_time,
      allow_cross_midnight,
      is_active
    } = req.body;

    if (!id) {
      return res.status(400).json({ code: 1, msg: "Rule ID is required" });
    }

    // At least one field to update
    if (
      !rule_name &&
      !days &&
      !start_time &&
      !end_time &&
      allow_cross_midnight === undefined &&
      is_active === undefined
    ) {
      return res.status(400).json({ code: 1, msg: "No fields to update" });
    }

    // Time format validation
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (start_time && !timeRegex.test(start_time)) {
      return res.status(400).json({ code: 1, msg: "Invalid start_time format. Use HH:MM" });
    }
    if (end_time && !timeRegex.test(end_time)) {
      return res.status(400).json({ code: 1, msg: "Invalid end_time format. Use HH:MM" });
    }

    // Days validation
    let daysJson = null;
    if (days !== undefined) {
      if (days === null || (Array.isArray(days) && days.length === 0)) {
        daysJson = null;
      } else if (Array.isArray(days)) {
        const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const invalid = days.filter(d => !validDays.includes(d));
        if (invalid.length > 0) {
          return res.status(400).json({ code: 1, msg: `Invalid days: ${invalid.join(", ")}` });
        }
        daysJson = JSON.stringify(days); // ← pg driver handles array → JSONB
      } else {
        return res.status(400).json({ code: 1, msg: "days must be an array or null" });
      }
    }

    // Build dynamic SET clause
    let setClause = ["updated_at = NOW()"];
    let params = [];
    let idx = 1;

    if (rule_name !== undefined) {
      setClause.push(`rule_name = $${idx}`);
      params.push(rule_name || null);
      idx++;
    }
    if (daysJson !== undefined) {
      setClause.push(`days = $${idx}`);
      params.push(daysJson);
      idx++;
    }
    if (start_time) {
      setClause.push(`start_time = $${idx}`);
      params.push(start_time);
      idx++;
    }
    if (end_time) {
      setClause.push(`end_time = $${idx}`);
      params.push(end_time);
      idx++;
    }
    if (allow_cross_midnight !== undefined) {
      setClause.push(`allow_cross_midnight = $${idx}`);
      params.push(Boolean(allow_cross_midnight));
      idx++;
    }
    if (is_active !== undefined) {
      setClause.push(`is_active = $${idx}`);
      params.push(Boolean(is_active));
      idx++;
    }
    if (group_id !== undefined) {
      setClause.push(`group_id = $${idx}`);
      params.push(group_id || null);
      idx++;
    }
    // Final query
    const query = `
      UPDATE access_rules 
      SET ${setClause.join(", ")}
      WHERE id = $${idx}
      RETURNING 
        id, group_id, rule_name, days, start_time, end_time,
        allow_cross_midnight, is_active, created_at, updated_at
    `;

    params.push(id);

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 1, msg: "Access rule not found" });
    }

    // Fetch with group_name
    const fullRule = await pool.query(
      `SELECT 
         ar.*, ag.group_name
       FROM access_rules ar
       LEFT JOIN access_groups ag ON ar.group_id = ag.id
       WHERE ar.id = $1`,
      [id]
    );

    return res.json({
      code: 0,
      msg: "Access rule updated successfully",
      data: fullRule.rows[0]
    });

  } catch (error) {
    console.error("updateAccessRule error:", error);
    return res.status(500).json({ code: 1, msg: "server error" });
  }
};

// src/controllers/accessRule.controller.js
exports.deleteAccessRule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ code: 1, msg: "Rule ID is required" });
    }

    const deleteQuery = `
      DELETE FROM access_rules
      WHERE id = $1
      RETURNING *;
    `;

    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 1, msg: "Access rule not found" });
    }

    return res.json({
      code: 0,
      msg: "Access rule permanently deleted",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("deleteAccessRule error:", error);
    return res.status(500).json({ code: 1, msg: "server error" });
  }
};


