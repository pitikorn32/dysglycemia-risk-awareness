import { ScenarioExplorer } from "./scenario/ScenarioExplorer";
import "./styles.css";

// Hand-authored inputs from the synthetic planner reference case.
const baseline = [0.04, 0.07, 0.10, 0.14, 0.18].map((probability, index) => ({
  horizon_years: index + 1,
  probability,
}));
const anchors = { bmi: 27, exercise: 2, fruitVegetable: 5, sugaryDrinks: 5 };

export function ScenarioDemo() {
  return (
    <main id="main-content" className="public-demo">
      <h1>Dysglycemia scenario explorer</h1>
      <p>
        This synthetic example starts at BMI 27 kg/m², with 2 exercise sessions,
        5 fruit or vegetable servings and 5 sugary drinks per week. Its five
        baseline probabilities are illustrative. Adjust the controls to explore
        how the published assumptions change the trajectory.
      </p>
      <ScenarioExplorer anchors={anchors} baseline={baseline} />
    </main>
  );
}
