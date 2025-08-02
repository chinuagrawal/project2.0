// removeSeatPrefix.js

const mongoose = require('mongoose');
const Booking = require('./models/Booking');


const DB_URI = 'mongodb+srv://chinmayagrawal:Chinu%402003@cluster0.wy88sf7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'; // Change to your DB URL

mongoose.connect(DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function updateSeatIds(Model, modelName) {
  const records = await Model.find({ seatId: /^S\d+/ });

  for (const record of records) {
    const oldSeatId = record.seatId;
    const newSeatId = oldSeatId.replace(/^S/, '');
    record.seatId = newSeatId;
    await record.save();
    console.log(`[${modelName}] Updated: ${oldSeatId} → ${newSeatId}`);
  }
}

(async () => {
  try {
    await updateSeatIds(Booking, 'Booking');
    
    console.log('✅ All seatId updates completed.');
  } catch (err) {
    console.error('❌ Error updating seatIds:', err);
  } finally {
    mongoose.disconnect();
  }
})();
