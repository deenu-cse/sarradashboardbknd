const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sarra').then(async () => {
  console.log('Connected to MongoDB');
  try {
    const Announcement = require('./models/Announcement');
    await Announcement.collection.dropIndex('slug_1');
    console.log('Successfully dropped slug_1 index');
  } catch (err) {
    console.log('Error dropping index (it may not exist):', err.message);
  }
  process.exit(0);
});
