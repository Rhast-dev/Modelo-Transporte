# PROYECTO UNIVERSIRTARIO

# TransportSolver — Aplicación Flask

Aplicación web para resolver modelos de transporte usando múltiples métodos.

## Métodos disponibles
- **Solver PuLP** — Programación lineal exacta (solución óptima garantizada)
- **Esquina Noroeste** — Solución inicial clásica
- **Costo Mínimo** — Heurístico greedy
- **Aproximación de Vogel** — Mejor heurístico inicial

## Instalación

```bash
# 1. Crear entorno virtual (recomendado)
python -m venv venv

# En Windows:
venv\Scripts\activate

# En macOS/Linux:
source venv/bin/activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Ejecutar la app
python app.py
```

Abre tu navegador en: http://127.0.0.1:5000

## Estructura del proyecto

```
transport_app/
├── app.py                  # Backend Flask + lógica de solvers
├── requirements.txt
├── templates/
│   └── index.html          # Interfaz principal
└── static/
    ├── css/
    │   └── style.css       # Estilos
    └── js/
        └── app.js          # Lógica frontend
```

## API Endpoint

`POST /solve`

```json
{
  "method": "solver",           // "solver" | "northwest" | "mincost" | "vogel"
  "origins": ["Planta A", "Planta B"],
  "destinations": ["Ciudad 1", "Ciudad 2"],
  "supply": {"Planta A": 100, "Planta B": 200},
  "demand": {"Ciudad 1": 150, "Ciudad 2": 150},
  "costs": {
    "Planta A": {"Ciudad 1": 4, "Ciudad 2": 8},
    "Planta B": {"Ciudad 1": 6, "Ciudad 2": 3}
  }
}
```

El balanceo (nodos ficticios) se realiza automáticamente en el backend.
