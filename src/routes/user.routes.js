const express = require('express')
const routes = express()
const usersController = require('../controllers/user.controller');

routes.get("/",usersController.fetchAllUsers)
routes.put("/update-permission/:id",usersController.updateUsersPersmissions)

module.exports = routes