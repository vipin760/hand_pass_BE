const express = require('express')
const routes = express()
const reportRoutes = require("../controllers/report.controller")

routes.post("/access-list",reportRoutes.deviceAccessReport)
module.exports = routes