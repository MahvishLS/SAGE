# backend/groq_report_generator.py
"""
Generate AI-powered ESG compliance reports using Groq API
"""
import json
import requests
from typing import Dict, Any, Optional
from pathlib import Path


def generate_report_with_groq(json_data: Dict[str, Any], category: str) -> Optional[str]:
    """
    Send JSON summary to Groq and generate comprehensive ESG report
    
    Args:
        json_data: Matching results JSON for a category
        category: "Environmental", "Social", or "Governance"
    
    Returns:
        Generated report as markdown string, or None if failed
    """
    
    # Extract key information to reduce token count
    metadata = json_data.get("metadata", {})
    gap_analysis = json_data.get("gap_analysis", {})
    coverage_stats = gap_analysis.get("coverage_statistics", {})
    matches = json_data.get("regulation_to_disclosure_matches", [])
    
    # Get top 10 matches
    sorted_matches = sorted(
        matches, 
        key=lambda x: x.get("best_match_score", 0), 
        reverse=True
    )[:10]
    
    # Get uncovered and partially covered
    uncovered = gap_analysis.get("uncovered_regulations", [])[:10]
    partially_covered = gap_analysis.get("partially_covered_regulations", [])[:10]
    
    # Calculate statistics
    scores = [m.get("best_match_score", 0) for m in matches]
    avg_score = sum(scores) / len(scores) if scores else 0
    
    # Create condensed data summary
    summary = {
        "metadata": metadata,
        "coverage_statistics": coverage_stats,
        "score_statistics": {
            "total_regulations": len(matches),
            "average_score": round(avg_score, 4),
            "min_score": round(min(scores), 4) if scores else 0,
            "max_score": round(max(scores), 4) if scores else 0,
            "fully_covered": coverage_stats.get("fully_covered", 0),
            "partially_covered": coverage_stats.get("partially_covered", 0),
            "uncovered": coverage_stats.get("uncovered", 0)
        },
        "top_10_matches": [
            {
                "regulation_id": m.get("regulation_id"),
                "regulation_text": m.get("regulation_text", "")[:200],
                "best_match_score": m.get("best_match_score"),
                "matched_disclosures": [
                    d.get("disclosure_text", "")[:150] 
                    for d in m.get("matched_disclosures", [])[:2]
                ]
            }
            for m in sorted_matches
        ],
        "uncovered_regulations_sample": [
            {
                "regulation_id": u.get("regulation_id"),
                "regulation_text": u.get("regulation_text", "")[:200],
                "best_match_score": u.get("best_match_score")
            }
            for u in uncovered
        ],
        "partially_covered_sample": [
            {
                "regulation_id": p.get("regulation_id"),
                "regulation_text": p.get("regulation_text", "")[:200],
                "best_match_score": p.get("best_match_score")
            }
            for p in partially_covered
        ]
    }
    
    # Create prompt for Groq
    prompt = f"""You are an expert ESG compliance analyst. I'm providing you with {category} ESG compliance data. 

Please analyze this data comprehensively and generate a professional compliance report that includes:

1. **Executive Summary** - Overall assessment of compliance status
2. **Coverage Analysis** - What the coverage statistics mean (fully covered, partially covered, uncovered)
3. **Score Analysis** - Interpret the similarity scores and what they indicate about disclosure quality
4. **Top Performing Areas** - Highlight best compliance matches and why they're strong
5. **Gap Analysis** - Identify and explain uncovered/partially covered regulations and their risks
6. **Specific Recommendations** - 5-7 actionable steps to improve compliance, prioritized by impact

Here's the data summary:

{json.dumps(summary, indent=2)}

Please provide a detailed, insightful analysis in markdown format. Explain what the numbers mean, identify patterns, assess risks, and provide specific actionable recommendations. Write as if presenting to company executives and investors. Be thorough and professional."""

    try:
        print(f"  Generating {category} report with Groq AI...")
        
        response = requests.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {
                        "role": "system", 
                        "content": "You are an expert ESG compliance analyst with deep knowledge of regulatory requirements, disclosure quality assessment, and sustainability reporting. Provide comprehensive, actionable insights."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 4000
            },
            timeout=120
        )
        
        if response.status_code == 200:
            report = response.json()["choices"][0]["message"]["content"]
            print(f"  ✓ Report generated! ({len(report):,} characters)")
            return report
        else:
            print(f"  ❌ Groq API Error: {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return None
            
    except Exception as e:
        print(f"  ❌ Request failed: {e}")
        return None


def generate_all_reports(matching_output_dir: Path) -> Dict[str, Any]:
    """
    Generate reports for all three ESG categories
    
    Args:
        matching_output_dir: Path to matching_output directory
    
    Returns:
        Dictionary with report content and metadata
    """
    categories = {
        "Environmental": "matching_environmental.json",
        "Social": "matching_social.json",
        "Governance": "matching_governance.json"
    }
    
    print("\n" + "=" * 70)
    print("GENERATING AI-POWERED ESG COMPLIANCE REPORTS")
    print("=" * 70)
    
    reports = {}
    results = []
    
    for category, filename in categories.items():
        print(f"\n[{category.upper()}]")
        
        input_file = matching_output_dir / filename
        
        # Check if file exists
        if not input_file.exists():
            print(f"  ⚠️  {filename} not found - skipping")
            results.append({
                "category": category,
                "status": "skipped",
                "reason": "file_not_found"
            })
            continue
        
        # Load JSON data
        print(f"  📄 Loading {filename}...")
        try:
            with open(input_file, "r", encoding="utf-8") as f:
                json_data = json.load(f)
            print(f"  ✓ Data loaded")
        except Exception as e:
            print(f"  ❌ Failed to load: {e}")
            results.append({
                "category": category,
                "status": "failed",
                "reason": str(e)
            })
            continue
        
        # Generate report with AI
        report = generate_report_with_groq(json_data, category)
        
        if report and len(report) > 500:
            # Save report to file
            output_file = matching_output_dir / f"{category.lower()}_compliance_report.md"
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(f"# {category} ESG Compliance Report\n\n")
                f.write(report)
            
            print(f"  ✓ Saved: {output_file.name} ({len(report):,} characters)")
            
            # Store in memory for API response
            reports[category.lower()] = {
                "category": category,
                "report_markdown": report,
                "report_length": len(report),
                "coverage_percentage": json_data.get("gap_analysis", {})
                    .get("coverage_statistics", {})
                    .get("coverage_percentage", 0),
                "metadata": json_data.get("metadata", {})
            }
            
            results.append({
                "category": category,
                "status": "success",
                "file": output_file.name,
                "length": len(report)
            })
        else:
            print(f"  ❌ Report generation failed")
            results.append({
                "category": category,
                "status": "failed",
                "reason": "generation_failed"
            })
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    successful = sum(1 for r in results if r.get('status') == 'success')
    
    for result in results:
        if result.get('status') == 'success':
            print(f"  ✅ {result['category']:15} → {result['file']} ({result['length']:,} chars)")
        elif result.get('status') == 'skipped':
            print(f"  ⚠️  {result['category']:15} → Skipped (no data)")
        else:
            print(f"  ❌ {result['category']:15} → Failed")
    
    print(f"\n  📊 Generated {successful}/{len(results)} reports successfully")
    print("=" * 70 + "\n")
    
    return {
        "reports": reports,
        "summary": {
            "total": len(results),
            "successful": successful,
            "failed": len(results) - successful
        },
        "details": results
    }


if __name__ == "__main__":
    # Test standalone
    import sys
    
    if len(sys.argv) > 1:
        output_dir = Path(sys.argv[1])
    else:
        output_dir = Path("matching_output")
    
    if not output_dir.exists():
        print(f"Error: Directory {output_dir} not found")
        sys.exit(1)
    
    generate_all_reports(output_dir)