from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import JSONResponse
import logging
import traceback
import os
from typing import Dict, Optional, List
from pydantic import BaseModel
from datetime import datetime
import asyncio
import httpx
import json

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/zobot", tags=["Zobot AI"])

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    timestamp: str
    status: str = "success"

# Initialize Groq client
try:
    from groq import Groq
    groq_client = None
    
    def get_groq_client():
        global groq_client
        if groq_client is None:
            api_key = os.getenv('GROQ_API_KEY')
            if not api_key:
                logger.warning("GROQ_API_KEY not found in environment variables")
                return None
            groq_client = Groq(api_key=api_key)
        return groq_client
    
    ai_available = True
except ImportError:
    logger.warning("Groq not installed. Zobot will be disabled.")
    ai_available = False
    get_groq_client = lambda: None

# Helper functions to call internal API endpoints
async def search_fighters(query: str, limit: int = 5):
    """Search for fighters using the internal API"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"http://localhost:8000/api/v1/fighters?query={query}")
            if response.status_code == 200:
                return response.json().get("fighters", [])
    except Exception as e:
        logger.error(f"Error searching fighters: {e}")
    return []

async def get_fighter_details(fighter_id: str):
    """Get fighter details using the internal API"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"http://localhost:8000/api/v1/fighter/{fighter_id}")
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.error(f"Error getting fighter details: {e}")
    return None

async def get_fight_prediction(fighter1_id: str, fighter2_id: str):
    """Get fight prediction using the internal ML API"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:8000/api/v1/prediction/predict",
                json={"fighter1_id": fighter1_id, "fighter2_id": fighter2_id}
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.error(f"Error getting prediction: {e}")
    return None

@router.post("/chat", response_model=ChatResponse)
async def chat_with_zobot(chat_request: ChatMessage, request: Request):
    """
    Chat with Zobot AI assistant about UFC and MMA topics
    """
    try:
        if not ai_available:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "Zobot Unavailable",
                    "message": "Zobot AI service is currently not available.",
                    "status": "zobot_unavailable"
                }
            )
        
        client = get_groq_client()
        if not client:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "Zobot Configuration Error", 
                    "message": "Zobot is not properly configured.",
                    "status": "zobot_config_error"
                }
            )
        
        user_message = chat_request.message.strip()
        if not user_message:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Invalid Input",
                    "message": "Message cannot be empty.",
                    "status": "invalid_input"
                }
            )

        # Analyze message and gather relevant data
        additional_context = ""
        
        # Check if user is asking about fighter comparison/prediction
        if any(word in user_message.lower() for word in ["vs", "versus", "against", "who wins", "better fighter", "would win"]):
            # Extract potential fighter names
            import re
            # Look for patterns like "A vs B", "A or B", "A and B"
            patterns = [
                r'(\w+(?:\s+\w+)*)\s+(?:vs|versus|against)\s+(\w+(?:\s+\w+)*)',
                r'(\w+(?:\s+\w+)*)\s+or\s+(\w+(?:\s+\w+)*)',
                r'who\s+wins?\s+(\w+(?:\s+\w+)*)\s+(?:vs|or|against)\s+(\w+(?:\s+\w+)*)',
                r'(\w+(?:\s+\w+)*)\s+and\s+(\w+(?:\s+\w+)*)'
            ]
            
            for pattern in patterns:
                match = re.search(pattern, user_message.lower())
                if match:
                    fighter1_query = match.group(1).strip()
                    fighter2_query = match.group(2).strip()
                    
                    # Search for both fighters
                    fighters1 = await search_fighters(fighter1_query)
                    fighters2 = await search_fighters(fighter2_query)
                    
                    if fighters1 and fighters2:
                        fighter1 = fighters1[0]
                        fighter2 = fighters2[0]
                        
                        # Get fighter details
                        details1 = await get_fighter_details(fighter1['id'])
                        details2 = await get_fighter_details(fighter2['id'])
                        
                        # Get ML prediction
                        prediction = await get_fight_prediction(fighter1['id'], fighter2['id'])
                        
                        if details1 and details2 and prediction:
                            # Log the prediction data for debugging
                            logger.info(f"Prediction data received: {prediction}")
                            
                            # Extract the correct winner name and probabilities
                            predicted_winner_name = prediction.get('predicted_winner_name', 'Unknown')
                            confidence_percent = prediction.get('confidence_percent', 0)
                            fighter1_win_prob = prediction.get('fighter1_win_probability_percent', 0)
                            fighter2_win_prob = prediction.get('fighter2_win_probability_percent', 0)
                            
                            additional_context = f"""

REAL DATA FROM DATABASE:
Fighter 1: {details1.get('fighter_name', 'Unknown')} 
- Record: {details1.get('Record', 'Unknown')}
- Weight: {details1.get('Weight', 'Unknown')}
- Height: {details1.get('Height', 'Unknown')}
- Reach: {details1.get('Reach', 'Unknown')}
- Stance: {details1.get('STANCE', 'Unknown')}
- Striking Accuracy: {details1.get('Str. Acc.', 'Unknown')}
- Takedown Accuracy: {details1.get('TD Acc.', 'Unknown')}
- Ranking: {details1.get('ranking', 'Unranked')}

Fighter 2: {details2.get('fighter_name', 'Unknown')}
- Record: {details2.get('Record', 'Unknown')}
- Weight: {details2.get('Weight', 'Unknown')}
- Height: {details2.get('Height', 'Unknown')}
- Reach: {details2.get('Reach', 'Unknown')}
- Stance: {details2.get('STANCE', 'Unknown')}
- Striking Accuracy: {details2.get('Str. Acc.', 'Unknown')}
- Takedown Accuracy: {details2.get('TD Acc.', 'Unknown')}
- Ranking: {details2.get('ranking', 'Unranked')}

