const bootstrap = JSON.parse(document.querySelector("#lab-data").textContent);
const get = (id) => document.getElementById(id);
const floor = get("floor");
const cells = [...document.querySelectorAll(".cell")];
const rows = bootstrap.grid.length;
const columns = bootstrap.grid[0].length;
const defaultGrid = bootstrap.grid.map((row) => [...row]);
const terrainNames = {
  ".": "Open aisle",
  "~": "Crowded cell",
  "#": "Shelf",
  X: "Restricted zone",
  S: "Packing station",
  G: "Dispatch station",
};
const terrainClasses = {
  ".": "terrain-open",
  "~": "terrain-crowd",
  "#": "terrain-shelf",
  X: "terrain-restricted",
  S: "terrain-start",
  G: "terrain-goal",
};
const algorithmMeta = [
  ["bfs", "BFS", "Breadth-First Search", "Expands cells in distance layers. Guarantees the fewest moves."],
  ["dfs", "DFS", "Depth-First Search", "Follows a branch before backtracking. The route depends on neighbor order."],
  ["greedy", "Greedy", "Greedy Best-First Search", "Prioritizes the lowest Manhattan distance to dispatch."],
  ["astar", "A*", "A* Search", "Prioritizes total cost so far plus the Manhattan estimate."],
];
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const algorithmButtons = [...document.querySelectorAll("[data-algorithm]")];
const paletteButtons = [...document.querySelectorAll("[data-paint]")];
const scenarioSelect = get("scenario");
const progress = get("progress");
const play = get("play");

let grid = loadSavedMap() ?? defaultGrid.map((row) => [...row]);
let data = { algorithms: [], scenarios: {} };
let mode = "search";
let selected = "astar";
let paintType = ".";
let frames = [];
let finish = 0;
let frameIndex = 0;
let timer = null;
let painting = false;
let strokeChanged = false;
let strokeStart = null;
let undoStack = [];
let redoStack = [];

function cloneGrid(source = grid) {
  return source.map((row) => [...row]);
}

function sameGrid(a, b) {
  return a.every((row, r) => row.every((value, c) => value === b[r][c]));
}

function loadSavedMap() {
  try {
    const saved = JSON.parse(localStorage.getItem("warehouse-lab-map"));
    if (saved?.length === rows && saved.every((row) => row.length === columns)) {
      return saved.map((row) => [...row]);
    }
  } catch {
    localStorage.removeItem("warehouse-lab-map");
  }
  return null;
}

function locate(symbol, source = grid) {
  for (let row = 0; row < rows; row += 1) {
    const column = source[row].indexOf(symbol);
    if (column !== -1) return [row, column];
  }
  return null;
}

function key([row, column]) {
  return `${row},${column}`;
}

function position(value) {
  return value.split(",").map(Number);
}

function neighbors([row, column], source) {
  const candidates = [
    [row, column + 1],
    [row + 1, column],
    [row, column - 1],
    [row - 1, column],
  ];
  return candidates.filter(([r, c]) => (
    r >= 0 && r < rows && c >= 0 && c < columns && !"#X".includes(source[r][c])
  ));
}

function entryCost([row, column], source = grid) {
  return source[row][column] === "~" ? 4 : 1;
}

function pathCost(path, source = grid) {
  return path.slice(1).reduce((total, step) => total + entryCost(step, source), 0);
}

