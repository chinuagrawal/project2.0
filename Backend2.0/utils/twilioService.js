const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * @param {string} to - The recipient's phone number (E.164 format, e.g., +919876543210)
 * @param {string} message - The text message to speak
 * @param {string} [audioUrl] - Optional URL to an MP3 file to play instead of text-to-speech
 */
exports.makeVoiceCall = async (to, message, audioUrl) => {
  if (!client) {
    console.warn('⚠️ Twilio credentials missing. Skipping voice call.');
    return;
  }

  try {
    let twimlResponse;
    if (audioUrl) {
       twimlResponse = `<Response><Play>${audioUrl}</Play></Response>`;
    } else {
       twimlResponse = `<Response><Say voice="alice" language="en-IN">${message}</Say></Response>`;
    }

    const call = await client.calls.create({
      twiml: twimlResponse,
      to: to,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    console.log(`📞 Call initiated to ${to}: ${call.sid}`);
    return call;
  } catch (error) {
    console.error(`❌ Twilio Call Error: ${error.message}`);
  }
};
