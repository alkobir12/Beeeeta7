from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import joblib
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

from .services.feature_engineering import FinancialFeatureEngineer
from .services.recommendation_engine import RecommendationEngine
from .services.anomaly_detector import AnomalyDetector
from .services.predictive_analytics import PredictiveAnalytics

app = FastAPI(
    title="Z.ai Financial AI Engine",
    description="Advanced AI engine for financial analysis and predictions",
    version="2.0.0"
)

# Initialize AI models
feature_engineer = FinancialFeatureEngineer()
recommendation_engine = RecommendationEngine()
anomaly_detector = AnomalyDetector()
predictive_analytics = PredictiveAnalytics()

class WorkshopData(BaseModel):
    workshop_id: str
    transactions: List[Dict]
    inventory: List[Dict]
    customers: List[Dict]
    accounts: List[Dict]
    employees: List[Dict]
    date_range: Optional[Dict] = None

class PredictionRequest(BaseModel):
    workshop_id: str
    prediction_type: str = Field(..., regex="^(revenue|demand|cash_flow|risk)$")
    horizon_days: int = Field(30, ge=1, le=365)
    confidence_level: float = Field(0.95, ge=0.5, le=1.0)

class RecommendationRequest(BaseModel):
    workshop_id: str
    categories: Optional[List[str]] = None
    priority_filter: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    """Initialize AI models on startup"""
    print("🚀 Initializing Z.ai Engine...")
    
    # Load or train models
    try:
        # Load pre-trained models if exist
        predictive_analytics.load_models()
        anomaly_detector.load_models()
    except Exception:
        # Train new models
        print("Training new models...")
        # This would typically use historical data
        pass
    
    print("✅ Z.ai Engine ready!")

@app.get("/api/z-ai/health")
async def z_ai_health():
    return {"status": "z-ai engine running"}


@app.post("/api/z-ai/analyze")
async def analyze_workshop_data(data: WorkshopData):
    """
    Comprehensive analysis of workshop data
    """
    try:
        # Feature engineering
        features = feature_engineer.extract_features(data.dict())
        
        # Financial health analysis
        financial_health = {
            "liquidity_ratio": feature_engineer.calculate_liquidity_ratio(features),
            "profitability_score": feature_engineer.calculate_profitability(features),
            "efficiency_metrics": feature_engineer.calculate_efficiency_metrics(features),
            "solvency_ratio": feature_engineer.calculate_solvency_ratio(features),
            "growth_indicators": feature_engineer.calculate_growth_indicators(features),
            "risk_assessment": feature_engineer.assess_risk(features)
        }
        
        # Cash flow analysis
        cash_flow_analysis = feature_engineer.analyze_cash_flow(
            data.transactions, 
            data.accounts
        )
        
        # Inventory analysis
        inventory_analysis = feature_engineer.analyze_inventory(
            data.inventory, 
            data.transactions
        )
        
        # Customer analysis
        customer_analysis = feature_engineer.analyze_customers(
            data.customers, 
            data.transactions
        )
        
        return {
            "status": "success",
            "analysis": {
                "financial_health": financial_health,
                "cash_flow": cash_flow_analysis,
                "inventory": inventory_analysis,
                "customers": customer_analysis,
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/api/z-ai/predict")
async def make_predictions(request: PredictionRequest, background_tasks: BackgroundTasks):
    """
    Make predictions for future performance
    """
    try:
        # Fetch historical data (this would come from database)
        historical_data = await fetch_historical_data(request.workshop_id)
        
        predictions = {}
        
        if request.prediction_type == "revenue":
            predictions = predictive_analytics.predict_revenue(
                historical_data, 
                horizon_days=request.horizon_days,
                confidence_level=request.confidence_level
            )
            
        elif request.prediction_type == "demand":
            predictions = predictive_analytics.predict_demand(
                historical_data,
                horizon_days=request.horizon_days
            )
            
        elif request.prediction_type == "cash_flow":
            predictions = predictive_analytics.predict_cash_flow(
                historical_data,
                horizon_days=request.horizon_days
            )
            
        elif request.prediction_type == "risk":
            predictions = predictive_analytics.predict_risk(
                historical_data,
                horizon_days=request.horizon_days
            )
        
        # Store predictions in background
        background_tasks.add_task(store_predictions, request.workshop_id, predictions)
        
        return {
            "status": "success",
            "predictions": predictions,
            "confidence": request.confidence_level,
            "horizon_days": request.horizon_days
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.post("/api/z-ai/recommendations")
async def get_recommendations(request: RecommendationRequest):
    """
    Generate intelligent recommendations
    """
    try:
        # Fetch current workshop data
        workshop_data = await fetch_workshop_data(request.workshop_id)
        
        # Generate recommendations
        recommendations = recommendation_engine.generate_recommendations(
            workshop_data=workshop_data,
            categories=request.categories,
            priority_filter=request.priority_filter
        )
        
        return {
            "status": "success",
            "recommendations": recommendations,
            "count": len(recommendations),
            "generated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation generation failed: {str(e)}")

@app.post("/api/z-ai/detect-anomalies")
async def detect_anomalies(data: WorkshopData):
    """
    Detect anomalies in financial transactions
    """
    try:
        anomalies = anomaly_detector.detect_financial_anomalies(data.transactions)
        
        return {
            "status": "success",
            "anomalies": anomalies,
            "severity_levels": {
                "critical": len([a for a in anomalies if a["severity"] == "critical"]),
                "high": len([a for a in anomalies if a["severity"] == "high"]),
                "medium": len([a for a in anomalies if a["severity"] == "medium"]),
                "low": len([a for a in anomalies if a["severity"] == "low"])
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")

@app.get("/api/z-ai/models/status")
async def get_model_status():
    """
    Get status of all AI models
    """
    models_status = {
        "predictive_analytics": predictive_analytics.get_model_info(),
        "anomaly_detector": anomaly_detector.get_model_info(),
        "feature_engineer": feature_engineer.get_model_info(),
        "recommendation_engine": recommendation_engine.get_model_info(),
        "last_trained": datetime.utcnow().isoformat()
    }
    
    return {
        "status": "success",
        "models": models_status,
        "engine_version": "2.0.0"
    }

# Helper functions (would connect to database in production)
async def fetch_historical_data(workshop_id: str):
    """Fetch historical data from database"""
    # This is a placeholder - in production, this would query the database
    return {
        "transactions": [],
        "inventory": [],
        "customers": []
    }

async def fetch_workshop_data(workshop_id: str):
    """Fetch workshop data from database"""
    # This is a placeholder - in production, this would query the database
    return {
        "workshop_id": workshop_id,
        "transactions": [],
        "inventory": [],
        "customers": []
    }

async def store_predictions(workshop_id: str, predictions: Dict):
    """Store predictions in database"""
    # This would store predictions in the database
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
