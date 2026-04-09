// api/models/History.js
const mongoose = require('mongoose');

const historyItemSchema = new mongoose.Schema({
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String },
  price:       { type: Number },
  sold:        { type: Number, required: true, min: 0 },
  subtotal:    { type: Number },
}, { _id: false });

const historySchema = new mongoose.Schema({
  date:            { type: String, required: true },  // ISO date string 'YYYY-MM-DD'
  items:           [historyItemSchema],
  totalSoldPrice:  { type: Number, default: 0 },
  totalStockPrice: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.History || mongoose.model('History', historySchema);
