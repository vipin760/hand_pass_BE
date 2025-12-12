const { Parser } = require("json2csv");
const { pool } = require("../config/database");
const moment = require("moment")
exports.deviceAccessReport = async (req, res) => {
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
      SELECT *
      FROM device_access_logs
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
