"""Uninformed graph search and shared route metrics."""

from collections import deque
from dataclasses import dataclass
from time import perf_counter_ns

from warehouse import Position, Warehouse


@dataclass
class SearchResult:
    path: list[Position]
    expanded: list[Position]
    elapsed_ms: float

    def metrics(self, warehouse: Warehouse) -> dict:
        return {
            "reached": bool(self.path),
            "moves": len(self.path) - 1 if self.path else None,
            "cost": warehouse.path_cost(self.path) if self.path else None,
            "expanded": len(self.expanded),
            "elapsed_ms": self.elapsed_ms,
        }


def result(
    parents: dict[Position, Position | None],
    end: Position | None,
    expanded: list[Position],
    started: int,
) -> SearchResult:
    path = []
    while end is not None:
        path.append(end)
        end = parents[end]
    path.reverse()
    return SearchResult(path, expanded, (perf_counter_ns() - started) / 1_000_000)


def uninformed(warehouse: Warehouse, start: Position, *, depth_first: bool) -> SearchResult:
    started = perf_counter_ns()
    frontier = deque([start])
    parents = {start: None}
    expanded = []
    take = frontier.pop if depth_first else frontier.popleft
    while frontier:
        current = take()
        if current == warehouse.goal:
            return result(parents, current, expanded, started)
        expanded.append(current)
        neighbors = list(warehouse.neighbors(current))
        if depth_first:
            neighbors.reverse()
        for neighbor in neighbors:
            if neighbor not in parents:
                parents[neighbor] = current
                frontier.append(neighbor)
    return result(parents, None, expanded, started)


def bfs(warehouse: Warehouse, start: Position) -> SearchResult:
    return uninformed(warehouse, start, depth_first=False)


def dfs(warehouse: Warehouse, start: Position) -> SearchResult:
    return uninformed(warehouse, start, depth_first=True)
