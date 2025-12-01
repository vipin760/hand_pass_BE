const express = require("express");
const deviceController = require("../controllers/device.controller");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// router.use(authenticate)
router.post("/connect", deviceController.connectDeviceController);

router.get("/connect", deviceController.fetchAllConnectDevices);
router.post("/add", deviceController.addUserToDeviceController);

router.put('/connect/:id',deviceController.updateDevice)
router.get('/connect/:id',deviceController.fetchSingleDevice)
router.delete('/connect/:id',deviceController.deleteDevice)

module.exports = router;
