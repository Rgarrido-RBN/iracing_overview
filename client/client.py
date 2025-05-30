#!python3
"""
iRacing Fuel Calculator - Client Application

This script connects to iRacing SDK, calculates fuel metrics, and sends data to a local web server.
"""

import irsdk
import time
import requests
import webbrowser
import subprocess
import os
import sys
from typing import Dict, Any, Optional


class State:
    """Tracks the state of the connection and session."""
    ir_connected = False
    last_car_setup_tick = -1


class FuelCalculator:
    """Handles calculation of fuel consumption metrics."""
    MAX_HISTORY_LAPS = 5  # Number of laps to average fuel consumption

    def __init__(self):
        self.last_lap = -1
        self.fuel_at_lap_start = -1.0
        self.fuel_consumption_history = []

    def record_lap_consumption(self, previous_fuel: float, current_fuel: float) -> Optional[float]:
        """Record fuel consumption for a completed lap."""
        if previous_fuel <= 0:
            return None
        fuel_used = previous_fuel - current_fuel
        if fuel_used > 0:
            self.fuel_consumption_history.append(fuel_used)
            if len(self.fuel_consumption_history) > self.MAX_HISTORY_LAPS:
                self.fuel_consumption_history.pop(0)
            return fuel_used
        return None

    def calculate_average_consumption(self) -> float:
        """Calculate average fuel consumption per lap."""
        if not self.fuel_consumption_history:
            return 0
        return sum(self.fuel_consumption_history) / len(self.fuel_consumption_history)

    def reset(self):
        """Reset the calculator state."""
        self.last_lap = -1
        self.fuel_at_lap_start = -1.0
        self.fuel_consumption_history = []


