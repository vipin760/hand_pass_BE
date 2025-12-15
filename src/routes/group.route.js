const express = require('express')
const routes = express()
const groupController = require('../controllers/group.controller');

routes.post("/",groupController.createAccessGroup)
routes.get("/",groupController.getAllAccessGroups)

// add user to group
routes.post('/members',groupController.addUserToGroup)
routes.get('/members',groupController.getAllGroupMembersWithNames)
routes.post('/add-group',groupController.addUserToMultipleGroups)

// group rules
routes.post('/rules',groupController.createAccessRule)
routes.get('/rules',groupController.getAllAccessRules)
routes.get('/rules/:id',groupController.getSingleAccessRule)
routes.put('/rules/:id',groupController.updateAccessRule)

routes.get("/members/:id",groupController.getSingleGroupMember)
routes.get("/group-members/:id",groupController.getUsersByGroup)
routes.put("/members/:id",groupController.dynamicUpdateMember)
routes.delete("/members/:id",groupController.deleteGroupMember)

routes.get("/:id",groupController.getSingleAccessGroup)
routes.put("/:id",groupController.updateAccessGroup)
routes.delete("/:id",groupController.deleteAccessGroup)

module.exports = routes