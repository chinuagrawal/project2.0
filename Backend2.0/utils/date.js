exports.getToday = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

exports.getMonth = () => {
  const d = new Date();
  return d.toISOString().slice(0, 7); // YYYY-MM
};

exports.getPreviousMonth = (month) => {
  const [y, m] = month.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  return prev.toISOString().slice(0, 7);
};
