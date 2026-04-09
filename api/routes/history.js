// api/routes/history.js
const express = require('express');
const router  = express.Router();
const History = require('../models/History');
const Product = require('../models/Product');
const mongoose = require('mongoose');

/**
 * POST /api/submit
 * Body: { date: 'YYYY-MM-DD', items: [{ productId, sold }] }
 * Deducts sold from stock and saves a history record.
 */
router.post('/submit', async (req, res) => {
  const { date, items } = req.body;

  if (!date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'date and items[] are required.' });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD.' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const historyItems  = [];
    let totalSoldPrice  = 0;

    for (const item of items) {
      const { productId, sold } = item;
      const soldQty = parseInt(sold, 10);

      if (!productId || isNaN(soldQty) || soldQty < 0) {
        await session.abortTransaction();
        return res.status(400).json({ error: `Invalid item: ${JSON.stringify(item)}` });
      }

      if (soldQty === 0) continue;   // skip zeros

      const product = await Product.findById(productId).session(session);
      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({ error: `Product not found: ${productId}` });
      }

      if (soldQty > product.stock) {
        await session.abortTransaction();
        return res.status(400).json({
          error: `Sold (${soldQty}) exceeds stock (${product.stock}) for "${product.name}".`,
        });
      }

      product.stock -= soldQty;
      await product.save({ session });

      const subtotal = soldQty * product.price;
      totalSoldPrice += subtotal;

      historyItems.push({
        productId:   product._id,
        productName: product.name,
        price:       product.price,
        sold:        soldQty,
        subtotal,
      });
    }

    if (historyItems.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'No valid sold items (all zero).' });
    }

    // Compute remaining stock value
    const allProducts      = await Product.find().session(session);
    const totalStockPrice  = allProducts.reduce((acc, p) => acc + p.stock * p.price, 0);

    const record = new History({
      date,
      items: historyItems,
      totalSoldPrice,
      totalStockPrice,
    });
    await record.save({ session });

    await session.commitTransaction();
    res.status(201).json({ message: 'Saved successfully.', record });
  } catch (err) {
    await session.abortTransaction();
    console.error('[POST /submit]', err);
    res.status(500).json({ error: 'Failed to save inventory.' });
  } finally {
    session.endSession();
  }
});

/**
 * GET /api/history
 * Returns all history records, newest first.
 */
router.get('/history', async (req, res) => {
  try {
    const records = await History.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error('[GET /history]', err);
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

/**
 * DELETE /api/history?id=<id>
 * Deletes a specific history record.
 */
router.delete('/history', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id query param required.' });

  try {
    const record = await History.findByIdAndDelete(id);
    if (!record) return res.status(404).json({ error: 'Record not found.' });
    res.json({ message: 'Deleted successfully.' });
  } catch (err) {
    console.error('[DELETE /history]', err);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

module.exports = router;
