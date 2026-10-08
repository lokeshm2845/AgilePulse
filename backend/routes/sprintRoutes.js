const express = require('express');
const {
  getSprints,
  createSprint,
  updateSprint,
  deleteSprint,
  addTaskToSprint,
  removeTaskFromSprint,
} = require('../controllers/sprintController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getSprints);
router.post('/', authorize('SM'), createSprint);
router.put('/:id', authorize('SM'), updateSprint);
router.delete('/:id', authorize('SM'), deleteSprint);

// Sprint planning: move stories between backlog and sprint
router.post('/:id/tasks', authorize('SM'), addTaskToSprint);
router.delete('/:id/tasks/:taskId', authorize('SM'), removeTaskFromSprint);

module.exports = router;
