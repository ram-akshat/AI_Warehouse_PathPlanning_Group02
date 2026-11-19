const data = JSON.parse(document.querySelector("#lab-data").textContent);
const get = (id) => document.getElementById(id);
const cells = [...document.querySelectorAll(".cell")];
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const algorithmButtons = [...document.querySelectorAll("[data-algorithm]")];
const scenarioSelect = get("scenario");
const progress = get("progress");
const play = get("play");

let mode = "search";
let selected = "astar";
let frames = [];
let finish = 0;
let index = 0;
let timer = null;

function searchFrames(algorithm) {
  const steps = [{ message: "Ready to search from packing." }];
  algorithm.order.forEach(([row, column], i) => {
    steps.push({ visited: i + 1, message: `Expanded (${row}, ${column}) · ${i + 1} of ${algorithm.expanded}` });
  });
  if (!algorithm.reached) {
    steps.push({ visited: algorithm.expanded, message: "No route to dispatch." });
    return steps;
  }
  steps.push({ visited: algorithm.expanded, route: [], robot: algorithm.path[0], message: "Route found. Leaving packing." });
  algorithm.path.slice(1).forEach((position, i) => {
    const moves = i + 1;
    const message = moves === algorithm.moves
      ? `Dispatch reached · ${moves} moves · cost ${algorithm.cost}`
      : `Following the route · move ${moves} of ${algorithm.moves}`;
    steps.push({ visited: algorithm.expanded, route: algorithm.path.slice(0, moves + 1), robot: position, message });
  });
  return steps;
}

function trolleyFrames(experiment) {
  const steps = experiment.before.map((robot, i) => ({
    original: experiment.original, robot,
    message: i === 0 ? "Original A* route planned on the known map." : `Following the original route · move ${i}`,
  }));
  const [row, column] = experiment.trolley;
  const detection = {
    original: experiment.original, traveled: experiment.before, trolley: experiment.trolley,
    robot: experiment.before.at(-1), message: `Trolley detected at (${row}, ${column}). Robot stopped before entering.`,
  };
  steps.push(detection);
  if (!experiment.reached) {
    steps.push({ ...detection, message: "Replanning failed. No alternative reaches dispatch." });
    return steps;
  }
  steps.push({ ...detection, route: experiment.revised, message: "A* found a revised route from the robot’s current cell." });
  experiment.revised.slice(1).forEach((robot, i) => {
    const message = i === experiment.revised.length - 2
      ? `Dispatch reached after 1 replan · ${experiment.moves} moves · cost ${experiment.cost}`
      : `Following the revised route · move ${i + experiment.before.length}`;
    steps.push({ ...detection, route: experiment.revised, robot, message });
  });
  return steps;
}

function drawPath(path, kind) {
  path.slice(1).forEach(([row, column], i) => {
    const [previousRow, previousColumn] = path[i];
    const vertical = row !== previousRow;
    const segment = document.createElement("i");
    segment.className = `segment ${kind} ${vertical ? "vertical" : ""}`;
    segment.style.left = `${((column + previousColumn + 1) / 24) * 100}%`;
    segment.style.top = `${((row + previousRow + 1) / 16) * 100}%`;
    segment.style[vertical ? "height" : "width"] = vertical ? "12.5%" : "8.333333%";
    get("paths").append(segment);
  });
}

function cellAt([row, column]) {
  return cells[row * 12 + column];
}

function render(animate = false) {
  const frame = frames[index];
  get("paths").replaceChildren();
  cells.forEach((cell) => cell.classList.remove("is-visited", "is-trolley"));
  if (mode === "search") {
    const algorithm = data.algorithms.find((item) => item.id === selected);
    algorithm.order.slice(0, frame.visited ?? 0).forEach((position) => cellAt(position).classList.add("is-visited"));
  }
  if (frame.original) drawPath(frame.original, "original");
  if (frame.traveled) drawPath(frame.traveled, "traveled");
  if (frame.route) drawPath(frame.route, "current");
  if (frame.trolley) cellAt(frame.trolley).classList.add("is-trolley");
  const robot = get("robot");
  robot.classList.toggle("is-moving", animate);
  robot.hidden = !frame.robot;
  if (frame.robot) {
    const [row, column] = frame.robot;
    robot.style.left = `${((column + 0.5) / 12) * 100}%`;
    robot.style.top = `${((row + 0.5) / 8) * 100}%`;
    const cell = cellAt(frame.robot);
    robot.classList.toggle("station", cell.classList.contains("terrain-start") || cell.classList.contains("terrain-goal"));
  }
  progress.value = index;
  progress.setAttribute("aria-valuetext", `Step ${index} of ${finish}`);
  get("status").textContent = frame.message;
  get("step").disabled = index === finish;
}

function stop() {
  window.clearTimeout(timer);
  timer = null;
  play.textContent = "Play";
}

function loadExperiment() {
  stop();
  const trolley = mode === "trolley";
  const result = trolley ? data.scenarios[scenarioSelect.value] : data.algorithms.find((item) => item.id === selected);
  modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
  algorithmButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.algorithm === selected)));
  get("algorithms").hidden = trolley;
  scenarioSelect.hidden = !trolley;
  get("scenario-label").hidden = !trolley;
  get("visited-key").hidden = trolley;
  get("original-key").hidden = !trolley;
  get("traveled-key").hidden = !trolley;
  get("trolley-key").hidden = !trolley;
  get("route-key").textContent = trolley ? "Revised route" : "Selected route";
  get("control-title").textContent = trolley ? "Trolley replanning" : "Search algorithm";
  get("selection-title").textContent = trolley ? (result.reached ? "Detour available" : "Dispatch inaccessible") : result.name;
  get("selection-detail").textContent = trolley
    ? "The robot detects the trolley on approach and replans from its current cell."
    : result.description;
  get("moves").textContent = result.moves ?? "—";
  get("cost").textContent = result.cost ?? "—";
  get("expanded").textContent = result.expanded;
  get("last-metric-label").textContent = trolley ? "Replans" : "Runtime";
  get("last-metric").textContent = trolley ? result.replans : `${result.elapsed_ms.toFixed(3)} ms`;
  frames = trolley ? trolleyFrames(result) : searchFrames(result);
  finish = frames.length - 1;
  index = finish;
  progress.max = finish;
  render();
}

function advance() {
  index += 1;
  render(true);
  if (index === finish) {
    stop();
    return;
  }
  const pause = mode === "trolley" && frames[index].message.startsWith("Trolley detected");
  timer = window.setTimeout(advance, pause ? 1100 : mode === "trolley" ? 230 : 150);
}

play.addEventListener("click", () => {
  if (timer !== null) {
    stop();
    return;
  }
  if (index === finish) {
    index = 0;
    render();
  }
  play.textContent = "Pause";
  timer = window.setTimeout(advance, 250);
});
get("step").addEventListener("click", () => {
  stop();
  if (index < finish) index += 1;
  render();
});
get("reset").addEventListener("click", () => {
  stop();
  index = 0;
  render();
});
progress.addEventListener("input", () => {
  stop();
  index = Number(progress.value);
  render();
});
modeButtons.forEach((button) => button.addEventListener("click", () => {
  mode = button.dataset.mode;
  loadExperiment();
}));
algorithmButtons.forEach((button) => button.addEventListener("click", () => {
  selected = button.dataset.algorithm;
  loadExperiment();
}));
scenarioSelect.addEventListener("change", loadExperiment);
loadExperiment();

