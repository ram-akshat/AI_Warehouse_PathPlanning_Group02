"""Greedy Best-First Search and A* with Manhattan distance."""

from heapq import heappop, heappush
from itertools import count
from time import perf_counter_ns

from search import SearchResult, result
from warehouse import Position, Warehouse


def manhattan(position: Position, goal: Position) -> int:
    return abs(position[0] - goal[0]) + abs(position[1] - goal[1])


def greedy(warehouse: Warehouse, start: Position) -> SearchResult:
    started = perf_counter_ns()
    order = count()
    frontier = [(manhattan(start, warehouse.goal), next(order), start)]
    parents = {start: None}
    expanded = []
    while frontier:
        _, _, current = heappop(frontier)
        if current == warehouse.goal:
            return result(parents, current, expanded, started)
        expanded.append(current)
        for neighbor in warehouse.neighbors(current):
            if neighbor not in parents:
                parents[neighbor] = current
                heappush(frontier, (manhattan(neighbor, warehouse.goal), next(order), neighbor))
    return result(parents, None, expanded, started)


def astar(warehouse: Warehouse, start: Position) -> SearchResult:
    started = perf_counter_ns()
    order = count()
    frontier = [(manhattan(start, warehouse.goal), next(order), 0, start)]
    parents = {start: None}
    costs = {start: 0}
    expanded = []
    while frontier:
        _, _, cost, current = heappop(frontier)
        if cost != costs[current]:
            continue
        if current == warehouse.goal:
            return result(parents, current, expanded, started)
        expanded.append(current)
        for neighbor in warehouse.neighbors(current):
            candidate = cost + warehouse.entry_cost(neighbor)
            if neighbor not in costs or candidate < costs[neighbor]:
                costs[neighbor] = candidate
                parents[neighbor] = current
                priority = candidate + manhattan(neighbor, warehouse.goal)
                heappush(frontier, (priority, next(order), candidate, neighbor))
    return result(parents, None, expanded, started)
