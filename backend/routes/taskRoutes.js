const express = require('express');
const { getTasks, createTask, updateTask, deleteTask } = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect); // every task route needs a valid JWT

router.get('/', getTasks);
router.post('/', authorize('PO', 'SM'), createTask);
router.put('/:id', updateTask); // role checks inside: DEV moves cards, PO/SM edit details
router.delete('/:id', authorize('PO', 'SM'), deleteTask);

module.exports = router;
