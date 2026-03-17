const { Parser } = require("json2csv");
const { pool } = require("../config/database");
const moment = require("moment")
const secondsToTime = (sec) => {
  if (sec === null || sec === undefined) return null;

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);

  return moment({ hour: hours, minute: minutes }).format("hh:mm A");
};

const weekdayMap = [
  "Sunday", "Monday", "Tuesday",
  "Wednesday", "Thursday", "Friday", "Saturday"
];

const formatTimeConfig = (configs) => {
  if (!configs || !Array.isArray(configs)) return [];

  return configs.map(c => {
    const isOvernight = c.end < c.start;

    return {
      day: weekdayMap[c.weekdays] || "Unknown",
      start_time: secondsToTime(c.start),
      end_time: secondsToTime(c.end),
      note: isOvernight ? "Next Day" : null
    };
  });
};

const formatDataByReport = (report_type, item) => {

  if (report_type === "user_wiegand_report") {
    return {
      user_id: item.user_id,
      user_name: item.user_name,
      email: item.email,
      phone_number: item.phone_number,
      sn: item.sn,
      group_id: item.group_id,
      day: item.day,
      start_time: item.start_time,
      end_time: item.end_time,
      note: item.note
    };
  }

  if (report_type === "group_report") {
    return {
      group_id: item.group_id,
      sn: item.sn,
      day: item.day,
      start_time: item.start_time,
      end_time: item.end_time,
      note: item.note,
      created_at: item.created_at
        ? moment(item.created_at).format("DD-MM-YYYY")
        : null
    };
  }

  if (report_type === "device_report") {
    return {
      sn: item.sn,
      device_name: item.device_name,
      device_ip: item.device_ip,
      online_status: item.online_status,
      firmware_version: item.firmware_version,
      last_connect_time: item.last_connect_time
        ? moment(item.last_connect_time).format("DD-MM-YYYY HH:mm:ss")
        : null,
      created_at: item.created_at
        ? moment(item.created_at).format("DD-MM-YYYY")
        : null
    };
  }

  if (report_type === "access_log_report") {
    return {
      user_id: item.user_id,
      user_name: item.user_name,
      sn: item.sn,
      device_name: item.device_name,
      palm_type: item.palm_type,
      device_time: item.device_date_time,
      created_at: item.created_at
        ? moment(item.created_at).format("DD-MM-YYYY")
        : null
    };
  }

  if (report_type === "user_report") {
    return {
      user_id: item.user_id,
      user_name: item.user_name,
      email: item.email,
      phone_number: item.phone_number,
      sn: item.sn,
      device_name: item.device_name,
      created_at: item.created_at
        ? moment(item.created_at).format("DD-MM-YYYY")
        : null
    };
  }

  return item;
};

