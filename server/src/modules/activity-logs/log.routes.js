const { Router } = require('express');
const router = Router();
router.get('/', (req, res) => res.json({ message: 'Activity Logs module — coming soon' }));
module.exports = router;