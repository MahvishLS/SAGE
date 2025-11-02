# backend/esg_bert_embedder.py
"""
Generate ESG-BERT embeddings for disclosure and regulation clauses.
Compatible with matcher.py format requirements.
"""
import json
from pathlib import Path
from transformers import AutoTokenizer, AutoModel
import torch
import numpy as np
from typing import List, Dict, Any

class ESGBERTEmbedder:
    """Wrapper for ESG-BERT to generate sentence embeddings."""
    
    def __init__(self, model_name='nbroad/ESG-BERT', device=None):
        """Initialize ESG-BERT model and tokenizer."""
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Loading ESG-BERT model on {self.device}...")
        
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name).to(self.device)
        self.model.eval()
        
        print("✓ ESG-BERT model loaded!\n")
    
    def mean_pooling(self, token_embeddings, attention_mask):
        """Apply mean pooling to get sentence embeddings."""
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    
    def encode(self, sentences: List[str], batch_size: int = 16, show_progress: bool = False) -> np.ndarray:
        """
        Generate embeddings for a list of sentences.
        
        Args:
            sentences: List of strings
            batch_size: Number of sentences to process at once
            show_progress: Show progress (disabled for API use)
            
        Returns:
            numpy array of embeddings (n_sentences, embedding_dim)
        """
        if not sentences:
            return np.array([])
        
        all_embeddings = []
        
        with torch.no_grad():
            for i in range(0, len(sentences), batch_size):
                batch = sentences[i:i + batch_size]
                
                # Tokenize
                encoded = self.tokenizer(
                    batch,
                    padding=True,
                    truncation=True,
                    max_length=512,
                    return_tensors='pt'
                ).to(self.device)
                
                # Get embeddings
                outputs = self.model(**encoded)
                
                # Mean pooling
                embeddings = self.mean_pooling(
                    outputs.last_hidden_state,
                    encoded['attention_mask']
                )
                
                # Normalize (optional but recommended for similarity)
                embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
                
                all_embeddings.append(embeddings.cpu().numpy())
                
                if show_progress and (i // batch_size + 1) % 5 == 0:
                    print(f"  Processed {min(i + batch_size, len(sentences))}/{len(sentences)} clauses")
        
        return np.vstack(all_embeddings)


# Global embedder instance (loaded once for efficiency)
_embedder_instance = None

def get_embedder():
    """Get or create global ESG-BERT embedder instance."""
    global _embedder_instance
    if _embedder_instance is None:
        _embedder_instance = ESGBERTEmbedder()
    return _embedder_instance


def generate_embeddings_for_clauses(
    clauses: List[str],
    metadata: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generate embeddings for clauses using ESG-BERT.
    Compatible with matcher.py format.
    
    Args:
        clauses: List of text clauses to embed
        metadata: Dictionary containing category, company_name/regulation_id, etc.
    
    Returns:
        Dictionary with structure matching matcher.py expectations
    """
    if not clauses:
        return {
            **metadata,
            "embedding_model": "nbroad/ESG-BERT",
            "embedding_dim": 768,
            "clauses": []
        }
    
    embedder = get_embedder()
    
    # Generate embeddings
    print(f"  Generating ESG-BERT embeddings for {len(clauses)} clauses...")
    embeddings = embedder.encode(clauses, batch_size=16, show_progress=True)
    
    # Format clauses with embeddings
    category = metadata.get("category", "unknown")
    category_prefix = category[:3]  # env, soc, gov
    
    # Determine if disclosure or regulation based on metadata
    is_disclosure = "company_name" in metadata
    suffix = "disc" if is_disclosure else "reg"
    
    # Get identifier for clause_id prefix
    if is_disclosure:
        identifier = metadata.get("company_name", "Company").replace(" ", "")[:4].upper()
    else:
        identifier = metadata.get("regulation_id", "REG").replace(" ", "")[:4].upper()
    
    formatted_clauses = []
    for idx, (text, embedding) in enumerate(zip(clauses, embeddings)):
        clause_id = f"{identifier}_{category_prefix}_{idx:04d}"
        
        formatted_clauses.append({
            "clause_id": clause_id,
            "text": text,
            "embedding": embedding.tolist()
        })
    
    # Build final structure
    result = {
        **metadata,
        "embedding_model": "nbroad/ESG-BERT",
        "embedding_dim": int(embeddings.shape[1]),
        "clauses": formatted_clauses
    }
    
    print(f"  ✓ Generated {len(formatted_clauses)} embeddings (dim={embeddings.shape[1]})")
    
    return result


def generate_embeddings_from_json(
    input_file: str,
    output_file: str,
    metadata: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Load clauses from JSON, generate embeddings, save output.
    Useful for batch processing.
    
    Args:
        input_file: Path to input JSON with clauses
        output_file: Path to save embeddings
        metadata: Metadata dict
    
    Returns:
        Embeddings data dict
    """
    # Load classified clauses
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    clauses_text = data.get("clauses", [])
    
    # Generate embeddings
    output_data = generate_embeddings_for_clauses(clauses_text, metadata)
    
    # Save output
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    return output_data


# Standalone script functionality
def main():
    """
    Standalone script to generate embeddings from classified JSON files.
    Can be used for testing or batch processing.
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate ESG-BERT embeddings")
    parser.add_argument("--input-dir", required=True, help="Directory with classified JSONs")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    parser.add_argument("--doc-type", choices=["disclosure", "regulation"], required=True)
    parser.add_argument("--identifier", required=True, help="Company name or regulation ID")
    parser.add_argument("--year", help="Report year (for disclosure)")
    
    args = parser.parse_args()
    
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("=" * 70)
    print(f"GENERATING ESG-BERT EMBEDDINGS - {args.doc_type.upper()}")
    print("=" * 70)
    print(f"Identifier: {args.identifier}\n")
    
    categories = ["environmental", "social", "governance"]
    suffix = "disc" if args.doc_type == "disclosure" else "reg"
    
    for category in categories:
        input_file = input_dir / f"{category}.json"
        
        if not input_file.exists():
            print(f"⚠️  Skipping {category} - file not found\n")
            continue
        
        # Prepare metadata
        if args.doc_type == "disclosure":
            metadata = {
                "category": category,
                "company_name": args.identifier,
                "report_year": args.year or "2024",
                "document_type": "disclosure"
            }
        else:
            metadata = {
                "category": category,
                "regulation_id": args.identifier,
                "document_type": "regulation"
            }
        
        output_file = output_dir / f"{category}_{suffix}.json"
        
        print(f"\n{category.upper()}")
        print("-" * 70)
        
        generate_embeddings_from_json(str(input_file), str(output_file), metadata)
        
        file_size = output_file.stat().st_size / (1024 * 1024)
        print(f"✓ Saved: {output_file} ({file_size:.2f} MB)\n")
    
    print("=" * 70)
    print(f"✓ Complete! Outputs saved to {output_dir}")
    print("=" * 70)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()