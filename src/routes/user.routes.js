const express = require('express')
const routes = express()
const usersController = require('../controllers/user.controller');

routes.get("/",usersController.fetchAllUsers)
routes.get("/with-group",usersController.fetchAllUsersWithGroup)
routes.delete("/with-group/:id",usersController.deleteUsersWithGroup)
routes.put("/update-permission/:id",usersController.updateUsersPersmissions)
routes.put("/update-user/:id",usersController.updateUsersDetails)

module.exports = routes