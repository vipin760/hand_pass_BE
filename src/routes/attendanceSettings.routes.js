const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceSettings.controller');
const { authenticate } = require('../middleware/auth');
router.use(authenticate)
router.post('/settings', ctrl.addOrUpdateSettings);
router.get('/settings', ctrl.getSettings);

router.get('/settings', ctrl.getAllSettings);           
router.post('/',ctrl.getAttendanceReports)
router.post('/all',ctrl.getDailySummary)
router.patch('/:id/status', ctrl.updateActiveStatus);


module.exports = router;
