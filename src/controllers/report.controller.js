const { Parser } = require("json2csv");
const { pool } = require("../config/database");
const moment = require("moment")
exports.deviceAccessReport1 = async (req, res) => {
  try {
    const {
      page,
      limit,
      sortField = 'created_at',
      sortOrder = 'desc',
      sn,
      name,
      user_id,
      palm_type,
      start_date,
      end_date,
      format = 'json'
    } = req.body;

    let values = [];
    let whereClauses = [];

    // ----- Filters -----
    if (sn) {
      values.push(`%${sn}%`);
      whereClauses.push(`sn ILIKE $${values.length}`);
    }

    if (name) {
      values.push(`%${name}%`);
      whereClauses.push(`name ILIKE $${values.length}`);
    }

    if (user_id) {
      values.push(user_id);
      whereClauses.push(`user_id = $${values.length}`);
    }

    if (palm_type) {
      values.push(palm_type);
      whereClauses.push(`palm_type = $${values.length}`);
    }

    if (start_date && end_date) {
      values.push(start_date);
      values.push(end_date);
      whereClauses.push(`device_date_time BETWEEN $${values.length - 1} AND $${values.length}`);
    }

    let where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // ----- Sorting -----
    const orderBy = `ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;

    // ----- Pagination -----
    let pagination = "";
    let pageNum = 1, limitNum = 0;

    if (page && limit) {
      pageNum = parseInt(page) || 1;
      limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;

      values.push(limitNum);
      values.push(offset);
      pagination = `LIMIT $${values.length - 1} OFFSET $${values.length}`;
    }

    // ----- Main query -----
    const query = `
  SELECT 
    dal.id,
    dal.sn,
    d.device_name,
    dal.name,
    dal.user_id,
    dal.palm_type,
    dal.device_date_time,
    dal.created_at
  FROM device_access_logs dal
  LEFT JOIN devices d ON d.sn = dal.sn
  ${where}
  ${orderBy}
  ${pagination}
`;

    const rows = await pool.query(query, values);
    let data = rows.rows;

    if (!data.length) {
      return res.status(200).json({ success: true, message: "No records found", data: [] });
    }

    // Format date fields
    data = data.map(item => ({
      ...item,
      device_date_time: moment(item.device_date_time).format("DD-MM-YYYY HH:mm:ss"),
      created_at: moment(item.created_at).format("DD-MM-YYYY HH:mm:ss")
    }));

    // ----- CSV Export -----
    if (format === "csv") {
      const csvFields = [
        "id",
        "sn",
        "name",
        "device_name",
        "user_id",
        "palm_type",
        "device_date_time",
        "created_at"
      ];

      const parser = new Parser({ fields: csvFields });
      const csv = parser.parse(data);

      res.setHeader("Content-Disposition", "attachment; filename=device_access_report.csv");
      res.setHeader("Content-Type", "text/csv");
      return res.status(200).end(csv);
    }

    // ----- Total Count -----
    const countQuery = `SELECT COUNT(*) FROM device_access_logs ${where}`;
    const countResult = await pool.query(countQuery, values.slice(0, whereClauses.length));
    const totalCount = parseInt(countResult.rows[0].count);

    if (page && limit) {
      return res.status(200).json({
        success: true,
        page: pageNum,
        limit: limitNum,
        totalCount,
        data
      });
    }

    return res.status(200).json({ success: true, totalCount, data });

  } catch (error) {
    console.error("deviceAccessReport error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

exports.deviceAccessReport = async (req, res) => {
  try {

    const {
      report_type = "access_report",
      page = 1,
      limit = 10,
      id,
      sortField = "created_at",
      sortOrder = "desc",
      user_id,
      format = "json"
    } = req.body;

    let values = [];
    let whereClauses = [];

    /*
    -----------------------------
    USER REPORT MODE
    -----------------------------
    */

    if (report_type !== "user_report") {
      return res.status(400).json({
        success: false,
        message: "Invalid report type"
      });
    }

    if (user_id) {
      values.push(user_id);
      whereClauses.push(`u.user_id = $${values.length}`);
    }

    if (id) {
      values.push(id);
      whereClauses.push(`u.id = $${values.length}`);
    }

    const where =
      whereClauses.length > 0
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";

    /*
    -----------------------------
    SORTING
    -----------------------------
    */

    const sortableFields = {
      user_name: "u.name",
      user_id: "u.user_id",
      created_at: "u.created_at"
    };

    const orderField = sortableFields[sortField] || "u.created_at";

    const orderBy = `ORDER BY ${orderField} ${sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC"
      }`;

    /*
    -----------------------------
    PAGINATION
    -----------------------------
    */

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    values.push(limitNum);
    values.push(offset);

    const pagination = `LIMIT $${values.length - 1} OFFSET $${values.length}`;

    /*
    -----------------------------
    MAIN QUERY
    -----------------------------
    */

    const query = `
      SELECT
        u.id,
        u.name AS user_name,
        u.email,
        u.phone_number,
        u.user_id,
        u.role,
        u.wiegand_flag,
        u.admin_auth,
        u.sn,
        wg.group_id,
        u.created_at

      FROM users u

      LEFT JOIN user_wiegands uw
        ON uw.user_id = u.user_id
        AND uw.sn = u.sn

      LEFT JOIN wiegand_groups wg
        ON wg.id = uw.group_uuid

      ${where}

      ${orderBy}

      ${pagination}
    `;

    const result = await pool.query(query, values);
    let data = result.rows;

    data = data.map(item => ({
      ...item,
      created_at: moment(item.created_at).format("DD-MM-YYYY HH:mm:ss")
    }));

    /*
    -----------------------------
    CSV EXPORT
    -----------------------------
    */

    if (format === "csv") {

      const fields = [
        "id",
        "user_name",
        "email",
        "phone_number",
        "user_id",
        "role",
        "wiegand_flag",
        "admin_auth",
        "sn",
        "group_id",
        "created_at"
      ];

      const parser = new Parser({ fields });
      const csv = parser.parse(data);

      res.setHeader(
        "Content-Disposition",
        "attachment; filename=user_report.csv"
      );

      res.setHeader("Content-Type", "text/csv");

      return res.status(200).end(csv);
    }

    /*
    -----------------------------
    TOTAL COUNT
    -----------------------------
    */

    const countQuery = `
      SELECT COUNT(*)
      FROM users u
      LEFT JOIN user_wiegands uw
        ON uw.user_id = u.user_id
        AND uw.sn = u.sn
      LEFT JOIN wiegand_groups wg
        ON wg.id = uw.group_uuid
      ${where}
    `;

    const countValues = values.slice(0, values.length - 2);

    const countResult = await pool.query(countQuery, countValues);

    const totalCount = parseInt(countResult.rows[0].count);

    return res.status(200).json({
      success: true,
      page: pageNum,
      limit: limitNum,
      totalCount,
      data
    });

  } catch (error) {

    console.error("deviceAccessReport error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });

  }
};