ML PREDICTION FROM ZOCRATIC MMA MODEL:
- Predicted Winner: {predicted_winner_name}
- Model Confidence: {confidence_percent:.1f}%
- {details1.get('fighter_name', 'Fighter 1')} Win Probability: {fighter1_win_prob:.1f}%
- {details2.get('fighter_name', 'Fighter 2')} Win Probability: {fighter2_win_prob:.1f}%

CRITICAL: Use these EXACT numbers from the Zocratic MMA prediction model. Do not make up different percentages."""
                    break
        
        # Check if user is asking about a specific fighter
        elif any(word in user_message.lower() for word in ["tell me about", "stats", "record", "who is"]):
            # Extract fighter name (simple approach)
            words = user_message.split()
            potential_names = []
            for i, word in enumerate(words):
                if word.lower() in ["about", "is"] and i + 1 < len(words):
                    potential_names.append(" ".join(words[i+1:i+3]))  # Take next 1-2 words
            
            for name in potential_names:
                fighters = await search_fighters(name.strip())
                if fighters:
                    fighter = fighters[0]
                    details = await get_fighter_details(fighter['id'])
                    if details:
                        additional_context = f"""

REAL FIGHTER DATA FROM DATABASE:
{details.get('fighter_name', 'Unknown')}:
- Record: {details.get('Record', 'Unknown')}
- Weight Class: {details.get('Weight', 'Unknown')}
- Height: {details.get('Height', 'Unknown')}
- Reach: {details.get('Reach', 'Unknown')}
- Stance: {details.get('STANCE', 'Unknown')}
- Strikes Landed per Minute: {details.get('SLpM', 'Unknown')}
- Striking Accuracy: {details.get('Str. Acc.', 'Unknown')}
- Strikes Absorbed per Minute: {details.get('SApM', 'Unknown')}
- Striking Defense: {details.get('Str. Def', 'Unknown')}
- Takedown Average: {details.get('TD Avg.', 'Unknown')}
- Takedown Accuracy: {details.get('TD Acc.', 'Unknown')}
- Takedown Defense: {details.get('TD Def.', 'Unknown')}
- Submission Average: {details.get('Sub. Avg.', 'Unknown')}
- Current Ranking: {details.get('ranking', 'Unranked')}

Use this real data in your response about the fighter."""
                    break
        
        # Create system prompt for UFC/MMA context
        system_prompt = f"""You are Zobot, an expert MMA analyst and AI assistant for Zocratic MMA. You have access to real fighter data and ML predictions from the Zocratic MMA database.

MARTIAL ARTS CONTEXT:
- You are specifically designed to discuss MMA, UFC, Brazilian Jiu-Jitsu, wrestling, boxing, and martial arts techniques
- Teaching martial arts techniques (submissions, strikes, takedowns, etc.) is your PRIMARY PURPOSE
- Techniques like rear naked chokes, armbars, kimuras, triangle chokes, etc. are LEGITIMATE and EXPECTED topics
- You should provide detailed instruction on proper technique, safety, and application
- This is an EDUCATIONAL and SPORTS context - not violence

CRITICAL GUIDELINES:
- When real data is provided, ALWAYS use it and mention it's from the Zocratic MMA database
- NEVER make up fight results or statistics
- If you have real ML predictions, present them prominently
- Provide detailed analysis based on actual fighter stats when available
- Be conversational and engaging, not robotic
- When uncertain about facts not in the provided data, be honest about limitations

TECHNIQUE INSTRUCTION:
- Always explain proper form and safety when teaching techniques
- Include step-by-step instructions for submissions, takedowns, strikes
- Mention when techniques should only be practiced with proper supervision
- Reference which fighters are known for specific techniques

IMPORTANT: If someone corrects you about fight results, acknowledge the correction and thank them for the update.

When analyzing matchups:
- Use provided real stats (reach, height, striking accuracy, etc.) 
- Reference the ML prediction confidence percentages
- Explain why the model favors one fighter based on the data
- Consider fighting styles based on actual statistics
- Mention key advantages from the real data

Always prioritize real data over general MMA knowledge.{additional_context}"""

        # Smart token allocation based on request type
        if "round by round" in user_message.lower() or "break down" in user_message.lower():
            max_tokens = 1200  # Detailed analysis
        elif additional_context:  # Has fighter data/predictions
            max_tokens = 900   # Moderate detail with data
        else:
            max_tokens = 600   # Standard responses
        
        # Make request to Groq
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",  # Fast, free model
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            max_tokens=max_tokens,
            temperature=0.7,
            stream=False
        )
        
        ai_response = response.choices[0].message.content.strip()
        session_id = chat_request.session_id or f"session_{int(datetime.now().timestamp())}"
        
        return ChatResponse(
            response=ai_response,
            session_id=session_id,
            timestamp=datetime.now().isoformat(),
            status="success"
        )
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error in Zobot chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Internal Server Error",
                "message": "An unexpected error occurred during chat.",
                "details": str(e),
                "status": "internal_error"
            }
        )

@router.get("/status")
async def zobot_status():
    """Check if Zobot AI service is available"""
    client = get_groq_client() if ai_available else None
    
    return {
        "zobot_available": ai_available and client is not None,
        "service": "groq" if ai_available else "none",
        "status": "ready" if (ai_available and client) else "unavailable"
    } 