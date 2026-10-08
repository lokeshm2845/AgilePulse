/**
 * Seed demo data: one account per role, a sprint and some backlog stories.
 * Safe to run more than once - it only inserts what is missing, never deletes.
 *
 *   npm run seed        (uses MONGO_URI from .env)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Sprint = require('./models/Sprint');
const Task = require('./models/Task');

const DEMO_PASSWORD = 'password123';
const DEMO_USERS = [
  { name: 'Priya Owner', email: 'po@agilepulse.dev', role: 'PO' },
  { name: 'Sam Master', email: 'sm@agilepulse.dev', role: 'SM' },
  { name: 'Dev Patel', email: 'dev@agilepulse.dev', role: 'DEV' },
  { name: 'Riya Coder', email: 'dev2@agilepulse.dev', role: 'DEV' },
];

async function seed() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = {};
  for (const u of DEMO_USERS) {
    // eslint-disable-next-line no-await-in-loop
    users[u.role + u.email] = (await User.findOne({ email: u.email })) || (await User.create({ ...u, passwordHash }));
  }
  const po = users['POpo@agilepulse.dev'];
  const dev = users['DEVdev@agilepulse.dev'];
  const dev2 = users['DEVdev2@agilepulse.dev'];

  if (await Sprint.exists({ name: 'Sprint 1' })) {
    console.log('Demo data already present - nothing to do.');
    return;
  }

  const start = new Date();
  const sprint = await Sprint.create({
    name: 'Sprint 1',
    startDate: start,
    endDate: new Date(start.getTime() + 13 * 86400000),
    velocityCapacity: 21,
    status: 'Active',
  });

  const inSprint = [
    { title: 'User registration & login', storyPoints: 5, priority: 'High', status: 'Done', assignedTo: dev._id },
    { title: 'JWT auth middleware', storyPoints: 3, priority: 'High', status: 'Review', assignedTo: dev2._id },
    { title: 'Kanban board layout', storyPoints: 5, priority: 'High', status: 'In Progress', assignedTo: dev._id },
    { title: 'Drag-and-drop task cards', storyPoints: 3, priority: 'Medium', status: 'To-Do', assignedTo: dev2._id },
  ];
  const backlog = [
    { title: 'Comments on tasks', description: 'Users can add, edit and delete their own comments', storyPoints: 5, priority: 'Medium' },
    { title: 'Activity log viewer', description: 'Scrum Master can view the audit trail', storyPoints: 3, priority: 'Low' },
    { title: 'Sprint burndown chart', storyPoints: 8, priority: 'Medium' },
    { title: 'Email notifications', storyPoints: 13, priority: 'Low' },
    { title: 'Keyboard shortcuts on the board', storyPoints: 2, priority: 'High' },
  ];

  await Task.insertMany([
    ...inSprint.map((t) => ({ ...t, sprintId: sprint._id, createdBy: po._id })),
    ...backlog.map((t) => ({ ...t, sprintId: null, createdBy: po._id })),
  ]);

  console.log(`Seeded ${DEMO_USERS.length} users, 1 sprint, ${inSprint.length + backlog.length} stories.`);
  console.log(`Demo password for all accounts: ${DEMO_PASSWORD}`);
}

module.exports = { seed, DEMO_USERS, DEMO_PASSWORD };

if (require.main === module) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(seed)
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error('Seed failed:', err.message);
      process.exit(1);
    });
}
