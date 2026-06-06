const { Router } = require('express');
const router = Router();
router.get('/', (req, res) => res.json({ message: 'Invoices module — coming soon' }));
module.exports = router;