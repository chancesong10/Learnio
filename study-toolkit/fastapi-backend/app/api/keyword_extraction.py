from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from sklearn.feature_extraction.text import TfidfVectorizer

router = APIRouter()

class KeywordRequest(BaseModel):
    text: str
    top_n: int = 5

@router.post("/extract_keywords/", response_model=List[str])
async def extract_keywords(req: KeywordRequest):
    vectorizer = TfidfVectorizer(stop_words='english')
    try:
        X = vectorizer.fit_transform([req.text])
    except ValueError:
        # Raised when the text has no words left after removing stop words
        return []
    scores = X.toarray()[0]
    indices = scores.argsort()[-req.top_n:][::-1]
    feature_names = vectorizer.get_feature_names_out()
    return [feature_names[i] for i in indices]
