# AI-Based Route Planning for a Warehouse Delivery Robot

A robot must carry a package from packing to dispatch through a warehouse with shelves, restricted zones and crowded aisles. The project compares four search algorithms on a shared grid and simulates a previously unknown trolley blocking a planned route.

## Search problem

- **State:** the robot's current coordinate `(row, column)`.
- **Initial state:** the packing station at `(2, 1)`, using zero-based coordinates.
- **Actions and transitions:** move one cell up, down, left or right. Out-of-bounds cells, shelves and restricted zones cannot be entered.
- **Goal test:** the current coordinate equals the dispatch station at `(2, 10)`.
- **Path cost:** sum the costs of entered cells. Ordinary cells cost 1 and crowded cells cost 4. The initial cell is free.
