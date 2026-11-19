# AI-Based Route Planning for a Warehouse Delivery Robot

A robot must carry a package from packing to dispatch through a warehouse with shelves, restricted zones and crowded aisles. The project compares four search algorithms on a shared grid and simulates a previously unknown trolley blocking a planned route.

## Search problem

- **State:** the robot's current coordinate `(row, column)`.
- **Initial state:** the packing station at `(1, 1)` on the designed map, using zero-based coordinates. The editor can move it.
- **Actions and transitions:** move one cell up, down, left or right. Out-of-bounds cells, shelves and restricted zones cannot be entered.
- **Goal test:** the current coordinate equals the dispatch station at `(1, 14)` on the designed map. The editor can move it.
- **Path cost:** sum the costs of entered cells. Ordinary cells cost 1 and crowded cells cost 4. The initial cell is free.

## Run locally

Requires Python 3.10 or newer. From the repository root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m flask --app app run
```

Open <http://127.0.0.1:5000>. On macOS or Linux, use `.venv/bin/python` in the last two commands.

Select an algorithm to show its route or choose **Trolley replanning** to switch between the two obstacle locations. Use **Play** to replay from the start, **Step** and **Reset** to inspect one event at a time, or drag the timeline to a specific frame.

The 10 by 16 map is editable. Select Open, Crowded, Shelf, Restricted, Packing, or Dispatch and click or drag over cells. Start and destination tools automatically move their unique station. Every edit immediately recalculates all four algorithms, both trolley experiments, the metric cards, and the comparison tables. Undo and Redo maintain up to 60 map states. Save stores the current map in browser storage, Reset restores the designed scenario, and Clear creates an open map with stations in opposite corners.

Flask serves HTML, vanilla JavaScript, and compiled Tailwind CSS. Node.js is only needed to rebuild the styles after editing `styles/lab.css` or the template:

```powershell
npx --yes tailwindcss@3.4.17 -i styles/lab.css -o static/lab.css --content "templates/**/*.html" --minify
```

## Algorithms

| Algorithm | Frontier priority |
| --- | --- |
| BFS | Earliest discovered cell first. Finds a path with the fewest moves. |
| DFS | Most recently scheduled cell first. The path depends on neighbor order. |
| Greedy Best-First | Lowest Manhattan distance to dispatch. |
| A* | Lowest cost already paid plus Manhattan distance to dispatch. |

Manhattan distance is `abs(row - goal_row) + abs(column - goal_column)`. Each legal move reduces this distance by at most one and costs at least 1. The distance is therefore a lower bound on the remaining travel cost. Shelves, restricted zones, and crowded cells can only increase the actual cost.

## Sample results

| Algorithm | Goal reached | Moves | Cost | Nodes expanded | Sample time (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| BFS | Yes | 17 | 23 | 54 | Varies |
| DFS | Yes | 31 | 31 | 32 | Varies |
| Greedy Best-First | Yes | 17 | 23 | 17 | Varies |
| A* | Yes | 21 | 21 | 34 | Varies |

BFS finds a 17-move route that crosses crowded cells and costs 23. A* takes 21 moves through the interior aisles and lowers the cost to 21. Editing any cell recalculates these values in the browser.

| Trolley location | Goal reached | Moves traveled | Cost paid | Nodes expanded | Sample time (ms) | Replans |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Middle of current A* route | Depends on map | Dynamic | Dynamic | Dynamic | Varies | 1 |
| Near dispatch on current A* route | Depends on map | Dynamic | Dynamic | Dynamic | Varies | 1 |

The robot plans on its known map and detects the trolley just before entering the blocked cell. It stops in its current cell, updates the map, and reruns A*. Trolley placement follows the current A* route, so both experiments remain meaningful after map edits. Moves and cost count the robot's actual travel, and search totals include both A* calls.

An expanded node is a cell whose successors are examined. The goal and stale priority-queue entries are excluded. Times are single-run measurements in the browser and vary by machine. Rendering and animation time are excluded.

## Screenshots

[Editable 10 by 16 map and trolley replanning](screenshots/custom-map-editor.png) · [Original route comparison](screenshots/route-comparison.png)

## Group details

Group number and member names, roll numbers, and contributions are pending the group's details.
