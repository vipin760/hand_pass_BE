const express = require('express')
const routes = express()
const dashboardController = require("../controllers/dashboard.controller")

routes.get("/",dashboardController.fetchDashboard)

module.exports = routes