exports.deviceAccessReport = async (req, res) => {
  try {

    const {
      report_type = "user_report",
      page = 1,
      limit = 10,
      id,
      user_id,
      group_id,
      sn,
      sortField = "created_at",
      sortOrder = "desc",
      format = "json"
    } = req.body;

    let values = [];
    let whereClauses = [];
    let query = "";
    let countQuery = "";
    let sortableFields = {};

    /*
    --------------------------------
    USER REPORT
    --------------------------------
    */

    if (report_type === "user_report") {

      if (user_id) {
        values.push(user_id);
        whereClauses.push(`u.user_id = $${values.length}`);
      }

      if (id) {
        values.push(id);
        whereClauses.push(`u.id = $${values.length}`);
      }

      sortableFields = {
        user_name: "u.name",
        user_id: "u.user_id",
        created_at: "u.created_at"
      };

      query = `
        SELECT
          u.user_id,
          u.name AS user_name,
          u.email,
          u.phone_number,
          u.wiegand_flag,
          u.admin_auth,
          u.sn,
          d.device_name,
          u.created_at
        FROM users u
        LEFT JOIN devices d
        ON d.sn = u.sn
        LEFT JOIN user_wiegands uw
          ON uw.user_id = u.user_id
          AND uw.sn = u.sn
        LEFT JOIN wiegand_groups wg
          ON wg.id = uw.group_uuid WHERE u.role = 'inmate'
      `;

      countQuery = `
        SELECT COUNT(*)
        FROM users u
        LEFT JOIN user_wiegands uw
          ON uw.user_id = u.user_id
          AND uw.sn = u.sn
        LEFT JOIN wiegand_groups wg
          ON wg.id = uw.group_uuid
      `;
    }

    /*
    --------------------------------
    DEVICE REPORT
    --------------------------------
    */

    else if (report_type === "device_report") {

      if (id) {
        values.push(id);
        whereClauses.push(`d.id = $${values.length}`);
      }

      if (sn) {
        values.push(sn);
        whereClauses.push(`d.sn = $${values.length}`);
      }

      sortableFields = {
        device_name: "d.device_name",
        sn: "d.sn",
        created_at: "d.created_at"
      };

      query = `
        SELECT
          d.sn,
          d.device_name,
          d.device_ip,
          d.online_status,
          d.firmware_version,
          d.last_connect_time,
          d.created_at
        FROM devices d
      `;

      countQuery = `
        SELECT COUNT(*)
        FROM devices d
      `;
    }

    /*
--------------------------------
ACCESS LOG REPORT
--------------------------------
*/

    else if (report_type === "access_log_report") {

      if (id) {
        values.push(id);
        whereClauses.push(`dal.id = $${values.length}`);
      }

      if (user_id) {
        values.push(user_id);
        whereClauses.push(`dal.user_id = $${values.length}`);
      }

      if (sn) {
        values.push(sn);
        whereClauses.push(`dal.sn = $${values.length}`);
      }

      sortableFields = {
        user_id: "dal.user_id",
        device_time: "dal.device_date_time",
        created_at: "dal.created_at"
      };

      query = `
    SELECT
      dal.id,
      dal.sn,
      d.device_name,
      dal.name AS user_name,
      dal.user_id,
      dal.palm_type,
      dal.device_date_time,
      dal.created_at

    FROM device_access_logs dal

    LEFT JOIN devices d
      ON d.sn = dal.sn
  `;

      countQuery = `
    SELECT COUNT(*)
    FROM device_access_logs dal
    LEFT JOIN devices d
      ON d.sn = dal.sn
  `;
    }

    /*
    --------------------------------
    GROUP REPORT
    --------------------------------
    */
    else if (report_type === "group_report") {

      if (id) {
        values.push(id);
        whereClauses.push(`wg.id = $${values.length}`);
      }

      if (sn) {
        values.push(sn);
        whereClauses.push(`wg.sn = $${values.length}`);
      }

      if (group_id) {
        values.push(group_id);
        whereClauses.push(`wg.group_id = $${values.length}`);
      }

      sortableFields = {
        group_id: "wg.group_id",
        sn: "wg.sn",
        created_at: "wg.created_at"
      };

      // 🔥 FINAL QUERY (bitmask + readable columns)
      query = `
    SELECT
      wg.id,
      wg.group_id,
      wg.sn,
      wg.del_flag,
      wg.created_at,
      wg.updated_at,

      d.day_name AS day,

      TO_CHAR(
        make_interval(secs => (tc->>'start')::int),
        'HH12:MI AM'
      ) AS start_time,

      TO_CHAR(
        make_interval(secs => (tc->>'end')::int),
        'HH12:MI AM'
      ) AS end_time,

      CASE 
        WHEN (tc->>'end')::int < (tc->>'start')::int 
        THEN 'Next Day'
        ELSE NULL
      END AS note

    FROM wiegand_groups wg

    LEFT JOIN LATERAL jsonb_array_elements(wg.time_configs) tc ON true

    JOIN LATERAL (
      VALUES
        (0, 'Sunday'),
        (1, 'Monday'),
        (2, 'Tuesday'),
        (3, 'Wednesday'),
        (4, 'Thursday'),
        (5, 'Friday'),
        (6, 'Saturday')
    ) AS d(bit, day_name)
    ON ((tc->>'weekdays')::int & (1 << d.bit)) > 0
  `;

      // ⚠️ count must match joins
      countQuery = `
    SELECT COUNT(*)
    FROM wiegand_groups wg
    LEFT JOIN LATERAL jsonb_array_elements(wg.time_configs) tc ON true
    JOIN LATERAL (
      VALUES
        (0), (1), (2), (3), (4), (5), (6)
    ) AS d(bit)
    ON ((tc->>'weekdays')::int & (1 << d.bit)) > 0
  `;
    }

    /*
    --------------------------------
    USER WIEGAND REPORT
    --------------------------------
    */

    else if (report_type === "user_wiegand_report") {

      if (id) {
        values.push(id);
        whereClauses.push(`uw.id = $${values.length}`);
      }

      if (user_id) {
        values.push(user_id);
        whereClauses.push(`uw.user_id = $${values.length}`);
      }

      if (sn) {
        values.push(sn);
        whereClauses.push(`uw.sn = $${values.length}`);
      }

      if (group_id) {
        values.push(group_id);
        whereClauses.push(`uw.group_id = $${values.length}`);
      }

      sortableFields = {
        user_id: "uw.user_id",
        group_id: "uw.group_id",
        sn: "uw.sn"
      };

      query = `
  SELECT
    uw.user_id,
    u.name AS user_name,
    u.email,
    u.phone_number,
    uw.sn,
    uw.group_uuid,
    uw.group_id,
    uw.timestamp,
    uw.del_flag,
    wg.created_at AS group_created_at,

    d.day_name AS day,

    TO_CHAR(
      make_interval(secs => (tc->>'start')::int),
      'HH12:MI AM'
    ) AS start_time,

    TO_CHAR(
      make_interval(secs => (tc->>'end')::int),
      'HH12:MI AM'
    ) AS end_time,

    CASE 
      WHEN (tc->>'end')::int < (tc->>'start')::int 
      THEN 'Next Day'
      ELSE NULL
    END AS note

  FROM user_wiegands uw

  LEFT JOIN users u
    ON u.user_id = uw.user_id

  LEFT JOIN wiegand_groups wg
    ON wg.id = uw.group_uuid

  -- 🔥 explode JSON
  LEFT JOIN LATERAL jsonb_array_elements(wg.time_configs) tc ON true

  -- 🔥 decode bitmask
  JOIN LATERAL (
    VALUES
      (0, 'Sunday'),
      (1, 'Monday'),
      (2, 'Tuesday'),
      (3, 'Wednesday'),
      (4, 'Thursday'),
      (5, 'Friday'),
      (6, 'Saturday')
  ) AS d(bit, day_name)
  ON ((tc->>'weekdays')::int & (1 << d.bit)) > 0
`;

      countQuery = `
  SELECT COUNT(*)
  FROM user_wiegands uw
  LEFT JOIN wiegand_groups wg
    ON wg.id = uw.group_uuid
  LEFT JOIN LATERAL jsonb_array_elements(wg.time_configs) tc ON true
  JOIN LATERAL (
    VALUES (0),(1),(2),(3),(4),(5),(6)
  ) AS d(bit)
  ON ((tc->>'weekdays')::int & (1 << d.bit)) > 0
`;
    }

    else {
      return res.status(400).json({
        success: false,
        message: "Invalid report type"
      });
    }

    /*
    --------------------------------
    WHERE CLAUSE
    --------------------------------
    */

    const where =
      whereClauses.length > 0
        ? ` WHERE ${whereClauses.join(" AND ")}`
        : "";

    /*
    --------------------------------
    SORTING
    --------------------------------
    */

    const orderField = sortableFields[sortField] || Object.values(sortableFields)[0];

    const orderBy = ` ORDER BY ${orderField} ${sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC"
      }`;

    /*
    --------------------------------
    PAGINATION
    --------------------------------
    */

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    values.push(limitNum);
    values.push(offset);

    const pagination = ` LIMIT $${values.length - 1} OFFSET $${values.length}`;

    /*
    --------------------------------
    EXECUTE QUERY
    --------------------------------
    */

    const result = await pool.query(query + where + orderBy + pagination, values);
    // let data = result.rows;
     let data = result.rows.map(item => formatDataByReport(report_type, item));


    // data = data.map(item => ({
    //   ...item,
    //   created_at: item.created_at
    //     ? moment(item.created_at).format("DD-MM-YYYY")
    //     : null,
    //   last_connect_time: item.last_connect_time
    //     ? moment(item.last_connect_time).format("DD-MM-YYYY HH:mm:ss")
    //     : null,
    //   updated_at: item.updated_at
    //     ? moment(item.updated_at).format("DD-MM-YYYY")
    //     : null
    // }));

    /*
    --------------------------------
    CSV EXPORT
    --------------------------------
    */

    if (format === "csv") {

      const fields = Object.keys(data[0] || {});
      const parser = new Parser({ fields });
      const csv = parser.parse(data);

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${report_type}.csv`
      );

      res.setHeader("Content-Type", "text/csv");

      return res.status(200).end(csv);
    }

    /*
    --------------------------------
    TOTAL COUNT
    --------------------------------
    */

    const countValues = values.slice(0, values.length - 2);
    const countResult = await pool.query(countQuery + where, countValues);

    const totalCount = parseInt(countResult.rows[0].count);

    return res.status(200).json({
      success: true,
      report_type,
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