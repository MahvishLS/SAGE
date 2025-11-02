# backend/main.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
import shutil
import os
import json
from typing import Dict, Any, Optional
import time

# Import your modules
from esg_classifier import extract_text_from_pdf, extract_clauses, classify_clauses
from esg_embedder import generate_embeddings_for_clauses
from matcher import ESGMatcher

app = FastAPI(title="ESG Analysis API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory structure
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("output")
EMBEDDINGS_DIR = Path("embeddings")
MATCHING_OUTPUT_DIR = Path("matching_output")

# Create all directories
for dir_path in [UPLOAD_DIR, OUTPUT_DIR, EMBEDDINGS_DIR, MATCHING_OUTPUT_DIR]:
    dir_path.mkdir(exist_ok=True, parents=True)

# Subdirectories for embeddings
(EMBEDDINGS_DIR / "disclosure").mkdir(exist_ok=True)
(EMBEDDINGS_DIR / "framework").mkdir(exist_ok=True)

# Application state to track uploads
app_state = {
    "disclosure_uploaded": False,
    "framework_uploaded": False,
    "disclosure_metadata": None,
    "framework_metadata": None
}


def process_and_generate_embeddings(
    pdf_bytes: bytes,
    doc_type: str,  # "disclosure" or "framework"
    company_name: str = None,
    report_year: str = None,
    regulation_id: str = None
) -> Dict[str, Any]:
    """
    Complete pipeline: PDF -> Text -> Classification -> Embeddings
    
    Returns:
        Dictionary with embedding file paths for each category
    """
    start_time = time.time()
    
    # Step 1: Extract text from PDF
    print(f"\n{'='*70}")
    print(f"Processing {doc_type.upper()}")
    print(f"{'='*70}")
    print("Step 1: Extracting text from PDF...")
    text = extract_text_from_pdf(pdf_bytes)
    
    # Step 2: Extract and classify clauses
    print("Step 2: Extracting clauses...")
    clauses = extract_clauses(text)
    print(f"✓ Extracted {len(clauses)} clauses")
    
    print("Step 3: Classifying clauses into ESG categories...")
    classification_result = classify_clauses(clauses)
    classified = classification_result["classified"]
    
    # Calculate summary
    total = sum(len(v) for v in classified.values())
    summary = {
        "total_clauses": total,
        "categories": {
            k: {
                "count": len(v), 
                "percentage": round(len(v)/total*100, 2) if total else 0
            }
            for k, v in classified.items()
        }
    }
    
    print(f"\n✓ Classification Summary:")
    for cat, stats in summary["categories"].items():
        print(f"  - {cat}: {stats['count']} clauses ({stats['percentage']}%)")
    
    # Step 4: Generate embeddings for each category
    print("\nStep 4: Generating embeddings...")
    embedding_paths = {}
    
    for category in ["Environmental", "Social", "Governance"]:
        category_clauses = classified.get(category, [])
        if not category_clauses:
            print(f"⚠️  No clauses for {category}, skipping...")
            continue
        
        category_lower = category.lower()
        
        # Prepare metadata
        if doc_type == "disclosure":
            metadata = {
                "category": category_lower,
                "company_name": company_name or "Unknown Company",
                "report_year": report_year or "2024",
                "document_type": "disclosure"
            }
            suffix = "disc"
            output_subdir = "disclosure"
        else:  # framework
            metadata = {
                "category": category_lower,
                "regulation_id": regulation_id or "Unknown Regulation",
                "document_type": "regulation"
            }
            suffix = "reg"
            output_subdir = "framework"
        
        # Generate embeddings
        print(f"  Generating {category} embeddings ({len(category_clauses)} clauses)...")
        embeddings_data = generate_embeddings_for_clauses(
            clauses=category_clauses,
            metadata=metadata
        )
        
        # Save embeddings in matcher-compatible format
        output_file = EMBEDDINGS_DIR / output_subdir / f"{category_lower}_{suffix}.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(embeddings_data, f, indent=2, ensure_ascii=False)
        
        embedding_paths[category_lower] = str(output_file)
        print(f"  ✓ Saved {category} embeddings to {output_file}")
    
    processing_time = time.time() - start_time
    print(f"\n✓ Complete pipeline finished in {processing_time:.2f}s")
    print(f"{'='*70}\n")
    
    return {
        "summary": summary,
        "embedding_paths": embedding_paths,
        "processing_time": processing_time
    }


@app.get("/")
async def root():
    """API status endpoint"""
    return {
        "message": "ESG Analysis API",
        "version": "1.0",
        "status": "running",
        "endpoints": {
            "upload_disclosure": "/upload/disclosure",
            "upload_framework": "/upload/framework",
            "perform_matching": "/match",
            "get_status": "/status",
            "reset": "/reset"
        }
    }


@app.post("/upload/disclosure")
async def upload_disclosure_report(
    file: UploadFile = File(...),
    company_name: str = "Company",
    report_year: str = "2024"
):
    """
    API 1: Upload company disclosure report
    
    Steps:
    1. Receives PDF file
    2. Extracts and classifies text into E/S/G categories
    3. Generates embeddings for each category
    4. Saves embeddings in format compatible with matcher
    5. Cleans up temporary files
    
    Returns:
        Processing summary and paths to generated embeddings
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    try:
        # Read file bytes
        pdf_bytes = await file.read()
        
        print(f"\n📄 Received disclosure report: {file.filename}")
        print(f"   Company: {company_name}")
        print(f"   Year: {report_year}")
        
        # Process: PDF -> Classification -> Embeddings
        result = process_and_generate_embeddings(
            pdf_bytes=pdf_bytes,
            doc_type="disclosure",
            company_name=company_name,
            report_year=report_year
        )
        
        # Update application state
        app_state["disclosure_uploaded"] = True
        app_state["disclosure_metadata"] = {
            "company_name": company_name,
            "report_year": report_year,
            "categories": list(result["embedding_paths"].keys()),
            "embedding_paths": result["embedding_paths"]
        }
        
        return JSONResponse({
            "success": True,
            "message": "Disclosure report processed successfully",
            "company_name": company_name,
            "report_year": report_year,
            "summary": result["summary"],
            "processing_time": round(result["processing_time"], 2),
            "categories_processed": list(result["embedding_paths"].keys()),
            "next_step": "Upload framework PDF via /upload/framework to proceed with matching",
            "status": {
                "disclosure_ready": True,
                "framework_ready": app_state["framework_uploaded"],
                "ready_for_matching": app_state["framework_uploaded"]
            }
        })
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Error processing disclosure: {error_trace}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to process disclosure report: {str(e)}"
        )


@app.post("/upload/framework")
async def upload_framework_pdf(
    file: UploadFile = File(...),
    regulation_id: str = "BRSR"
):
    """
    API 2: Upload framework/regulation PDF
    
    Steps:
    1. Receives framework PDF
    2. Extracts and classifies text into E/S/G categories
    3. Generates embeddings for each category
    4. Saves embeddings in format compatible with matcher
    5. Cleans up temporary files
    
    Returns:
        Processing summary and readiness status for matching
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    try:
        # Read file bytes
        pdf_bytes = await file.read()
        
        print(f"\n📋 Received framework: {file.filename}")
        print(f"   Regulation ID: {regulation_id}")
        
        # Process: PDF -> Classification -> Embeddings
        result = process_and_generate_embeddings(
            pdf_bytes=pdf_bytes,
            doc_type="framework",
            regulation_id=regulation_id
        )
        
        # Update application state
        app_state["framework_uploaded"] = True
        app_state["framework_metadata"] = {
            "regulation_id": regulation_id,
            "categories": list(result["embedding_paths"].keys()),
            "embedding_paths": result["embedding_paths"]
        }
        
        response_data = {
            "success": True,
            "message": "Framework processed successfully",
            "regulation_id": regulation_id,
            "summary": result["summary"],
            "processing_time": round(result["processing_time"], 2),
            "categories_processed": list(result["embedding_paths"].keys()),
            "status": {
                "disclosure_ready": app_state["disclosure_uploaded"],
                "framework_ready": True,
                "ready_for_matching": app_state["disclosure_uploaded"]
            }
        }
        
        # Check if ready for matching
        if app_state["disclosure_uploaded"]:
            response_data["next_step"] = "Ready for matching! Call /match to perform ESG analysis"
            response_data["ready_for_matching"] = True
        else:
            response_data["next_step"] = "Upload disclosure report first via /upload/disclosure"
            response_data["ready_for_matching"] = False
            response_data["warning"] = "Disclosure report not uploaded yet"
        
        return JSONResponse(response_data)
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Error processing framework: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process framework: {str(e)}"
        )


