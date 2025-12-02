const express = require('express')
const routes = express()
const usersController = require('../controllers/user.controller');

routes.get("/",usersController.fetchAllUsers)

module.exports = routes