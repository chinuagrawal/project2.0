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

// Helper: Get Detailed Library State
async function getLibraryState() {
  const today = getToday();
  const tomorrow = getTomorrow();
  const totalSeats = 34;

  const bookings = await Booking.find({
    date: { $in: [today, tomorrow] },
    status: "paid",
  });

  const state = {
    [today]: { full: [], am: [], pm: [] },
    [tomorrow]: { full: [], am: [], pm: [] },
  };

  bookings.forEach((b) => {
    if (state[b.date]) {
      // Assume seatId is a number or string number
      const sid = parseInt(b.seatId);
      if (b.shift === "full") state[b.date].full.push(sid);
      else if (b.shift === "am") state[b.date].am.push(sid);
      else if (b.shift === "pm") state[b.date].pm.push(sid);
    }
  });

  // Helper to format list
  const fmt = (list) =>
    list.length > 0 ? list.sort((a, b) => a - b).join(", ") : "None";

  return {
    raw: state,
    summary: {
      today: `Full Day Booked: [${fmt(state[today].full)}], AM Booked: [${fmt(state[today].am)}], PM Booked: [${fmt(state[today].pm)}]`,
      tomorrow: `Full Day Booked: [${fmt(state[tomorrow].full)}], AM Booked: [${fmt(state[tomorrow].am)}], PM Booked: [${fmt(state[tomorrow].pm)}]`,
    },
    counts: {
      today: `AM Free: ${Math.max(0, totalSeats - (state[today].full.length + state[today].am.length))}, PM Free: ${Math.max(0, totalSeats - (state[today].full.length + state[today].pm.length))}`,
      tomorrow: `AM Free: ${Math.max(0, totalSeats - (state[tomorrow].full.length + state[tomorrow].am.length))}, PM Free: ${Math.max(0, totalSeats - (state[tomorrow].full.length + state[tomorrow].pm.length))}`,
    },
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
      userContext = "User not found in database (Unregistered).";
    } else {
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

    const libraryState = await getLibraryState();
    const todayDate = getToday();

    // 2. AI Processing
    if (openai) {
      const systemPrompt = `
        You are 'Kanha AI', the intelligent assistant for Kanha Library (a premium study library in Kota).
        Your goal is to be helpful, friendly, and human-like.
        
        CURRENT CONTEXT:
        - Today's Date: ${todayDate}
        - User Context: ${userContext}
        - Pricing: ${priceText}
        - Library Features: Pin-drop silence, High-speed WiFi, AC, Comfortable chairs.
        
        SEAT STATUS (Total 34 Seats):
        - Today (${todayDate}): ${libraryState.summary.today}
        - Tomorrow: ${libraryState.summary.tomorrow}
        
        (Note: If a seat is listed in 'Full Day Booked', it is unavailable for both AM and PM. If in 'AM Booked', it is unavailable for AM but free for PM.)

        GUIDELINES:
        1. Answer naturally (Hinglish/Hindi/English supported).
        2. If user asks about a SPECIFIC SEAT (e.g., "Is seat 5 free?"), check the SEAT STATUS lists above.
           - If seat 5 is NOT in Today's lists, say "Yes, Seat 5 is available today."
           - If seat 5 is in 'Full Day Booked', say "Seat 5 is fully booked today."
           - If seat 5 is in 'AM Booked', say "Seat 5 is booked for Morning, but available for Evening."
        3. If user asks "When is it getting empty?", check Tomorrow's status. If free tomorrow, say "It will be free tomorrow."
        4. If asked about general availability, use the counts: ${JSON.stringify(libraryState.counts)}.
        5. Keep answers concise.
        `;

      try {
        const completion = await openai.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          model: "gpt-3.5-turbo",
          max_tokens: 200,
        });

        return res.json({ reply: completion.choices[0].message.content });
      } catch (openaiErr) {
        console.error("OpenAI API Failed:", openaiErr);
      }
    }

    // 3. Fallback Logic (Manual)
    const userMessage = message.toLowerCase();

    // --- QUERY: SPECIFIC SEAT CHECK (Regex) ---
    // Matches "seat 5", "seat no 5", "5 number seat"
    const seatMatch =
      userMessage.match(/seat\s*(?:no\.?)?\s*(\d+)/) ||
      userMessage.match(/(\d+)\s*number/);
    if (seatMatch) {
      const seatId = parseInt(seatMatch[1]);
      if (seatId >= 1 && seatId <= 34) {
        const today = getToday();
        const raw = libraryState.raw[today];
        let status = "Available";

        if (raw.full.includes(seatId)) status = "Fully Booked";
        else if (raw.am.includes(seatId)) status = "Booked for Morning (AM)";
        else if (raw.pm.includes(seatId)) status = "Booked for Evening (PM)";

        return res.json({
          reply: `Seat ${seatId} status for Today (${today}): ${status}.`,
        });
      }
    }

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
        reply: `For ${targetDate}: ${targetDate === getTomorrow() ? libraryState.counts.tomorrow : libraryState.counts.today}.`,
      });
    }

    // --- QUERY: BOOKING DETAILS ---
    if (
      userMessage.includes("my booking") ||
      userMessage.includes("details") ||
      userMessage.includes("status")
    ) {
      if (!user) return res.json({ reply: "I couldn't find your account." });
      return res.json({ reply: userContext });
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
    if (
      userMessage.includes("hello") ||
      userMessage.includes("hi") ||
      userMessage.includes("namaste")
    ) {
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
