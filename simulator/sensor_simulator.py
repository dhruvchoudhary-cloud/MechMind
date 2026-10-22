import time
import math
import random
import datetime
import threading
import logging
import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

class MachineSimState:
    def __init__(
        self,
        machine_id: str,
        base_temp: float,
        base_vib: float,
        base_curr: float,
        base_rpm: float
    ):
        self.machine_id = machine_id
        self.base_temp = base_temp
        self.base_vib = base_vib
        self.base_curr = base_curr
        self.base_rpm = base_rpm

        # Current state
        self.current_temp = base_temp
        self.current_vib = base_vib
        self.current_curr = base_curr
        self.current_rpm = base_rpm

        # Targets (for smooth transition)
        self.target_temp = base_temp
        self.target_vib = base_vib
        self.target_curr = base_curr
        self.target_rpm = base_rpm

        self.step_count = 0

    def reset_to_normal(self):
        self.target_temp = self.base_temp
        self.target_vib = self.base_vib
        self.target_curr = self.base_curr
        self.target_rpm = self.base_rpm
        self.current_temp = self.base_temp + random.uniform(-0.5, 0.5)
        self.current_vib = self.base_vib + random.uniform(-0.05, 0.05)
        self.current_curr = self.base_curr + random.uniform(-0.1, 0.1)
        self.current_rpm = self.base_rpm + random.uniform(-3.0, 3.0)

    def set_scenario(self, scenario: str):
        if scenario == "normal":
            self.target_temp = self.base_temp
            self.target_vib = self.base_vib
            self.target_curr = self.base_curr
            self.target_rpm = self.base_rpm
        elif scenario == "overheating":
            self.target_temp = 89.0
            self.current_temp = max(self.current_temp, 82.0)
            self.target_curr = self.base_curr + 3.2
        elif scenario == "excessive_vibration":
            self.target_vib = 7.8
            self.current_vib = max(self.current_vib, 7.0)
            self.target_rpm = self.base_rpm - 80.0
        elif scenario == "combined_fault":
            self.target_temp = 92.0
            self.current_temp = max(self.current_temp, 86.0)
            self.target_vib = 8.4
            self.current_vib = max(self.current_vib, 7.5)
            self.target_curr = self.base_curr + 4.5
            self.target_rpm = self.base_rpm - 120.0
        elif scenario == "recovery":
            self.target_temp = self.base_temp
            self.target_vib = self.base_vib
            self.target_curr = self.base_curr
            self.target_rpm = self.base_rpm

    def step(self) -> Dict[str, Any]:
        self.step_count += 1
        # Smooth asymptotic approach towards target (0.2 factor) plus physical noise
        self.current_temp += (self.target_temp - self.current_temp) * 0.2 + random.gauss(0, 0.2)
        self.current_vib += (self.target_vib - self.current_vib) * 0.2 + random.gauss(0, 0.06)
        self.current_curr += (self.target_curr - self.current_curr) * 0.2 + random.gauss(0, 0.1)
        self.current_rpm += (self.target_rpm - self.current_rpm) * 0.2 + random.gauss(0, 2.5)

        # Physical lower bounds
        self.current_temp = max(self.current_temp, 15.0)
        self.current_vib = max(self.current_vib, 0.1)
        self.current_curr = max(self.current_curr, 0.5)
        self.current_rpm = max(self.current_rpm, 200.0)

        # Timezone-aware UTC timestamp (Issue 30)
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        return {
            "machine_id": self.machine_id,
            "timestamp": now_iso,
            "temperature_c": round(self.current_temp, 2),
            "vibration_mm_s_rms": round(self.current_vib, 3),
            "current_a": round(self.current_curr, 2),
            "rpm": round(self.current_rpm, 1)
        }


