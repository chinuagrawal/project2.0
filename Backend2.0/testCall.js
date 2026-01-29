require('dotenv').config();
const { makeVoiceCall } = require('./utils/twilioService');

const testNumber = process.argv[2];

if (!testNumber) {
  console.error('❌ Please provide a phone number to test.');
  console.log('Usage: node testCall.js <phone_number>');
  console.log('Example: node testCall.js +919876543210');
  process.exit(1);
}

console.log(`Testing call to ${testNumber}...`);

makeVoiceCall(testNumber, "Hello! This is a test call from Kanha Library. Your audio setup is working perfectly.")
  .then(call => {
    if (call) console.log('✅ Call successfully initiated! SID:', call.sid);
    else console.log('❌ Call failed to initiate (check logs).');
  })
  .catch(err => console.error('❌ Error:', err));
