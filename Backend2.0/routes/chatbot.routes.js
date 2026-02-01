const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const User = require("../models/User");
const PriceSetting = require("../models/PriceSetting");
const { OpenAI } = require("openai");

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Helper: Dates
const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

const getToday = () => {
  return new Date().toISOString().split("T")[0];
};

// Helper: Get Availability Summary
async function getAvailabilitySummary() {
  const today = getToday();
  const tomorrow = getTomorrow();
  const totalSeats = 34;

  const bookings = await Booking.find({
    date: { $in: [today, tomorrow] },
    status: "paid",
  });

  const stats = {
    [today]: { am: 0, pm: 0, full: 0 },
    [tomorrow]: { am: 0, pm: 0, full: 0 },
  };

  bookings.forEach((b) => {
    if (stats[b.date]) {
      if (b.shift === "full") stats[b.date].full++;
      else if (b.shift === "am") stats[b.date].am++;
      else if (b.shift === "pm") stats[b.date].pm++;
    }
  });

  const format = (date) => {
    const s = stats[date];
    // Approximation: Full shift takes a seat from AM and PM availability
    const occupiedAM = s.full + s.am;
    const occupiedPM = s.full + s.pm;
    return `AM Free: ${Math.max(0, totalSeats - occupiedAM)}, PM Free: ${Math.max(0, totalSeats - occupiedPM)}`;
  };

  return {
    today: format(today),
    tomorrow: format(tomorrow),
  };
}

// POST /api/chat
router.post("/", async (req, res) => {
  const { message, mobile } = req.body;

  if (!mobile) {
    return res.json({
      reply: "Please provide your mobile number to identify you.",
    });
  }

  // 1. Identify User & Gather Context
  let user = null;
  let userContext = "User is unverified/unknown.";

  try {
    user = await User.findOne({ mobile });
    if (!user) {
      // Allow chat but mark as unknown, or strict block?
      // User asked for "genuine answers", let's allow general queries but restrict personal ones.
      userContext = "User not found in database (Unregistered).";
    } else {
      // Fetch User Bookings
      const myBookings = await Booking.find({
        email: user.email,
        status: "paid",
        date: { $gte: getToday() },
      }).sort({ date: 1 });

      const bookingSummary =
        myBookings.length > 0
          ? myBookings
              .map((b) => `${b.date} (${b.shift}) Seat ${b.seatId}`)
              .join(", ")
          : "No active upcoming bookings.";

      userContext = `User: ${user.firstName} ${user.lastName} (${user.email}). Active Bookings: ${bookingSummary}`;
    }

    // Global Context
    const prices = await PriceSetting.findOne();
    const priceText = prices
      ? `Prices: Full Day ₹${prices.full}, AM ₹${prices.am}, PM ₹${prices.pm}`
      : "Prices unavailable.";

    const availability = await getAvailabilitySummary();
    const todayDate = getToday();

    // 2. AI Processing
    if (openai) {
      const systemPrompt = `
        You are 'Kanha AI', the intelligent assistant for Kanha Library (a premium study library in Kota).
        Your goal is to be helpful, friendly, and human-like.
        
        CURRENT CONTEXT:
        - Today's Date: ${todayDate}
        - User Context: ${userContext}
        - Seat Availability: Today [${availability.today}], Tomorrow [${availability.tomorrow}]
        - Pricing: ${priceText}
        - Library Features: Pin-drop silence, High-speed WiFi, AC, Comfortable chairs.
        
        GUIDELINES:
        1. Answer naturally. If asked "How are you?", be polite.
        2. If asked about availability, use the data above.
        3. If asked about booking, say: "You can book directly on our website." (If you can, guide them to the booking page link /booking.html).
        4. If the user wants to book specific shifts (e.g., "I want to book AM"), confirm availability from context and tell them to proceed to the booking page.
        5. Keep answers concise (max 2-3 sentences unless details needed).
        6. Do not make up data. If unsure, say you don't know.
        `;

      try {
        const completion = await openai.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          model: "gpt-3.5-turbo", // Cost-effective and fast
          max_tokens: 150,
        });

        return res.json({ reply: completion.choices[0].message.content });
      } catch (openaiErr) {
        console.error("OpenAI API Failed:", openaiErr);
        // Fallback to manual logic below
      }
    }

    // 3. Fallback Logic (Manual)
    const userMessage = message.toLowerCase();

    // --- QUERY: FREE SEATS ---
    if (
      userMessage.includes("free") ||
      userMessage.includes("available") ||
      userMessage.includes("empty")
    ) {
      const targetDate = userMessage.includes("tomorrow")
        ? getTomorrow()
        : getToday();
      return res.json({
        reply: `For ${targetDate}: ${targetDate === getTomorrow() ? availability.tomorrow : availability.today}.`,
      });
    }

    // --- QUERY: BOOKING DETAILS ---
    if (
      userMessage.includes("my booking") ||
      userMessage.includes("details") ||
      userMessage.includes("status")
    ) {
      if (!user) return res.json({ reply: "I couldn't find your account." });
      return res.json({ reply: userContext }); // Simplified for fallback
    }

    // --- QUERY: EXTENSION ---
    if (userMessage.includes("extend")) {
      return res.json({
        reply:
          "To extend your seat, simply go to the Booking page. If you are logged in, click 'Extend Booking' to keep your current seat.",
      });
    }

    // --- QUERY: PRICE ---
    if (
      userMessage.includes("price") ||
      userMessage.includes("cost") ||
      userMessage.includes("rate")
    ) {
      return res.json({ reply: priceText });
    }

    // --- QUERY: BOOKING INTENT ---
    if (userMessage.includes("book") || userMessage.includes("reservation")) {
      return res.json({
        reply:
          "To book a seat, please visit our Booking page. You can choose your preferred seat and shift there!",
      });
    }

    // --- GENERAL ---
    if (userMessage.includes("hello") || userMessage.includes("hi")) {
      return res.json({
        reply: "Hello! How can I help you with your library seat today?",
      });
    }

    return res.json({
      reply:
        "I'm not sure about that. You can ask me about seat availability, your bookings, expiry dates, or prices!",
    });
  } catch (err) {
    console.error("Chatbot Error:", err);
    return res
      .status(500)
      .json({ reply: "Sorry, I encountered an error checking that for you." });
  }
});

module.exports = router;
