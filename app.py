from flask import Flask, render_template, request, jsonify
from pulp import *
import json

app = Flask(__name__)


def balance_model(origins, destinations, supply, demand, costs):
    """Balance the model adding fictitious nodes if needed."""
    total_supply = sum(supply[o] for o in origins)
    total_demand = sum(demand[d] for d in destinations)
    info = None

    if total_supply < total_demand:
        fictitious = "Ficticio_Origen"
        origins = origins + [fictitious]
        supply = {**supply, fictitious: total_demand - total_supply}
        costs = {**costs, fictitious: {d: 0 for d in destinations}}
        info = f"Demanda ({total_demand}) > Oferta ({total_supply}). Se agregó origen ficticio con oferta {total_demand - total_supply}."

    elif total_demand < total_supply:
        fictitious = "Ficticio_Destino"
        destinations = destinations + [fictitious]
        demand = {**demand, fictitious: total_supply - total_demand}
        for o in origins:
            costs[o][fictitious] = 0
        info = f"Oferta ({total_supply}) > Demanda ({total_demand}). Se agregó destino ficticio con demanda {total_supply - total_demand}."

    return origins, destinations, supply, demand, costs, info


def solve_pulp(origins, destinations, supply, demand, costs):
    """Solve using PuLP (LP solver - optimal solution)."""
    prob = LpProblem("Transporte", LpMinimize)
    x = LpVariable.dicts("x", (origins, destinations), lowBound=0)

    prob += lpSum(x[o][d] * costs[o][d] for o in origins for d in destinations)

    for o in origins:
        prob += lpSum(x[o][d] for d in destinations) <= supply[o]
    for d in destinations:
        prob += lpSum(x[o][d] for o in origins) >= demand[d]

    prob.solve(PULP_CBC_CMD(msg=0))

    allocation = {o: {d: value(x[o][d]) or 0 for d in destinations} for o in origins}
    total = value(prob.objective)
    status = LpStatus[prob.status]

    return allocation, total, status


def solve_northwest(origins, destinations, supply, demand):
    """Northwest corner method."""
    supply_copy = [supply[o] for o in origins]
    demand_copy = [demand[d] for d in destinations]
    alloc = [[0] * len(destinations) for _ in range(len(origins))]

    i, j = 0, 0
    while i < len(origins) and j < len(destinations):
        qty = min(supply_copy[i], demand_copy[j])
        alloc[i][j] = qty
        supply_copy[i] -= qty
        demand_copy[j] -= qty
        if supply_copy[i] == 0:
            i += 1
        else:
            j += 1

    allocation = {origins[i]: {destinations[j]: alloc[i][j]
                                for j in range(len(destinations))}
                  for i in range(len(origins))}
    return allocation


def solve_mincost(origins, destinations, supply, demand, costs):
    """Minimum cost method."""
    supply_copy = {o: supply[o] for o in origins}
    demand_copy = {d: demand[d] for d in destinations}
    allocation = {o: {d: 0 for d in destinations} for o in origins}

    cells = sorted(
        [(o, d, costs[o][d]) for o in origins for d in destinations],
        key=lambda x: x[2]
    )

    for o, d, _ in cells:
        if supply_copy[o] > 0 and demand_copy[d] > 0:
            qty = min(supply_copy[o], demand_copy[d])
            allocation[o][d] += qty
            supply_copy[o] -= qty
            demand_copy[d] -= qty

    return allocation


def solve_vogel(origins, destinations, supply, demand, costs):
    """Vogel's approximation method."""
    supply_copy = {o: supply[o] for o in origins}
    demand_copy = {d: demand[d] for d in destinations}
    allocation = {o: {d: 0 for d in destinations} for o in origins}
    done_rows = set()
    done_cols = set()

    while len(done_rows) < len(origins) and len(done_cols) < len(destinations):
        row_penalties = {}
        for o in origins:
            if o in done_rows:
                continue
            vals = sorted(costs[o][d] for d in destinations if d not in done_cols)
            if len(vals) >= 2:
                row_penalties[o] = vals[1] - vals[0]
            elif len(vals) == 1:
                row_penalties[o] = vals[0]

        col_penalties = {}
        for d in destinations:
            if d in done_cols:
                continue
            vals = sorted(costs[o][d] for o in origins if o not in done_rows)
            if len(vals) >= 2:
                col_penalties[d] = vals[1] - vals[0]
            elif len(vals) == 1:
                col_penalties[d] = vals[0]

        if not row_penalties and not col_penalties:
            break

        max_row_pen = max(row_penalties.values(), default=-1)
        max_col_pen = max(col_penalties.values(), default=-1)

        if max_row_pen >= max_col_pen and row_penalties:
            o = max(row_penalties, key=lambda k: row_penalties[k])
            d = min((d for d in destinations if d not in done_cols),
                    key=lambda d: costs[o][d])
        else:
            d = max(col_penalties, key=lambda k: col_penalties[k])
            o = min((o for o in origins if o not in done_rows),
                    key=lambda o: costs[o][d])

        qty = min(supply_copy[o], demand_copy[d])
        allocation[o][d] += qty
        supply_copy[o] -= qty
        demand_copy[d] -= qty

        if supply_copy[o] == 0:
            done_rows.add(o)
        if demand_copy[d] == 0:
            done_cols.add(d)

    return allocation


def calc_total_cost(origins, destinations, allocation, costs):
    return sum(allocation[o][d] * costs[o][d]
               for o in origins for d in destinations)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/solve", methods=["POST"])
def solve():
    data = request.get_json()
    method = data.get("method", "solver")
    origins = data["origins"]
    destinations = data["destinations"]
    supply = {o: float(data["supply"][o]) for o in origins}
    demand = {d: float(data["demand"][d]) for d in destinations}
    costs = {o: {d: float(data["costs"][o][d])
                 for d in destinations} for o in origins}

    origins, destinations, supply, demand, costs, balance_info = balance_model(
        origins, destinations, supply, demand, costs
    )

    status = "Factible"
    explanation = None

    try:
        if method == "solver":
            allocation, total, status = solve_pulp(
                origins, destinations, supply, demand, costs)
            explanation = f"Solución óptima encontrada con programación lineal (CBC solver)."
        elif method == "northwest":
            allocation = solve_northwest(
                origins, destinations, supply, demand)
            total = calc_total_cost(origins, destinations, allocation, costs)
            explanation = "Solución inicial. Se asigna desde la esquina superior izquierda hacia la inferior derecha."
        elif method == "mincost":
            allocation = solve_mincost(
                origins, destinations, supply, demand, costs)
            total = calc_total_cost(origins, destinations, allocation, costs)
            explanation = "Solución inicial greedy. Se asigna primero a las rutas de menor costo."
        elif method == "vogel":
            allocation = solve_vogel(
                origins, destinations, supply, demand, costs)
            total = calc_total_cost(origins, destinations, allocation, costs)
            explanation = "Mejor solución inicial heurística. Considera penalizaciones por no elegir el mínimo costo."
        else:
            return jsonify({"error": "Método no reconocido"}), 400

        routes = [
            {
                "from": o, "to": d,
                "qty": allocation[o][d],
                "unit_cost": costs[o][d],
                "subtotal": allocation[o][d] * costs[o][d]
            }
            for o in origins for d in destinations
            if allocation[o][d] > 0
        ]

        return jsonify({
            "status": status,
            "total": round(total, 4),
            "origins": origins,
            "destinations": destinations,
            "allocation": allocation,
            "routes": routes,
            "balance_info": balance_info,
            "explanation": explanation,
            "costs": costs
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
