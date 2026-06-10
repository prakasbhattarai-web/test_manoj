/**
 * Routes: /api/services
 */

const express = require('express');
const store = require('../models/store');

const router = express.Router();

// GET /api/services
router.get('/', (req, res) => {
  try {
    const services = store.getAllServices();
    return res.json({ success: true, data: services });
  } catch (err) {
    console.error('GET /services error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/services/:id
router.get('/:id', (req, res) => {
  try {
    const service = store.getServiceById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    return res.json({ success: true, data: service });
  } catch (err) {
    console.error('GET /services/:id error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