@app.post("/match")
async def perform_esg_matching():
    """
    API 3: Perform ESG matching between disclosure and framework
    
    Requirements:
    - Both disclosure and framework must be uploaded
    
    Process:
    1. Validates both uploads are complete
    2. Runs semantic matching for Environmental, Social, Governance
    3. Generates comprehensive gap analysis
    4. Returns detailed matching results
    
    Returns:
        Complete matching analysis with coverage statistics
    """
    # Validation
    if not app_state["disclosure_uploaded"]:
        raise HTTPException(
            status_code=400,
            detail="Disclosure report not uploaded. Please upload via /upload/disclosure first."
        )
    
    if not app_state["framework_uploaded"]:
        raise HTTPException(
            status_code=400,
            detail="Framework not uploaded. Please upload via /upload/framework first."
        )
    
    try:
        print("\n" + "="*70)
        print("STARTING ESG SEMANTIC MATCHING & GAP ANALYSIS")
        print("="*70)
        print(f"Company: {app_state['disclosure_metadata']['company_name']}")
        print(f"Framework: {app_state['framework_metadata']['regulation_id']}")
        print("="*70 + "\n")
        
        all_results = {}
        categories = ["environmental", "social", "governance"]
        
        for category in categories:
            print(f"\n{'='*70}")
            print(f"Processing {category.upper()} Category")
            print(f"{'='*70}")
            
            # Get embedding file paths
            disclosure_path = app_state["disclosure_metadata"]["embedding_paths"].get(category)
            framework_path = app_state["framework_metadata"]["embedding_paths"].get(category)
            
            # Check if both files exist
            if not disclosure_path or not framework_path:
                print(f"⚠️  Skipping {category}: Missing embedding files")
                continue
            
            if not (Path(disclosure_path).exists() and Path(framework_path).exists()):
                print(f"⚠️  Skipping {category}: Files not found on disk")
                continue
            
            print(f"Disclosure file: {disclosure_path}")
            print(f"Framework file: {framework_path}\n")
            
            # Initialize matcher
            matcher = ESGMatcher(disclosure_path, framework_path)
            
            # Compute similarity matrix
            matcher.compute_similarity_matrix()
            
            # Perform matching (top 3 matches per regulation, min threshold 0.5)
            regulation_matches = matcher.match_regulations_to_disclosures(
                top_k=3,
                min_threshold=0.5
            )
            
            # Find best regulation for each disclosure (threshold 0.75)
            disclosure_matches = matcher.match_disclosures_to_regulations(
                threshold=0.75
            )
            
            # Gap analysis (coverage threshold 0.75)
            gap_analysis = matcher.gap_analysis(coverage_threshold=0.75)
            
            # Compile results for this category
            all_results[category] = {
                "metadata": {
                    "category": category,
                    "company_name": app_state["disclosure_metadata"]["company_name"],
                    "report_year": app_state["disclosure_metadata"]["report_year"],
                    "regulation_id": app_state["framework_metadata"]["regulation_id"],
                    "embedding_model": "sentence-transformers/all-MiniLM-L6-v2"
                },
                "regulation_to_disclosure_matches": regulation_matches,
                "disclosure_to_regulation_matches": disclosure_matches,
                "gap_analysis": gap_analysis
            }
            
            # Save individual category results
            category_output = MATCHING_OUTPUT_DIR / f"matching_{category}.json"
            with open(category_output, "w", encoding="utf-8") as f:
                json.dump(all_results[category], f, indent=2, ensure_ascii=False)
            
            # Print summary
            stats = gap_analysis['coverage_statistics']
            print(f"\n{'='*70}")
            print(f"{category.upper()} SUMMARY")
            print(f"{'='*70}")
            print(f"Total Regulations: {stats['total_regulations']}")
            print(f"Fully Covered: {stats['fully_covered']} ({stats['coverage_percentage']}%)")
            print(f"Partially Covered: {stats['partially_covered']}")
            print(f"Uncovered: {stats['uncovered']}")
            print(f"Disclosure Matches: {len(disclosure_matches)}")
            print(f"{'='*70}\n")
        
        if not all_results:
            raise HTTPException(
                status_code=500,
                detail="No categories were successfully processed. Check embedding files."
            )
        
        # Save combined results
        combined_output = MATCHING_OUTPUT_DIR / "matching_combined.json"
        with open(combined_output, "w", encoding="utf-8") as f:
            json.dump(all_results, f, indent=2, ensure_ascii=False)
        
        # Generate overall summary
        overall_summary = {
            "company_name": app_state["disclosure_metadata"]["company_name"],
            "report_year": app_state["disclosure_metadata"]["report_year"],
            "regulation_id": app_state["framework_metadata"]["regulation_id"],
            "categories_analyzed": len(all_results),
            "categories": {}
        }
        
        for cat, results in all_results.items():
            stats = results["gap_analysis"]["coverage_statistics"]
            overall_summary["categories"][cat] = {
                "total_regulations": stats["total_regulations"],
                "coverage_percentage": stats["coverage_percentage"],
                "fully_covered": stats["fully_covered"],
                "partially_covered": stats["partially_covered"],
                "uncovered": stats["uncovered"],
                "total_disclosure_matches": len(results["disclosure_to_regulation_matches"])
            }
        
        print("\n" + "="*70)
        print("✅ ESG MATCHING COMPLETE")
        print("="*70)
        print(f"Results saved to: {combined_output}")
        print("="*70 + "\n")
        
        return JSONResponse({
            "success": True,
            "message": "ESG matching completed successfully",
            "summary": overall_summary,
            "detailed_results": all_results,
            "output_files": {
                "combined": str(combined_output),
                "individual": {
                    cat: str(MATCHING_OUTPUT_DIR / f"matching_{cat}.json")
                    for cat in all_results.keys()
                }
            }
        })
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Matching failed: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Matching failed: {str(e)}"
        )


