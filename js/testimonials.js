(function () {
  const slider = document.querySelector(".testimonial-slider");
  if (!slider) return;

  const ORIGINAL_CARDS = Array.from(document.querySelectorAll(".testimonial-card"));
  const BREAKPOINT = 768;
  let mode = window.innerWidth >= BREAKPOINT ? "desktop" : "mobile";
  let intervalId = null;
  let currentIndex = 0;

  function clearIntervalIfAny() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function renderOriginals() {
    slider.innerHTML = "";
    ORIGINAL_CARDS.forEach(card => slider.appendChild(card.cloneNode(true)));
  }

  function setupDesktop() {
    clearIntervalIfAny();
    renderOriginals();
    Array.from(slider.children).forEach(c => slider.appendChild(c.cloneNode(true)));
    slider.style.transition = "";
    slider.style.transform = "";
  }

  function setupMobile() {
    clearIntervalIfAny();
    renderOriginals();
    slider.style.transition = "transform 0.5s ease-in-out";
    currentIndex = 0;
    slider.style.transform = "translateX(0%)";

    intervalId = setInterval(() => {
      const total = ORIGINAL_CARDS.length;
      currentIndex = (currentIndex + 1) % total;
      slider.style.transform = `translateX(${-currentIndex * 100}%)`;
    }, 3000);
  }

  if (mode === "desktop") setupDesktop();
  else setupMobile();

  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    const newWidth = window.innerWidth;
    if (Math.abs(newWidth - lastWidth) < 50) { lastWidth = newWidth; return; }
    const newMode = newWidth >= BREAKPOINT ? "desktop" : "mobile";
    if (newMode !== mode) {
      mode = newMode;
      if (mode === "desktop") setupDesktop();
      else setupMobile();
    }
    lastWidth = newWidth;
  });
})();