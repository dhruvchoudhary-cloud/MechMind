# MechMind — An Autonomous Maintenance Agent

> **Industrial IoT Predictive Maintenance Platform with Hybrid Rule-Based & Machine-Learning Anomaly Detection**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.110-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB.svg?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Bundler-Vite%205-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Scikit-Learn](https://img.shields.io/badge/ML-Isolation%20Forest%201.9.1-F7931E.svg?logo=scikitlearn)](https://scikit-learn.org/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%203-003B57.svg?logo=sqlite)](https://sqlite.org/)

---

## 1. System Overview

**MechMind** monitors industrial motor assets continuously, detects mechanical and thermal anomalies through a hybrid AI engine (configurable limit rules + trained Isolation Forest), calculates transparent risk scores (0–100), generates diagnostic fault hypotheses, and autonomously dispatches deduplicated maintenance work orders.

### Monitored Telemetry Attributes:
- **Temperature (`°C`)**: Thermal overheating and heat-dissipation surveillance.
- **Vibration Velocity RMS (`mm/s`)**: Mechanical unbalance, misalignment, and bearing fatigue.
- **Electric Current (`A`)**: Electrical overdraw, stator/winding issues, or phase imbalance.
- **Shaft Rotational Speed (`RPM`)**: Speed regulation and motor slip anomalies.

### Pre-configured Demo Assets:
1. `motor-001`: **Assembly Line Motor** (High Criticality, Line A - Stamping Bay)
2. `motor-002`: **Conveyor Motor** (Medium Criticality, Warehouse Conveyor 3)
3. `motor-003`: **Cooling Pump Motor** (High Criticality, Main Chiller Plant)

---

## 2. Architecture & Hybrid AI Engine

```
[ Industrial Motor Telemetry ]
               │
               ▼
   [ POST /api/v1/telemetry ]
               │
       ┌───────┴────────────────────────┐
       ▼                                ▼
[ Configurable Rule Engine ]    [ Isolation Forest ML ]
(Operational Limits, Overheat)  (Multivariate Outlier Flag)
       │                                │
       └───────┬────────────────────────┘
               ▼
   [ Deterministic Risk Engine ]
   • Low (0–24) | Medium (25–49) | High (50–74) | Critical (75–100)
               │
               ▼
[ Autonomous Maintenance Agent ]
   ├── Deduplication Check (Single in-place incident per machine)
   ├── Automatic Alert Creation (Traceable Evidence)
   ├── Hysteresis Recovery (3 consecutive normal ticks to resolve)
   └── Transactional Maintenance Task Generation (Prescribed Protocol)
               │
               ▼
[ SQLite Database & Real-Time React Operations Dashboard ]
```

### Deterministic Risk Scoring Policy:
- **Temperature violation**: `+35` points (warning $\ge 70^\circ\text{C}$) or `+50` points (critical $\ge 85^\circ\text{C}$).
- **Vibration violation**: `+35` points (warning $\ge 4.0\text{ mm/s}$) or `+50` points (critical $\ge 6.5\text{ mm/s}$).
- **Current deviation**: `+10` points (outside $2.0 - 15.0\text{ A}$).
- **RPM deviation**: `+10` points (outside $1000 - 1800\text{ RPM}$).
- **ML Anomaly (Isolation Forest)**: `+25` points (multivariate correlation outlier).
- **Standby/Stopped Motor check**: When $current < 0.5\text{ A}$ and $rpm < 50$, risk score is forced to `0.0` (prevents idle machine false positives).
- **Capped at 100 max**.

### Demonstration Baseline Standards:
Operating thresholds are illustrative configuration defaults inspired by industrial vibration velocity guidelines and motor thermal envelopes. They are fully configurable via the **Settings** page and persisted in the SQLite database across restarts.

### Safe Fallback Mode:
If the trained ML artifact is missing or corrupt, the system logs a warning and continues running seamlessly in fallback mode (`ML FALLBACK (RULE ENGINE ONLY)` displayed on the dashboard) without interrupting alert or work-order generation.

---

## 3. Repository Structure

```
predict-before-failure/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entrypoint, lifespan, CORS & sanitized 422 handler
│   │   ├── config.py                # Pydantic v2 settings & threshold limits
│   │   ├── database.py              # SQLite engine, schema migration & seeder
│   │   ├── models.py                # SQLAlchemy ORM models
│   │   ├── schemas.py               # Pydantic validation, UTC 'Z' serializer & envelopes
│   │   ├── api/
│   │   │   ├── machines.py          # /machines, /health, /readings
│   │   │   ├── telemetry.py         # POST /telemetry ingestion
│   │   │   ├── dashboard.py         # /dashboard/summary aggregate stats
│   │   │   ├── alerts.py            # /alerts listing, detail, acknowledge/resolve
│   │   │   ├── tasks.py             # /tasks queue, status transitions, notes
│   │   │   ├── simulator.py         # /simulator/scenario, reset, tick, loop
│   │   │   └── settings.py          # /settings demonstration threshold updates
│   │   └── services/
│   │       ├── rules.py             # Configurable rule evaluation engine
│   │       ├── ml_detector.py       # Isolation Forest detector with safe fallback
│   │       ├── risk_engine.py       # Deterministic hybrid risk engine
│   │       └── maintenance_agent.py # End-to-end autonomous agent workflow
│   ├── tests/
│   │   ├── conftest.py              # Centralized test fixtures and DB isolation
│   │   ├── test_ingestion_and_rules.py # Ingestion, validation & rules tests
│   │   ├── test_ml_and_agent.py     # ML pipeline, inliers & agent workflow tests
│   │   ├── test_simulator_and_api.py # Simulator concurrency & API contract tests
│   │   └── test_backend.py          # Comprehensive test suite
│   └── requirements.txt
├── ml/
│   ├── train_model.py               # Isolation Forest multi-profile training script
│   └── artifacts/
│       ├── isolation_forest_v1.joblib
│       └── model_metadata.json
├── simulator/
│   └── sensor_simulator.py          # Multi-motor telemetry physics simulator
├── frontend/
│   ├── src/
│   │   ├── components/              # Sidebar, TopNavbar, MetricCard, SimulatorControls, StatusBadge
│   │   ├── pages/                   # OverviewDashboard, MachineMonitoring, MachineDetailPage, AlertsPage, TasksPage, SettingsPage
│   │   ├── services/api.ts          # Centralized API client with envelope support
│   │   ├── types/index.ts           # TypeScript interfaces
│   │   ├── App.tsx                  # Responsive layout, mobile drawer & polling
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── .env.example
├── .gitignore
└── README.md
```

---

## 4. Installation & Startup Instructions

### Prerequisites:
- Python 3.11+
- Node.js 18+ & npm

### Step 1: Install Backend Dependencies
```bash
cd backend
python -m pip install -r requirements.txt
```

### Step 2: Verify or Retrain the ML Model (Optional)
The pre-trained artifact is saved at `ml/artifacts/isolation_forest_v1.joblib`. To retrain with all 3 motor profiles:
```bash
python ml/train_model.py
```

### Step 3: Start the Backend Server
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI backend will automatically verify the database schema, apply auto-healing column migrations if needed, seed the 3 demo machines, and populate initial baseline readings.
- **Swagger API Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **API Health**: [http://127.0.0.1:8000/api/v1/health](http://127.0.0.1:8000/api/v1/health)

### Step 4: Install & Start Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at: **`http://localhost:5173`**

---

## 5. Demonstration Workflow & Scenario Controls

The application includes an interactive **Simulation Console** visible at the top of the dashboard and top navigation bar:

| Scenario Button | Simulation Behavior | Expected Autonomous Agent Action |
| :--- | :--- | :--- |
| **Normal** | Temperature ~49–56°C, Vibration ~1.8–2.3 mm/s RMS across all 3 motor profiles. | Risk score remains Low (0–24). No alerts generated. |
| **Overheating** | Temperature rises smoothly to 88°C+. | Thermal violation (+35 to +50 pts), Risk rises to Medium/Critical, `OVERHEATING` alert created, Cooling & lubrication work order generated. |
| **Excessive Vibration** | Vibration RMS velocity ramps to 7.8 mm/s. | Vibration violation (+35 to +50 pts), `EXCESSIVE_VIBRATION` alert created, FFT spectrum & bearing work order generated. |
| **Combined Fault** | Temperature and vibration spike simultaneously. | Escalates existing incident in-place to `COMBINED_FAULT` (+70 to +100 pts), **CRITICAL (P1)** priority task dispatched. |
| **Recovery** | Telemetry smoothly decays back to normal baseline. | Requires 3 consecutive normal ticks (hysteresis) to auto-resolve active alert and auto-complete associated task. |
| **Reset Demo** | Clears active incidents and resets simulation state. | Restores a clean demonstration state instantly and stops background streaming. |

### Single Hidden Fault Demonstration:
Use the **Target** dropdown in the simulation console to direct a fault to a single specific motor (`motor-001`, `motor-002`, or `motor-003`) while leaving all other fleet assets nominal.

---

## 6. Automated Testing Suite

The repository contains 54 automated tests across 3 dedicated test suites plus the full integration suite:

```bash
python -m pytest backend/tests/ -v
```

### Test Suite Structure:
1. `backend/tests/test_ingestion_and_rules.py`: Telemetry ingestion, Pydantic bounds, NaN/Inf rejection, past/future timestamp rejection, rule violations, stopped motor no-fault, and machine limit overrides.
2. `backend/tests/test_ml_and_agent.py`: ML pipeline, healthy motor profile inliers (`motor-001`, `motor-002`, `motor-003`), anomaly outliers, safe fallback mode, risk calculation (+25 ML points), alert deduplication & in-place escalation, task generation, and 3-tick hysteresis recovery.
3. `backend/tests/test_simulator_and_api.py`: Targeted single-machine scenarios, `overheating_and_vibration` alias, 404 on invalid machine, duration timer, race-free start/stop concurrency, settings persistence & validation, status transition constraints, offset/envelope pagination, and dashboard summary contract.

---

## 7. Disclaimers & Safety Notice

> **IMPORTANT NOTICE:**  
> This application is built as an engineering MVP prototype for demonstration purposes. Telemetry data is synthetically simulated. Risk scores are deterministic heuristic estimates and **must not be interpreted as certified remaining useful life (RUL) or calibrated real-world failure probabilities**. Do not connect this software to real machinery without certified fail-safe hardware interlocks.
