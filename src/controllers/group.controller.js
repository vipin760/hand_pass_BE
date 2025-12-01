const { pool } = require("../config/database");

exports.createAccessGroup = async (req, res) => {
  try {
    const { group_name, description } = req.body;

    if (!group_name) {
      return res.status(400).json({ code: 1, msg: "group_name required" });
    }

    const result = await pool.query(
      `
      INSERT INTO access_groups (group_name, description)
      VALUES ($1, $2)
      RETURNING *
      `,
      [group_name, description || null]
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

// GET /api/group/:id   or   GET /api/group/single?id=...
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

// PUT /api/group/:id   or   PATCH /api/group/:id
exports.updateAccessGroup = async (req, res) => {
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