class TelemetrySimulator:
    def __init__(self, target_api_url: Optional[str] = None):
        self.target_api_url = target_api_url or "http://127.0.0.1:8000/api/v1/telemetry"
        self.is_running = False
        self.current_scenario = "normal"
        self.interval_seconds = 2.5
        self.thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()  # Issue 2 & 9: Thread safety
        self._stop_event = threading.Event()

        self.machines: Dict[str, MachineSimState] = {
            "motor-001": MachineSimState("motor-001", base_temp=56.0, base_vib=2.1, base_curr=9.2, base_rpm=1485.0),
            "motor-002": MachineSimState("motor-002", base_temp=51.5, base_vib=1.8, base_curr=7.4, base_rpm=1440.0),
            "motor-003": MachineSimState("motor-003", base_temp=49.0, base_vib=2.3, base_curr=11.2, base_rpm=1750.0),
        }

    def set_interval(self, seconds: float):
        with self._lock:
            self.interval_seconds = max(0.5, float(seconds))

    def set_scenario(self, scenario: str, machine_id: Optional[str] = None, duration_seconds: Optional[float] = None):
        # Support blueprint alias
        if scenario == "overheating_and_vibration":
            scenario = "combined_fault"

        with self._lock:
            self.current_scenario = scenario
            if machine_id:
                if machine_id not in self.machines:
                    raise KeyError(f"Machine '{machine_id}' does not exist in simulator.")
                self.machines[machine_id].set_scenario(scenario)
            else:
                for m in self.machines.values():
                    m.set_scenario(scenario)

        # Handle duration_seconds (auto-revert to recovery after duration)
        if duration_seconds and duration_seconds > 0:
            def revert_after_delay():
                time.sleep(duration_seconds)
                logger.info(f"[Simulator] Scenario duration of {duration_seconds}s expired. Triggering recovery.")
                self.set_scenario("recovery", machine_id=machine_id)
            rev_thread = threading.Thread(target=revert_after_delay, daemon=True)
            rev_thread.start()

    def reset(self):
        """
        Thread-safe reset:
        Stops active loop, resets target/current state, and leaves loop stopped (Issue 2).
        """
        self.stop_loop()
        with self._lock:
            self.current_scenario = "normal"
            for m in self.machines.values():
                m.reset_to_normal()

    def generate_tick(self) -> List[Dict[str, Any]]:
        with self._lock:
            readings = []
            for m in self.machines.values():
                readings.append(m.step())
            return readings

    def start_loop(self):
        with self._lock:
            if self.thread and self.thread.is_alive():
                self.is_running = True
                return
            self.is_running = True
            self._stop_event.clear()
            self.thread = threading.Thread(target=self._run_loop, daemon=True)
            self.thread.start()
            logger.info("[Simulator] Background simulation loop started.")

    def stop_loop(self):
        with self._lock:
            self.is_running = False
            self._stop_event.set()
            thread = self.thread
        
        # Wait for thread to finish outside lock to prevent deadlock
        if thread and thread.is_alive():
            thread.join(timeout=3.0)
        logger.info("[Simulator] Background simulation loop stopped.")

    def _run_loop(self):
        while not self._stop_event.is_set():
            try:
                readings = self.generate_tick()
                for r in readings:
                    if self._stop_event.is_set():
                        break
                    try:
                        req_data = json.dumps(r).encode("utf-8")
                        req = urllib.request.Request(
                            self.target_api_url,
                            data=req_data,
                            headers={"Content-Type": "application/json"}
                        )
                        with urllib.request.urlopen(req, timeout=2.0) as resp:
                            pass
                    except Exception as err:
                        logger.debug(f"[Simulator] Telemetry dispatch failed: {err}")
            except Exception as e:
                logger.error(f"[Simulator] Tick error: {e}")
            
            # Responsive sleep with stop_event wait
            self._stop_event.wait(self.interval_seconds)

    def get_status_summary(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "is_running": self.is_running,
                "current_scenario": self.current_scenario,
                "interval_seconds": self.interval_seconds,
                "machines": {
                    mid: {
                        "current_temp": round(m.current_temp, 2),
                        "target_temp": round(m.target_temp, 2),
                        "current_vib": round(m.current_vib, 3),
                        "target_vib": round(m.target_vib, 3)
                    } for mid, m in self.machines.items()
                }
            }

simulator = TelemetrySimulator()
