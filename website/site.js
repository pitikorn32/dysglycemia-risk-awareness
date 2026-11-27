const figures = {
  assessment_review: ["Five-part assessment review for the synthetic example profile", "Review the five annual slots before submitting an anonymous assessment."],
  manual_scenario: ["Fixed baseline and manual scenario trajectories", "A manual change produces a five-year scenario of 34.1% against the fixed 45.2% baseline."],
  ranked_alternatives: ["Ranked alternative cards and their evidence-corner rank ranges", "The point-ranked alternative gives 29.8% at five years. Its rank varies across the 16 endpoint combinations."],
  local_attribution: ["Grouped model contributions for one selected horizon", "Grouped log-odds contributions show how the frozen model reached its estimate relative to the selected reference."]
};
const controls = document.querySelectorAll("[data-panel]");
for (const button of controls) {
  button.addEventListener("click", () => {
    const key = button.dataset.panel;
    const [description, caption] = figures[key];
    const image = document.querySelector("#figure");
    image.alt = description;
    image.src = "./assets/images/platform_" + key + ".png";
    document.querySelector("#full").href = image.src;
    document.querySelector("#caption").textContent = caption;
    for (const control of controls) control.setAttribute("aria-pressed", String(control === button));
  });
}
