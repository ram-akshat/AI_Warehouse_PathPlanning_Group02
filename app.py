"""Serve the warehouse route planning lab."""

from flask import Flask, render_template

from informed import astar, greedy
from search import bfs, dfs
from simulation import simulate
from warehouse import WAREHOUSE

app = Flask(__name__)

ALGORITHMS = (
    ("bfs", "BFS", "Breadth-First Search", "Expands cells in distance layers. Guarantees the fewest moves.", bfs),
    ("dfs", "DFS", "Depth-First Search", "Follows a branch before backtracking. The route depends on neighbor order.", dfs),
    ("greedy", "Greedy", "Greedy Best-First Search", "Prioritizes the lowest Manhattan distance to dispatch.", greedy),
    ("astar", "A*", "A* Search", "Prioritizes total cost so far plus the Manhattan estimate.", astar),
)
SCENARIOS = (("detour", (5, 5)), ("blocked", (2, 9)))


@app.get("/")
def index():
    warehouse = WAREHOUSE
    algorithms = []
    for key, label, name, description, search in ALGORITHMS:
        result = search(warehouse, warehouse.start)
        algorithms.append({
            "id": key, "label": label, "name": name, "description": description,
            "path": result.path, "order": result.expanded, **result.metrics(warehouse),
        })
    scenarios = {}
    for key, trolley in SCENARIOS:
        result = simulate(warehouse, trolley)
        scenarios[key] = {
            "original": result.initial.path,
            "revised": result.revised.path,
            "before": result.traveled_before_detection,
            "trolley": trolley,
            **result.metrics(warehouse),
        }
    data = {"algorithms": algorithms, "scenarios": scenarios}
    return render_template("index.html", grid=warehouse.grid, data=data)
