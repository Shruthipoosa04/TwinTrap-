from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_socketio import SocketIO
import database
from detection import detect_evil_twins

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize DB
database.init_db()

# ---------- Serve HTML ----------
@app.route('/')
def index():
    # Flask automatically looks in templates/ folder
    return render_template('index.html')

# ---------- API Routes ----------
@app.route('/api/upload', methods=['POST'])
def upload_scan():
    try:
        data = request.get_json()
        if not data or 'wifi_networks' not in data:
            return jsonify({"error": "Invalid data format"}), 400

        scan_data = data['wifi_networks']

        # Store networks
        for net in scan_data:
            ssid = net.get('ssid')
            bssid = net.get('bssid')
            signal = net.get('signal', 0)
            if ssid and bssid:
                database.insert_scan(ssid, bssid, signal)

        # Run detection
        evil_twins = detect_evil_twins(scan_data)

        # Notify frontend in real time
        if evil_twins:
            socketio.emit('evil_twin_alert', {'ssids': evil_twins})
            print(f"[⚠️ ALERT] Evil Twin Detected: {evil_twins}")

        return jsonify({"status": "received", "evil_twins": evil_twins})

    except Exception as e:
        print(f"[ERROR] {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    data = database.fetch_all_scans()
    formatted = [
        {"ssid": d[0], "bssid": d[1], "signal_strength": d[2], "timestamp": d[3]}
        for d in data
    ]
    return jsonify(formatted)

# ---------- Run ----------
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
