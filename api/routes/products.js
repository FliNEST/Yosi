// api/routes/products.js
const express  = require('express');
const router   = express.Router();
const Product  = require('../models/Product');

const DEFAULT_PRODUCTS = [
  { name: 'MARLBORO RED',   price: 176, stock: 0 },
  { name: 'MARLBORO LIGHT', price: 176, stock: 0 },
  { name: 'MARLBORO BLUE',  price: 176, stock: 0 },
  { name: 'MARLBORO BLACK', price: 176, stock: 0 },
  { name: 'CRAFTED BLUE',   price: 164, stock: 0 },
  { name: 'FORTUNE WHITE',  price: 164, stock: 0 },
  { name: 'FORTUNE LIGHT',  price: 164, stock: 0 },
  { name: 'CHESTER RED',    price: 145, stock: 0 },
  { name: 'CHESTER WHITE',  price: 145, stock: 0 },
  { name: 'CHESTER REMIX',  price: 145, stock: 0 },
];

/**
 * GET /api/products
 * Returns all products. Seeds defaults on first run.
 */
router.get('/', async (req, res) => {
  try {
    let products = await Product.find().sort({ name: 1 });

    if (products.length === 0) {
      products = await Product.insertMany(DEFAULT_PRODUCTS);
    }

    res.json(products);
  } catch (err) {
    console.error('[GET /products]', err);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

/**
 * PATCH /api/products/:id
 * Update product price or stock (admin use).
 */
router.patch('/:id', async (req, res) => {
  try {
    const { price, stock } = req.body;
    const update = {};
    if (price !== undefined) update.price = price;
    if (stock !== undefined) update.stock = stock;

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    res.json(product);
  } catch (err) {
    console.error('[PATCH /products/:id]', err);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

module.exports = router;
