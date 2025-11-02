from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import shutil
from pathlib import Path
import os
from esg_classifier import run_esg_analysis
from matcher import ESGMatcher

app = FastAPI(title="SAGE - Sustainability Assurance and Governance Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory structure
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("output")
EMBEDDINGS_DIR = Path("embeddings")
MATCHING_OUTPUT_DIR = Path("matching_output")

# Create directories
for dir_path in [UPLOAD_DIR, OUTPUT_DIR, EMBEDDINGS_DIR, MATCHING_OUTPUT_DIR]:
    dir_path.mkdir(exist_ok=True, parents=True)

@app.get("/")
def root():
    return {"message": "SAGE ESG-BERT API is running 🚀"}


@app.post("/analyze")
async def analyze_pdf(file: UploadFile = File(...)):
    """Upload PDF and run ESG-BERT classification."""
    file_path = UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    results = run_esg_analysis(str(file_path))
    return results

# upload function that just saves the file

# @app.post("/upload")
# async def upload_file(file: UploadFile = File(...)):
#     file_location = os.path.join(UPLOAD_DIR, file.filename)
#     with open(file_location, "wb") as f:
#         f.write(await file.read())
#     return {"filename": file.filename, "status": "uploaded successfully"}


@app.post("/upload")
async def upload_and_analyze(file: UploadFile = File(...)):
    temp_path = Path("uploads") / file.filename
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Step 1: Extract PDF → divide into ESG buckets
    extracted_paths = run_esg_analysis(temp_path)
    
    # Step 2: Delete uploaded PDF
    temp_path.unlink(missing_ok=True)

    return {
        "message": "Company disclosure uploaded & extracted successfully.",
        "categories_extracted": list(extracted_paths.keys())
    }

@app.post("/upload-framework")
async def upload_framework(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Step 1: Extract embeddings from the framework PDF
    framework_paths = run_esg_analysis(file_path)  
    os.remove(file_path)

    # Step 2: Run ESGMatcher for all 3 categories
    all_results = {}
    for category in ["environmental", "social", "governance"]:
        disclosure_file = os.path.join(EXTRACTION_OUTPUT, f"{category}_disc.json")
        regulation_file = framework_paths.get(category)

        if not (os.path.exists(disclosure_file) and os.path.exists(regulation_file)):
            continue

        matcher = ESGMatcher(disclosure_file, regulation_file)
        matcher.compute_similarity_matrix()
        all_results[category] = {
            "regulation_to_disclosure_matches": matcher.match_regulations_to_disclosures(),
            "disclosure_to_regulation_matches": matcher.match_disclosures_to_regulations(),
            "gap_analysis": matcher.gap_analysis()
        }

    return {
        "message": "Framework uploaded and ESG matching completed successfully."
    }
