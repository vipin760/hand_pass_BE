const express = require('express')
const routes = express()
const usersController = require('../controllers/user.controller');

routes.get("/",usersController.fetchAllUsers)
routes.get("/with-group",usersController.fetchAllUsersWithGroup)
routes.delete("/:id",usersController.deleteUsersWithGroup)
routes.delete("/with-group/:id",usersController.deleteUsersWithGroup)
routes.get("/with-group/:id",usersController.fetchSingleUsersWithGroup)
routes.put("/update-permission/:id",usersController.updateUsersPersmissions)
routes.put("/update-user/:id",usersController.updateUsersDetails)

module.exports = routes