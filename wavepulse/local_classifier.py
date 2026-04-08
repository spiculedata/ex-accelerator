#!/usr/bin/env python3
"""
Local LLM Classifier for WavePulse Radio Transcripts
Replaces Google Gemini with Ollama for transcript classification.

Classifies radio segments as:
  - political_news: Political news/discussion
  - political_ad: Political advertisement
  - apolitical: Non-political content

Usage:
    from local_classifier import classify_transcript
    result = classify_transcript("The senator announced new legislation...")
"""

import os
import json
import logging

logger = logging.getLogger(__name__)

OLLAMA_HOST = os.environ.get('OLLAMA_HOST', 'http://ollama:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'gemma4')

CLASSIFICATION_PROMPT = """Classify this radio transcript segment into exactly one category:
- "political_news" — Political news, policy discussion, election coverage, government actions
- "political_ad" — Political advertisement, campaign messaging, endorsements
- "apolitical" — Non-political content (weather, sports, music, general entertainment, commercial ads)

Respond with ONLY a JSON object: {"category": "<category>", "confidence": <0.0-1.0>}

Transcript:
{text}"""


def classify_transcript(text: str, model: str = None) -> dict:
    """Classify a radio transcript segment using local Ollama LLM.

    Returns: {"category": str, "confidence": float, "model": str}
    """
    if not text or len(text.strip()) < 20:
        return {"category": "apolitical", "confidence": 0.0, "model": "skip"}

    model = model or OLLAMA_MODEL

    try:
        import ollama
        client = ollama.Client(host=OLLAMA_HOST)

        response = client.chat(
            model=model,
            messages=[{"role": "user", "content": CLASSIFICATION_PROMPT.format(text=text[:2000])}],
            options={"temperature": 0.1, "num_predict": 100},
            format="json"
        )

        content = response['message']['content']
        try:
            result = json.loads(content)
            category = result.get('category', 'apolitical')
            if category not in ('political_news', 'political_ad', 'apolitical'):
                category = 'apolitical'
            return {
                "category": category,
                "confidence": float(result.get('confidence', 0.5)),
                "model": model
            }
        except json.JSONDecodeError:
            # Try to extract category from raw text
            lower = content.lower()
            if 'political_news' in lower:
                return {"category": "political_news", "confidence": 0.6, "model": model}
            elif 'political_ad' in lower:
                return {"category": "political_ad", "confidence": 0.6, "model": model}
            return {"category": "apolitical", "confidence": 0.4, "model": model}

    except ImportError:
        logger.warning("ollama not installed, falling back to keyword classification")
        return _keyword_classify(text)
    except Exception as e:
        logger.warning(f"Ollama error: {e}, falling back to keyword classification")
        return _keyword_classify(text)


def _keyword_classify(text: str) -> dict:
    """Simple keyword-based fallback when LLM is unavailable."""
    lower = text.lower()
    political_keywords = [
        'congress', 'senate', 'president', 'governor', 'election', 'vote',
        'democrat', 'republican', 'legislation', 'policy', 'campaign',
        'political', 'government', 'parliament', 'minister', 'law',
        'senator', 'representative', 'immigration', 'tax', 'budget'
    ]
    ad_keywords = [
        'paid for by', 'approved this message', 'vote for', 'elect',
        'campaign', 'donate', 'contribution', 'political action committee'
    ]

    political_score = sum(1 for kw in political_keywords if kw in lower)
    ad_score = sum(1 for kw in ad_keywords if kw in lower)

    if ad_score >= 2:
        return {"category": "political_ad", "confidence": 0.5, "model": "keyword"}
    elif political_score >= 3:
        return {"category": "political_news", "confidence": 0.5, "model": "keyword"}
    return {"category": "apolitical", "confidence": 0.4, "model": "keyword"}


def classify_batch(segments: list, model: str = None) -> list:
    """Classify multiple transcript segments."""
    return [classify_transcript(seg, model) for seg in segments]


if __name__ == "__main__":
    # Test
    test_texts = [
        "The senator announced new legislation to address climate change funding.",
        "Today's weather forecast calls for sunny skies and temperatures in the mid-70s.",
        "I'm John Smith and I approve this message. Vote Smith for a better tomorrow.",
    ]
    for text in test_texts:
        result = classify_transcript(text)
        print(f"  [{result['category']}] ({result['confidence']:.1f}) {text[:60]}...")