function manhattan(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function buildResult(parents, end, expanded, started, source) {
  const path = [];
  let cursor = end;
  while (cursor) {
    path.push(position(cursor));
    cursor = parents.get(cursor);
  }
  path.reverse();
  return {
    path,
    order: expanded.map(position),
    reached: path.length > 0,
    moves: path.length ? path.length - 1 : null,
    cost: path.length ? pathCost(path, source) : null,
    expanded: expanded.length,
    elapsed_ms: performance.now() - started,
  };
}

function uninformed(source, start, goal, depthFirst) {
  const started = performance.now();
  const frontier = [key(start)];
  const parents = new Map([[key(start), null]]);
  const expanded = [];
  while (frontier.length) {
    const currentKey = depthFirst ? frontier.pop() : frontier.shift();
    const current = position(currentKey);
    if (currentKey === key(goal)) {
      return buildResult(parents, currentKey, expanded, started, source);
    }
    expanded.push(currentKey);
    let next = neighbors(current, source);
    if (depthFirst) next = next.reverse();
    next.forEach((neighbor) => {
      const neighborKey = key(neighbor);
      if (!parents.has(neighborKey)) {
        parents.set(neighborKey, currentKey);
        frontier.push(neighborKey);
      }
    });
  }
  return buildResult(parents, null, expanded, started, source);
}

function informed(source, start, goal, useCost) {
  const started = performance.now();
  let sequence = 0;
  const frontier = [{ priority: manhattan(start, goal), sequence, cost: 0, node: start }];
  const parents = new Map([[key(start), null]]);
  const costs = new Map([[key(start), 0]]);
  const expanded = [];
  while (frontier.length) {
    frontier.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
    const current = frontier.shift();
    const currentKey = key(current.node);
    if (useCost && current.cost !== costs.get(currentKey)) continue;
    if (currentKey === key(goal)) {
      return buildResult(parents, currentKey, expanded, started, source);
    }
    expanded.push(currentKey);
    neighbors(current.node, source).forEach((neighbor) => {
      const neighborKey = key(neighbor);
      const candidate = current.cost + entryCost(neighbor, source);
      const undiscovered = !parents.has(neighborKey);
      const improved = useCost && candidate < (costs.get(neighborKey) ?? Infinity);
      if (undiscovered || improved) {
        parents.set(neighborKey, currentKey);
        costs.set(neighborKey, candidate);
        sequence += 1;
        frontier.push({
          priority: manhattan(neighbor, goal) + (useCost ? candidate : 0),
          sequence,
          cost: candidate,
          node: neighbor,
        });
      }
    });
  }
  return buildResult(parents, null, expanded, started, source);
}

function runAlgorithm(id, source, start, goal) {
  if (id === "bfs") return uninformed(source, start, goal, false);
  if (id === "dfs") return uninformed(source, start, goal, true);
  return informed(source, start, goal, id === "astar");
}

function emptyResult() {
  return {
    path: [], order: [], reached: false, moves: null, cost: null,
    expanded: 0, elapsed_ms: 0,
  };
}

function trolleyExperiment(source, start, goal, placement) {
  const initial = runAlgorithm("astar", source, start, goal);
  if (initial.path.length < 3) {
    return {
      ...emptyResult(), original: initial.path, revised: [],
      before: initial.path, trolley: null, replans: 0,
    };
  }
  const trolleyIndex = placement === "detour"
    ? Math.max(1, Math.min(initial.path.length - 2, Math.floor(initial.path.length * 0.55)))
    : initial.path.length - 2;
  const trolley = initial.path[trolleyIndex];
  const before = initial.path.slice(0, trolleyIndex);
  const revisedMap = cloneGrid(source);
  revisedMap[trolley[0]][trolley[1]] = "X";
  const revised = runAlgorithm("astar", revisedMap, before.at(-1), goal);
  const traveled = revised.path.length ? before.concat(revised.path.slice(1)) : before;
  return {
    original: initial.path,
    revised: revised.path,
    before,
    trolley,
    reached: revised.path.length > 0,
    moves: traveled.length - 1,
    cost: pathCost(traveled, source),
    expanded: initial.expanded + revised.expanded,
    elapsed_ms: initial.elapsed_ms + revised.elapsed_ms,
    replans: 1,
  };
}

function recompute() {
  const start = locate("S");
  const goal = locate("G");
  if (!start || !goal) {
    data.algorithms = algorithmMeta.map(([id, label, name, description]) => ({
      id, label, name, description, ...emptyResult(),
    }));
    data.scenarios = {
      detour: { ...emptyResult(), replans: 0 },
      blocked: { ...emptyResult(), replans: 0 },
    };
    updateResults();
    loadExperiment();
    const missing = [!start && "a packing station", !goal && "a dispatch station"].filter(Boolean).join(" and ");
    get("editor-status").textContent = `Place ${missing} to run the search.`;
    return;
  }
  data.algorithms = algorithmMeta.map(([id, label, name, description]) => ({
    id, label, name, description, ...runAlgorithm(id, grid, start, goal),
  }));
  data.scenarios = {
    detour: trolleyExperiment(grid, start, goal, "detour"),
    blocked: trolleyExperiment(grid, start, goal, "blocked"),
  };
  updateResults();
  loadExperiment();
}

function metric(value) {
  return value === null || value === undefined ? "—" : value;
}

function updateResults() {
  get("algorithm-results").innerHTML = data.algorithms.map((result) => `
    <tr class="${result.id === "astar" ? "best-row" : ""}">
      <th scope="row">${result.name}</th>
      <td>${result.reached ? "Yes" : "No"}</td>
      <td>${metric(result.moves)}</td>
      <td>${metric(result.cost)}</td>
      <td>${result.expanded}</td>
      <td>${result.elapsed_ms.toFixed(3)}</td>
    </tr>`).join("");
  const scenarios = [["detour", "Middle route"], ["blocked", "Dispatch approach"]];
  get("trolley-results").innerHTML = scenarios.map(([id, label]) => {
    const result = data.scenarios[id];
    return `<tr>
      <th scope="row">${label}</th>
      <td>${result.reached ? "Yes" : "No"}</td>
      <td>${metric(result.moves)}</td>
      <td>${metric(result.cost)}</td>
      <td>${result.expanded}</td>
      <td>${result.elapsed_ms.toFixed(3)}</td>
      <td>${result.replans}</td>
    </tr>`;
  }).join("");
  const bfs = data.algorithms[0];
  const astar = data.algorithms[3];
  get("comparison-note").innerHTML = bfs.reached && astar.reached
    ? `<strong>Current map.</strong> BFS uses ${bfs.moves} moves at cost ${bfs.cost}. A* uses ${astar.moves} moves at cost ${astar.cost}.`
    : "<strong>Current map.</strong> No complete route is available for comparison.";
}

function renderGrid() {
  cells.forEach((cell, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const symbol = grid[row][column];
    Object.values(terrainClasses).forEach((className) => cell.classList.remove(className));
    cell.classList.add(terrainClasses[symbol]);
    cell.querySelector("span").textContent = symbol === "~" ? "4" : "SG".includes(symbol) ? symbol : "";
    cell.setAttribute("aria-label", `${terrainNames[symbol]} at row ${row}, column ${column}`);
  });
}

function searchFrames(algorithm) {
  const initialMessage = algorithm.reached
    ? "Ready to search from packing."
    : "No route reaches dispatch on this map.";
  const steps = [{ message: initialMessage }];
  algorithm.order.forEach(([row, column], index) => {
    steps.push({
      visited: index + 1,
      message: `Expanded (${row}, ${column}) · ${index + 1} of ${algorithm.expanded}`,
    });
  });
  if (!algorithm.reached) return steps;
  steps.push({
    visited: algorithm.expanded,
    route: [],
    robot: algorithm.path[0],
    message: "Route found. Leaving packing.",
  });
  algorithm.path.slice(1).forEach((robot, index) => {
    const moves = index + 1;
    steps.push({
      visited: algorithm.expanded,
      route: algorithm.path.slice(0, moves + 1),
      robot,
      message: moves === algorithm.moves
        ? `Dispatch reached · ${moves} moves · cost ${algorithm.cost}`
        : `Following the route · move ${moves} of ${algorithm.moves}`,
    });
  });
  return steps;
}

function trolleyFrames(experiment) {
  if (!experiment.trolley) {
    return [{ message: "A complete A* route is needed before a trolley can be placed." }];
  }
  const steps = experiment.before.map((robot, index) => ({
    original: experiment.original,
    robot,
    message: index === 0
      ? "Original A* route planned on the known map."
      : `Following the original route · move ${index}`,
  }));
  const [row, column] = experiment.trolley;
  const detection = {
    original: experiment.original,
    traveled: experiment.before,
    trolley: experiment.trolley,
    robot: experiment.before.at(-1),
    message: `Trolley detected at (${row}, ${column}). Robot stopped before entering.`,
  };
  steps.push(detection);
  if (!experiment.reached) {
    steps.push({ ...detection, message: "Replanning failed. No alternative reaches dispatch." });
    return steps;
  }
  steps.push({
    ...detection,
    route: experiment.revised,
    message: "A* found a revised route from the robot’s current cell.",
  });
  experiment.revised.slice(1).forEach((robot, index) => {
    steps.push({
      ...detection,
      route: experiment.revised.slice(0, index + 2),
      robot,
      message: index === experiment.revised.length - 2
        ? `Dispatch reached after 1 replan · ${experiment.moves} moves · cost ${experiment.cost}`
        : `Following the revised route · move ${index + experiment.before.length}`,
    });
  });
  return steps;
}

function drawPath(path = [], kind) {
  path.slice(1).forEach(([row, column], index) => {
    const [previousRow, previousColumn] = path[index];
    const vertical = row !== previousRow;
    const segment = document.createElement("i");
    segment.className = `segment ${kind} ${vertical ? "vertical" : ""}`;
    segment.style.left = `${((column + previousColumn + 1) / (columns * 2)) * 100}%`;
    segment.style.top = `${((row + previousRow + 1) / (rows * 2)) * 100}%`;
    segment.style[vertical ? "height" : "width"] = `${100 / (vertical ? rows : columns)}%`;
    get("paths").append(segment);
  });
}

function cellAt([row, column]) {
  return cells[row * columns + column];
}

function render(animate = false) {
  const frame = frames[frameIndex] ?? { message: "Edit the map to begin." };
  get("paths").replaceChildren();
  cells.forEach((cell) => cell.classList.remove("is-visited", "is-trolley"));
  if (mode === "search") {
    const algorithm = data.algorithms.find((item) => item.id === selected);
    algorithm.order.slice(0, frame.visited ?? 0).forEach((step) => {
      cellAt(step).classList.add("is-visited");
    });
  }
  drawPath(frame.original, "original");
  drawPath(frame.traveled, "traveled");
  drawPath(frame.route, "current");
  if (frame.trolley) cellAt(frame.trolley).classList.add("is-trolley");
  const robot = get("robot");
  robot.classList.toggle("is-moving", animate);
  robot.hidden = !frame.robot;
  if (frame.robot) {
    const [row, column] = frame.robot;
    robot.style.left = `${((column + 0.5) / columns) * 100}%`;
    robot.style.top = `${((row + 0.5) / rows) * 100}%`;
    robot.classList.toggle("station", "SG".includes(grid[row][column]));
  }
  progress.value = frameIndex;
  progress.setAttribute("aria-valuetext", `Step ${frameIndex} of ${finish}`);
  get("status").textContent = frame.message;
  get("step").disabled = frameIndex === finish;
}

function stop() {
  window.clearTimeout(timer);
  timer = null;
  play.textContent = "Play";
}

function loadExperiment() {
  stop();
  const trolleyMode = mode === "trolley";
  const result = trolleyMode
    ? data.scenarios[scenarioSelect.value]
    : data.algorithms.find((item) => item.id === selected);
  modeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });
  algorithmButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.algorithm === selected));
  });
  get("algorithms").hidden = trolleyMode;
  scenarioSelect.hidden = !trolleyMode;
  get("scenario-label").hidden = !trolleyMode;
  get("visited-key").hidden = trolleyMode;
  get("original-key").hidden = !trolleyMode;
  get("traveled-key").hidden = !trolleyMode;
  get("trolley-key").hidden = !trolleyMode;
  get("route-key").textContent = trolleyMode ? "Revised route" : "Selected route";
  get("control-title").textContent = trolleyMode ? "Trolley replanning" : "Search algorithm";
  get("selection-title").textContent = trolleyMode
    ? result.trolley ? result.reached ? "Detour available" : "No detour available" : "Route required"
    : result.name;
  get("selection-detail").textContent = trolleyMode
    ? "The trolley is placed on the current A* route and discovered one cell before impact."
    : result.description;
  get("moves").textContent = metric(result.moves);
  get("cost").textContent = metric(result.cost);
  get("expanded").textContent = result.expanded;
  get("last-metric-label").textContent = trolleyMode ? "Replans" : "Runtime";
  get("last-metric").textContent = trolleyMode
    ? result.replans
    : `${result.elapsed_ms.toFixed(3)} ms`;
  frames = trolleyMode ? trolleyFrames(result) : searchFrames(result);
  finish = Math.max(0, frames.length - 1);
  frameIndex = finish;
  progress.max = finish;
  render();
}

