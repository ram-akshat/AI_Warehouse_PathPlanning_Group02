# AI-Based Route Planning for a Warehouse Delivery Robot

A robot must carry a package from packing to dispatch through a warehouse with shelves, restricted zones and crowded aisles. The project compares four search algorithms on a shared grid and simulates a previously unknown trolley blocking a planned route.

## Search problem

- **State:** the robot's current coordinate `(row, column)`.
- **Initial state:** the packing station at `(2, 1)`, using zero-based coordinates.
- **Actions and transitions:** move one cell up, down, left or right. Out-of-bounds cells, shelves and restricted zones cannot be entered.
- **Goal test:** the current coordinate equals the dispatch station at `(2, 10)`.
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
| BFS | Yes | 9 | 24 | 18 | 0.053 |
| DFS | Yes | 9 | 24 | 9 | 0.017 |
| Greedy Best-First | Yes | 9 | 24 | 9 | 0.027 |
| A* | Yes | 15 | 15 | 18 | 0.041 |

BFS finds the shortest route in moves. Its five crowded cells increase the cost to 24. A* bypasses those cells and pays 15 despite making six more moves. DFS and Greedy find the short route on this layout.

| Trolley location | Goal reached | Moves traveled | Cost paid | Nodes expanded | Sample time (ms) | Replans |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Lower aisle (5, 5) | Yes | 21 | 36 | 33 | 0.150 | 1 |
| Dispatch approach (2, 9) | No | 13 | 13 | 38 | 0.131 | 1 |

The robot plans on its known map and detects the trolley just before entering the blocked cell. It stops in its current cell, updates the map, and reruns A*. In the lower aisle it backtracks and crosses the crowded aisle. Blocking the dispatch approach leaves no alternative. Moves and cost count the robot's actual travel, and search totals include both A* calls.

An expanded node is a cell whose successors are examined. The goal and stale priority-queue entries are excluded. Times are single-run search measurements in Python, with no rendering or animation time. The dashboard measures them again on each page load.

## Screenshots

[Route comparison and results](screenshots/route-comparison.png) · [Trolley detected and revised route shown](screenshots/trolley-replanning.png)

## Group details

Group number and member names, roll numbers, and contributions are pending the group's details.
