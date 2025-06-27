import polars as pl
import json
import glob
import os
from datetime import datetime


def flatten_dict(d, prefix='', separator='_'):
    """Recursively flatten a nested dictionary"""
    items = []
    for k, v in d.items():
        new_key = f"{prefix}{k}" if prefix else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key + separator, separator).items())
        elif isinstance(v, list):
            # Convert lists to JSON strings for now to avoid further complexity
            items.append((new_key, json.dumps(v) if v else None))
        else:
            # Convert all values to strings to ensure consistent typing
            items.append((new_key, str(v) if v is not None else None))
    return dict(items)


def get_latest_posts_directory():
    """Find the most recent posts directory"""
    pattern = "data/*/posts"
    dirs = glob.glob(pattern)
    if not dirs:
        return None
    return max(dirs, key=os.path.getctime)


def process_posts_to_parquet():
    """Load JSON posts data using polars streaming and save to parquet"""
    
    # Find latest posts directory
    posts_dir = get_latest_posts_directory()
    if not posts_dir:
        print("No posts directory found. Run download.py first.")
        return
    
    print(f"Processing posts from: {posts_dir}")
    
    # Get all JSON files in posts directory
    json_files = glob.glob(os.path.join(posts_dir, "posts_*.json"))
    if not json_files:
        print("No JSON post files found.")
        return
    
    print(f"Found {len(json_files)} JSON files to process")
    
    # Collect all posts data first to determine unified schema
    all_exploded_posts = []
    all_columns = set()
    
    for json_file in json_files:
        print(f"Processing: {os.path.basename(json_file)}")
        
        try:
            # Load JSON data
            with open(json_file, 'r') as f:
                data = json.load(f)
            
            # Extract posts from the API response
            posts = data.get('data', [])
            if not posts:
                print(f"  -> No posts found in {os.path.basename(json_file)}")
                continue
            
            # Explode posts data to flatten all nested JSON elements
            channel_id = os.path.basename(json_file).split('_')[1]
            processed_at = datetime.now().isoformat()
            
            for post in posts:
                base_post = {
                    'post_id': post.get('id'),
                    'post_type': post.get('type'),
                    'source_channel_id': channel_id,
                    'processed_at': processed_at
                }
                
                # Explode attributes if they exist
                attributes = post.get('attributes', {})
                if attributes:
                    # Flatten nested dictionaries with prefixes
                    flattened = flatten_dict(attributes, prefix='attr_')
                    base_post.update(flattened)
                
                all_exploded_posts.append(base_post)
                all_columns.update(base_post.keys())
            
            print(f"  -> Processed {len(posts)} posts")
            
        except Exception as e:
            print(f"  -> Error processing {os.path.basename(json_file)}: {e}")
            continue
    
    if not all_exploded_posts:
        print("No posts were successfully processed.")
        return
    
    # Normalize all posts to have the same columns
    print("Normalizing schema across all posts...")
    normalized_posts = []
    for post in all_exploded_posts:
        normalized_post = {col: post.get(col) for col in all_columns}
        normalized_posts.append(normalized_post)
    
    # Create single DataFrame with unified schema
    print("Creating unified DataFrame...")
    combined_df = pl.from_dicts(normalized_posts, infer_schema_length=None)
    
    # Create output directory
    today = datetime.now().strftime("%Y-%m-%d")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = f"data/{today}/processed"
    os.makedirs(output_dir, exist_ok=True)
    
    # Save to parquet with streaming
    output_file = os.path.join(output_dir, f"posts_combined_{timestamp}.parquet")
    
    print("Saving to parquet file...")
    combined_df.write_parquet(output_file)
    
    print(f"Successfully saved {len(combined_df)} posts to: {output_file}")
    print(f"File size: {os.path.getsize(output_file)} bytes")
    
    # Display basic statistics
    print("\nDataset statistics:")
    print(f"Total rows: {len(combined_df)}")
    print(f"Total columns: {len(combined_df.columns)}")
    print(f"Unique channels: {combined_df['source_channel_id'].n_unique()}")
    
    return output_file


def load_parquet_streaming(parquet_file):
    """Demonstrate loading parquet file with streaming mode"""
    print(f"Loading parquet file with streaming: {parquet_file}")
    
    # Use lazy loading for streaming
    lazy_df = pl.scan_parquet(parquet_file)
    
    # Example streaming operations
    result = (
        lazy_df
        .select([
            "source_channel_id",
            "post_id",
            "post_type",
            "processed_at"
        ])
        .filter(pl.col("post_id").is_not_null())
        .collect(streaming=True)
    )
    
    print(f"Streamed {len(result)} rows")
    return result


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "load":
        # Find latest parquet file
        pattern = "data/*/processed/posts_combined_*.parquet"
        parquet_files = glob.glob(pattern)
        if parquet_files:
            latest_file = max(parquet_files, key=os.path.getctime)
            load_parquet_streaming(latest_file)
        else:
            print("No parquet files found. Run without arguments first.")
    else:
        # Process JSON to parquet
        parquet_file = process_posts_to_parquet()
        
        if parquet_file:
            print("\nTo load the data with streaming, run:")
            print("python process_posts.py load")