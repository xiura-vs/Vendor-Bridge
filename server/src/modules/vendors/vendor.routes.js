const { Router } = require('express');
const router = Router();
// Vendor routes — to be implemented
router.get('/', (req, res) => res.json({ message: 'Vendor module — coming soon' }));
module.exports = router;