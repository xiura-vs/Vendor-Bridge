const { Router } = require('express');
const router = Router();
router.get('/', (req, res) => res.json({ message: 'Quotations module — coming soon' }));
module.exports = router;