const { Router } = require('express');
const router = Router();
router.get('/', (req, res) => res.json({ message: 'RFQ module — coming soon' }));
module.exports = router;