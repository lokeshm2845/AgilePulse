const express = require('express');
const { getBacklog, addStory, updateStory, deleteStory } = require('../controllers/backlogController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getBacklog);
router.post('/', authorize('PO'), addStory);
router.put('/:id', authorize('PO'), updateStory);
router.delete('/:id', authorize('PO'), deleteStory);

module.exports = router;
