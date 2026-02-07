const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceSettings.controller');

router.post('/', ctrl.addOrUpdateSettings);
router.get('/', ctrl.getSettings);

router.get('/all', ctrl.getAllSettings);           
router.patch('/:id/status', ctrl.updateActiveStatus);

module.exports = router;
