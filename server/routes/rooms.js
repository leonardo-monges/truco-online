const express = require('express');
const router = express.Router();
const { getRooms, createRoom, getRoom } = require('../controllers/roomController');

router.get('/', getRooms);
router.post('/', createRoom);
router.get('/:id', getRoom);

module.exports = router;
