(function () {
  // Inject CSS
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "chatbot.css";
  document.head.appendChild(link);

  // Create Widget HTML
  const widget = document.createElement("div");
  widget.className = "chatbot-widget";
  widget.innerHTML = `
        <div class="chatbot-window" id="chatbot-window">
            <div class="chatbot-header">
                <h3>Kanha AI Assistant</h3>
                <button class="close-btn" id="close-chat">&times;</button>
            </div>
            <div class="chatbot-messages" id="chatbot-messages">
                <div class="message bot">Hello! 👋 I can help you with seat availability, booking details, pricing, and extensions. Ask me anything!</div>
            </div>
            <div class="chatbot-input-area">
                <input type="text" id="chat-input" placeholder="Type your message..." />
                <button id="send-btn">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                </button>
            </div>
        </div>
        <div class="chatbot-toggle" id="chatbot-toggle">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"></path></svg>
        </div>
    `;
  document.body.appendChild(widget);

  // Elements
  const toggleBtn = document.getElementById("chatbot-toggle");
  const closeBtn = document.getElementById("close-chat");
  const windowEl = document.getElementById("chatbot-window");
  const messagesEl = document.getElementById("chatbot-messages");
  const inputEl = document.getElementById("chat-input");
  const sendBtn = document.getElementById("send-btn");

  let userMobile = null;

  // Functions
  function toggleChat() {
    const isOpen = windowEl.classList.contains("open");
    if (isOpen) {
      windowEl.classList.remove("open");
    } else {
      windowEl.classList.add("open");
      inputEl.focus();
      checkUserIdentity();
    }
  }

  function checkUserIdentity() {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.mobile) {
          userMobile = user.mobile;
        }
      } catch (e) {
        console.error("Error parsing user data", e);
      }
    }

    // If no mobile found, ask for it in chat flow (handled in sendMessage)
  }

  function appendMessage(text, type) {
    const div = document.createElement("div");
    div.className = `message ${type}`;
    div.innerText = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    inputEl.value = "";

    // Handle Mobile Number Collection Flow
    if (!userMobile) {
      // Check if input looks like a mobile number
      if (/^\d{10}$/.test(text)) {
        userMobile = text;
        appendMessage("Thanks! Identifying you...", "bot");
        // Proceed to process the *previous* intent or just welcome?
        // Let's just say "What can I do for you?"
        appendMessage("Verified. What can I help you with today?", "bot");
        return;
      } else {
        appendMessage(
          "Please enter your 10-digit mobile number so I can check your details.",
          "bot",
        );
        return;
      }
    }

    // Send to Backend
    try {
      const res = await fetch("https://kanhabackend.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, mobile: userMobile }),
      });
      const data = await res.json();
      appendMessage(data.reply, "bot");
    } catch (err) {
      appendMessage(
        "Sorry, I'm having trouble connecting to the server.",
        "bot",
      );
    }
  }

  // Event Listeners
  toggleBtn.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
})();
