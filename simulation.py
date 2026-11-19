"""Execute an A* route and replan when its next cell is blocked."""

from dataclasses import dataclass

from informed import astar
from search import SearchResult
from warehouse import Position, Warehouse


@dataclass
class Simulation:
    initial: SearchResult
    revised: SearchResult
    trolley: Position
    traveled_before_detection: list[Position]

    @property
    def traveled(self) -> list[Position]:
        return self.traveled_before_detection + self.revised.path[1:]

    def metrics(self, warehouse: Warehouse) -> dict:
        return {
            "reached": self.traveled[-1] == warehouse.goal,
            "moves": len(self.traveled) - 1,
            "cost": warehouse.path_cost(self.traveled),
            "expanded": len(self.initial.expanded) + len(self.revised.expanded),
            "elapsed_ms": self.initial.elapsed_ms + self.revised.elapsed_ms,
            "replans": 1,
        }


def simulate(warehouse: Warehouse, trolley: Position) -> Simulation:
    initial = astar(warehouse, warehouse.start)
    if trolley not in initial.path[1:]:
        raise ValueError("The trolley must block a move on the initial A* route.")

    traveled = []
    for position in initial.path:
        if position == trolley:
            revised = astar(warehouse.with_blockage(position), traveled[-1])
            return Simulation(initial, revised, trolley, traveled)
        traveled.append(position)
    raise AssertionError("The verified trolley was not encountered.")