function advance() {
  frameIndex += 1;
  render(true);
  if (frameIndex === finish) {
    stop();
    return;
  }
  const trolleyPause = mode === "trolley" && frames[frameIndex].message.startsWith("Trolley detected");
  timer = window.setTimeout(advance, trolleyPause ? 1100 : mode === "trolley" ? 230 : 90);
}

function updateHistoryButtons() {
  get("undo").disabled = undoStack.length === 0;
  get("redo").disabled = redoStack.length === 0;
}

function commitChange(previous) {
  if (sameGrid(previous, grid)) return;
  undoStack.push(previous);
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function paintCell(index) {
  const row = Math.floor(index / columns);
  const column = index % columns;
  if (grid[row][column] === paintType) return;
  if ("SG".includes(paintType)) {
    const old = locate(paintType);
    if (old) grid[old[0]][old[1]] = ".";
  }
  grid[row][column] = paintType;
  strokeChanged = true;
  renderGrid();
  recompute();
}

function beginStroke(index) {
  stop();
  painting = true;
  strokeChanged = false;
  strokeStart = cloneGrid();
  paintCell(index);
}

function endStroke() {
  if (!painting) return;
  painting = false;
  if (strokeChanged) commitChange(strokeStart);
  strokeStart = null;
}

cells.forEach((cell) => {
  cell.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    beginStroke(Number(cell.dataset.index));
  });
  cell.addEventListener("pointerenter", () => {
    if (painting) paintCell(Number(cell.dataset.index));
  });
  cell.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    const previous = cloneGrid();
    paintCell(Number(cell.dataset.index));
    commitChange(previous);
  });
});
document.addEventListener("pointermove", (event) => {
  if (!painting || event.pointerType !== "touch") return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".cell");
  if (target) paintCell(Number(target.dataset.index));
});
document.addEventListener("pointerup", endStroke);
document.addEventListener("pointercancel", endStroke);

