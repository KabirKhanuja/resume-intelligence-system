from sentence_transformers import SentenceTransformer
from fastapi import FastAPI
from pydantic import BaseModel

model = SentenceTransformer("all-MiniLM-L6-v2")
app = FastAPI()

class TextInput(BaseModel):
    text: str

@app.post("/embed")
def embed(input: TextInput):
    vector = model.encode(input.text).tolist()
    return { "embedding": vector }