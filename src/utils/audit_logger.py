from datetime import datetime
import csv
from pathlib import Path

AUDIT_LOG_PATH = Path("logs/audit_log.csv")

def log_event(event_type: str, details: str, agent: str = "system"):
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    entry = {"timestamp": now, "event_type": event_type, "agent": agent, "details": details}

    # Create directory if it doesn’t exist
    AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    write_header = not AUDIT_LOG_PATH.exists()

    with open(AUDIT_LOG_PATH, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "event_type", "agent", "details"])
        if write_header:
            writer.writeheader()
        writer.writerow(entry)

    print(f"[🛡️ AuditLog] {event_type} → {details}")