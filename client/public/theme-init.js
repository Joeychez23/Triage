try {
  if (localStorage.getItem("triage.theme") === "dark") document.documentElement.dataset.theme = "dark";
} catch (e) {}
