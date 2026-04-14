const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  stage: {
    type: String,
    enum: ['Ideation', 'Problem', 'Build', 'Patent', 'Launch']
  }
});

const TestModel = mongoose.model('TestRegexEnum', testSchema);

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/promove');
    const q1 = await TestModel.find({ stage: /Arjun/i });
    console.log("Q1 successful:", q1);
  } catch (err) {
    console.error("Q1 threw an error:", err.message);
  }

  try {
    const q2 = await TestModel.find({ $or: [{ stage: /Arjun/i }] });
    console.log("Q2 successful:", q2);
  } catch (err) {
    console.error("Q2 threw an error:", err.message);
  }
  process.exit(0);
}

run();