@app.get("/status")
async def get_status():
    """Check current processing status"""
    return {
        "disclosure": {
            "uploaded": app_state["disclosure_uploaded"],
            "metadata": app_state["disclosure_metadata"]
        },
        "framework": {
            "uploaded": app_state["framework_uploaded"],
            "metadata": app_state["framework_metadata"]
        },
        "ready_for_matching": (
            app_state["disclosure_uploaded"] and 
            app_state["framework_uploaded"]
        )
    }


@app.post("/reset")
async def reset_state():
    """Reset application state (does not delete files)"""
    app_state["disclosure_uploaded"] = False
    app_state["framework_uploaded"] = False
    app_state["disclosure_metadata"] = None
    app_state["framework_metadata"] = None
    
    return {
        "success": True,
        "message": "Application state reset successfully",
        "note": "Existing files in output directories are preserved"
    }


@app.delete("/cleanup")
async def cleanup_files():
    """Delete all generated files and reset state"""
    try:
        # Remove all files in directories
        for directory in [OUTPUT_DIR, EMBEDDINGS_DIR, MATCHING_OUTPUT_DIR]:
            if directory.exists():
                shutil.rmtree(directory)
                directory.mkdir(exist_ok=True, parents=True)
        
        # Recreate subdirectories
        (EMBEDDINGS_DIR / "disclosure").mkdir(exist_ok=True)
        (EMBEDDINGS_DIR / "framework").mkdir(exist_ok=True)
        
        # Reset state
        app_state["disclosure_uploaded"] = False
        app_state["framework_uploaded"] = False
        app_state["disclosure_metadata"] = None
        app_state["framework_metadata"] = None
        
        return {
            "success": True,
            "message": "All files cleaned up and state reset"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*70)
    print("ESG Analysis API Server")
    print("="*70)
    print("Starting server on http://localhost:8000")
    print("API Documentation: http://localhost:8000/docs")
    print("="*70 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)