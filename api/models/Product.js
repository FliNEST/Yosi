// api/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name:  { type: String, required: true, uppercase: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
