const express = require('express')
const routes = express()
const groupController = require('../controllers/group.controller');

routes.post("/",groupController.createAccessGroup)
routes.get("/",groupController.getAllAccessGroups)
routes.get("/:id",groupController.getSingleAccessGroup)
routes.put("/:id",groupController.updateAccessGroup)
routes.delete("/:id",groupController.deleteAccessGroup)

module.exports = routes