paletteButtons.forEach((button) => button.addEventListener("click", () => {
  paintType = button.dataset.paint;
  paletteButtons.forEach((option) => {
    option.setAttribute("aria-pressed", String(option === button));
  });
  get("editor-status").textContent = `${terrainNames[paintType]} selected. Click or drag across the grid.`;
}));

get("undo").addEventListener("click", () => {
  if (!undoStack.length) return;
  redoStack.push(cloneGrid());
  grid = undoStack.pop();
  updateHistoryButtons();
  renderGrid();
  recompute();
});
get("redo").addEventListener("click", () => {
  if (!redoStack.length) return;
  undoStack.push(cloneGrid());
  grid = redoStack.pop();
  updateHistoryButtons();
  renderGrid();
  recompute();
});
get("save-map").addEventListener("click", () => {
  localStorage.setItem("warehouse-lab-map", JSON.stringify(grid));
  get("editor-status").textContent = "Custom map saved in this browser.";
});
get("reset-map").addEventListener("click", () => {
  const previous = cloneGrid();
  grid = cloneGrid(defaultGrid);
  localStorage.removeItem("warehouse-lab-map");
  commitChange(previous);
  renderGrid();
  recompute();
  get("editor-status").textContent = "Restored the designed warehouse map.";
});
get("clear-map").addEventListener("click", () => {
  const previous = cloneGrid();
  grid = Array.from({ length: rows }, () => Array(columns).fill("."));
  grid[1][1] = "S";
  grid[rows - 2][columns - 2] = "G";
  commitChange(previous);
  renderGrid();
  recompute();
  get("editor-status").textContent = "Cleared obstacles and placed stations in opposite corners.";
});

play.addEventListener("click", () => {
  if (timer !== null) {
    stop();
    return;
  }
  if (frameIndex === finish) {
    frameIndex = 0;
    render();
  }
  if (finish === 0) return;
  play.textContent = "Pause";
  timer = window.setTimeout(advance, 250);
});
get("step").addEventListener("click", () => {
  stop();
  if (frameIndex < finish) frameIndex += 1;
  render(true);
});
get("reset").addEventListener("click", () => {
  stop();
  frameIndex = 0;
  render();
});
progress.addEventListener("input", () => {
  stop();
  frameIndex = Number(progress.value);
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

renderGrid();
updateHistoryButtons();
recompute();
