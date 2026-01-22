"""Utility script to initialize/train Z.ai models.

Usage inside container:

    docker exec -it z-ai-engine python /app/init_ai_models.py

This script should be idempotent and safe to run multiple times.
"""

from pathlib import Path

from .services.predictive_analytics import PredictiveAnalytics
from .services.anomaly_detector import AnomalyDetector


def main() -> None:
    models_dir = Path("/models")
    models_dir.mkdir(parents=True, exist_ok=True)

    print("🚀 Initializing Z.ai models in", models_dir)

    pa = PredictiveAnalytics(models_dir=models_dir)
    ad = AnomalyDetector(models_dir=models_dir)

    # In a real implementation, you would load historical data from DB here.
    # For now, we just ensure that model files exist / are initialized.
    pa.initialize_default_models()
    ad.initialize_default_models()

    print("✅ Z.ai models initialized successfully")


if __name__ == "__main__":
    main()
