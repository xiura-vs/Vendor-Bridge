const { Router } = require('express');
const router = Router();
router.get('/', (req, res) => res.json({ message: 'Dashboard module — coming soon' }));
module.exports = router;