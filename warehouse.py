"""Warehouse map and weighted search problem."""

from collections.abc import Iterator
from dataclasses import dataclass

Position = tuple[int, int]
DIRECTIONS = ((0, 1), (1, 0), (0, -1), (-1, 0))
BLOCKED = "#X"
LAYOUT = (
    "################",
    "#S..#....~~...G#",
    "#.#.#.##.##.#..#",
    "#.#...#.....#..#",
    "#.###.#.###.#..#",
    "#...#...#...#..#",
    "###.#####.#.#..#",
    "#.......~.#....#",
    "#XX##......##..#",
    "################",
)


@dataclass(frozen=True)
class Warehouse:
    grid: tuple[str, ...]
    start: Position
    goal: Position

    def neighbors(self, position: Position) -> Iterator[Position]:
        row, column = position
        for dr, dc in DIRECTIONS:
            r, c = row + dr, column + dc
            if 0 <= r < len(self.grid) and 0 <= c < len(self.grid[r]):
                if self.grid[r][c] not in BLOCKED:
                    yield r, c

    def entry_cost(self, position: Position) -> int:
        row, column = position
        return 4 if self.grid[row][column] == "~" else 1

    def path_cost(self, path: list[Position]) -> int:
        return sum(self.entry_cost(position) for position in path[1:])

    def with_blockage(self, position: Position) -> "Warehouse":
        row, column = position
        grid = list(self.grid)
        grid[row] = grid[row][:column] + "X" + grid[row][column + 1:]
        return Warehouse(tuple(grid), self.start, self.goal)


WAREHOUSE = Warehouse(LAYOUT, (1, 1), (1, 14))