class IRacingFuelClient:
    SERVER_URL = "http://192.168.0.109:5000"
    UPDATE_FREQUENCY = 0.25

    def __init__(self):
        self.ir_sdk = irsdk.IRSDK()
        self.state = State()
        self.calculator = FuelCalculator()
        # Usa variable de entorno o valor por defecto
        self.client_id = os.environ.get("FUEL_CLIENT_ID", f"client_{os.getpid()}")

    def check_iracing(self):
        """Check connection state with iRacing."""
        if self.state.ir_connected and not (self.ir_sdk.is_initialized and self.ir_sdk.is_connected):
            self.state.ir_connected = False
            self.calculator.reset()
            self.ir_sdk.shutdown()
            print("iRacing disconnected.")
        elif not self.state.ir_connected and self.ir_sdk.startup() and self.ir_sdk.is_initialized and self.ir_sdk.is_connected:
            self.state.ir_connected = True
            print("iRacing connected.")

    def update_telemetry(self):
        """Update telemetry and fuel calculations."""
        self.ir_sdk.freeze_var_buffer_latest()
        if not self.state.ir_connected:
            return

        current_lap = self.ir_sdk['Lap']
        current_fuel = self.ir_sdk['FuelLevel']

        if current_lap != self.calculator.last_lap and current_lap > 0:
            self.calculator.record_lap_consumption(self.calculator.fuel_at_lap_start, current_fuel)
            self.calculator.fuel_at_lap_start = current_fuel
            self.calculator.last_lap = current_lap

        self.send_data_to_server(self.get_telemetry_data())

    def get_telemetry_data(self) -> Dict[str, Any]:
        """Collect and return telemetry data."""
        avg_consumption = self.calculator.calculate_average_consumption()
        laps_remaining_with_fuel = self.ir_sdk['FuelLevel'] / avg_consumption if avg_consumption > 0 else 0
        fuel_needed = self.ir_sdk['SessionLapsRemainEx'] * avg_consumption - self.ir_sdk['FuelLevel']
        if fuel_needed < 0:
            fuel_needed = 0
        
        # Solo actualiza fuel_used_last_lap cuando se completa una nueva vuelta
        fuel_used_last_lap = None
        if self.calculator.last_lap != -1 and self.ir_sdk['Lap'] > self.calculator.last_lap:
            fuel_used_last_lap = self.calculator.record_lap_consumption(self.calculator.fuel_at_lap_start, self.ir_sdk['FuelLevel'])
        if fuel_used_last_lap is not None:
            self.last_fuel_used_last_lap = fuel_used_last_lap
        else:
            fuel_used_last_lap = getattr(self, "last_fuel_used_last_lap", None)
    
        try:
            session_info = self.ir_sdk.get_session_info_update_by_key("DriverInfo")
            car_idx = self.ir_sdk['DriverCarIdx']
            car_name = session_info['Drivers'][car_idx]['CarScreenName']
            track_name = self.ir_sdk.get_session_info_update_by_key("WeekendInfo")['TrackDisplayName']
        except (KeyError, TypeError, IndexError):
            car_name = "Unknown Car"
            track_name = "Unknown Track"
    
        try:
            # Número de incidentes
            incident_count = self.ir_sdk['PlayerCarMyIncidentCount']
        except KeyError:
            incident_count = 0  # Si no está disponible, asumir 0 incidentes
    
        try:
            # Gasolina marcada en la fuel box
            fuel_in_box = self.ir_sdk['PitSvFuel']
    
            # Ruedas configuradas para cambiar
            tires_to_change = {
                "left_front": bool(self.ir_sdk['dpLFTireChange']),
                "right_front": bool(self.ir_sdk['dpRFTireChange']),
                "left_rear": bool(self.ir_sdk['dpLRTireChange']),
                "right_rear": bool(self.ir_sdk['dpRRTireChange']),
            }
        except KeyError:
            fuel_in_box = 0  # Asumir 0 si no está configurado
            tires_to_change = {
                "left_front": False,
                "right_front": False,
                "left_rear": False,
                "right_rear": False,
            }
    
        data = {
            "timestamp": time.time(),
            "is_on_track": self.ir_sdk['IsOnTrack'],
            "car_name": self.ir_sdk['DriverCarIdx'],
            "laps_to_go": self.ir_sdk['SessionLapsRemainEx'],
            "fuel_needed": fuel_needed,
            "track_name": track_name,
            "current_lap": self.ir_sdk['Lap'],
            "current_fuel": self.ir_sdk['FuelLevel'],
            "avg_consumption": avg_consumption,
            "laps_remaining_with_fuel": laps_remaining_with_fuel,
            "consumption_history": self.calculator.fuel_consumption_history,
            "incident_count": incident_count,
            "fuel_in_box": fuel_in_box,
            "fuel_used_last_lap": fuel_used_last_lap,
            "tires_to_change": tires_to_change,
        }
        # Añade el client_id
        data["client_id"] = self.client_id
        return data

    def send_data_to_server(self, data: Dict[str, Any]):
        """Send telemetry data to the web server."""
        try:
            response = requests.post(f"{self.SERVER_URL}/api/update", json=data)
            if response.status_code != 200:
                print(f"Failed to send data: {response.status_code}")
        except requests.RequestException as e:
            print(f"Error sending data: {e}")

    def start_web_server(self):
        """Start the Flask web server."""
        script_dir = os.path.dirname(os.path.abspath(__file__))
        server_script = os.path.join(script_dir, "server.py")
        if not os.path.exists(server_script):
            print("Server script not found.")
            sys.exit(1)

        subprocess.Popen([sys.executable, server_script])
        print(f"Web server started at {self.SERVER_URL}")
        time.sleep(2)
        webbrowser.open(self.SERVER_URL)

    def run(self):
        """Main loop for the application."""
        #self.start_web_server()
        try:
            while True:
                self.check_iracing()
                if self.state.ir_connected:
                    self.update_telemetry()
                time.sleep(self.UPDATE_FREQUENCY)
        except KeyboardInterrupt:
            print("Application terminated.")
        finally:
            self.ir_sdk.shutdown()


def main():
    client = IRacingFuelClient()
    client.run()

if __name__ == '__main__':
    main()
