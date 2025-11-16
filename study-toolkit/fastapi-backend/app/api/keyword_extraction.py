from fastapi import APIRouter
from typing import List
from sklearn.feature_extraction.text import TfidfVectorizer

router = APIRouter()

@router.post("/extract_keywords/", response_model=List[str])
async def extract_keywords(text: str, top_n: int = 5):
    vectorizer = TfidfVectorizer(stop_words='english')
    X = vectorizer.fit_transform([text])
    indices = X[0].argsort()[-top_n:][::-1]
    keywords = [vectorizer.get_feature_names_out()[i] for i in indices]
    return keywords