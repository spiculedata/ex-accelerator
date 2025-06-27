# A python process to download data from the junkipedia api docs here: https://www.junkipedia.org/apidocs

import requests
import json
import os
import time
import glob
from datetime import datetime

def download_channels_data():
    # API configuration
    api_url = "https://www.junkipedia.org/api/v1/lists/5412/get_channels"
    headers = {
        "Authorization": "Bearer 2i1FjtjVU4LcpKC6hWLBjkd3"
    }
    
    # Create timestamped directory structure
    today = datetime.now().strftime("%Y-%m-%d")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    data_dir = f"data/{today}"
    os.makedirs(data_dir, exist_ok=True)
    
    # Download data
    try:
        response = requests.get(api_url, headers=headers)
        response.raise_for_status()
        
        # Save JSON data with timestamp
        filename = f"channels_list_5412_{timestamp}.json"
        filepath = os.path.join(data_dir, filename)
        
        with open(filepath, 'w') as f:
            json.dump(response.json(), f, indent=2)
        
        print(f"Data successfully downloaded to: {filepath}")
        print(f"File size: {os.path.getsize(filepath)} bytes")
        
    except requests.exceptions.RequestException as e:
        print(f"Error downloading data: {e}")
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")

def get_latest_channels_file():
    """Find the most recent channels file"""
    pattern = "data/*/channels_list_*.json"
    files = glob.glob(pattern)
    if not files:
        return None
    return max(files, key=os.path.getctime)

def download_posts_for_channels():
    """Download posts for each channel from the latest channels file"""
    # Find latest channels file
    latest_file = get_latest_channels_file()
    if not latest_file:
        print("No channels file found. Run download_channels_data() first.")
        return
    
    print(f"Using channels file: {latest_file}")
    
    # Load channels data
    with open(latest_file, 'r') as f:
        channels_data = json.load(f)
    
    # Extract channel IDs
    channel_ids = []
    for channel in channels_data.get('data', []):
        channel_id = channel.get('id')
        if channel_id:
            channel_ids.append(channel_id)
    
    print(f"Found {len(channel_ids)} channels to process")
    
    # API configuration
    base_url = "https://www.junkipedia.org/api/v1/posts"
    headers = {
        "Authorization": "Bearer 2i1FjtjVU4LcpKC6hWLBjkd3"
    }
    
    # Create timestamped directory structure
    today = datetime.now().strftime("%Y-%m-%d")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    posts_dir = f"data/{today}/posts"
    os.makedirs(posts_dir, exist_ok=True)
    
    # Download posts for each channel with rate limiting
    for i, channel_id in enumerate(channel_ids):
        print(f"Processing channel {i+1}/{len(channel_ids)}: {channel_id}")
        
        # Construct API URL with new endpoint format
        api_url = f"{base_url}?channel_ids[]={channel_id}&published_at_from=empty"
        
        try:
            response = requests.get(api_url, headers=headers)
            response.raise_for_status()
            
            # Save posts data with timestamp and channel ID
            filename = f"posts_{channel_id}_{timestamp}.json"
            filepath = os.path.join(posts_dir, filename)
            
            with open(filepath, 'w') as f:
                json.dump(response.json(), f, indent=2)
            
            print(f"  -> Saved to: {filepath} ({os.path.getsize(filepath)} bytes)")
            
        except requests.exceptions.RequestException as e:
            print(f"  -> Error downloading posts for channel {channel_id}: {e}")
            continue
        except json.JSONDecodeError as e:
            print(f"  -> Error parsing JSON for channel {channel_id}: {e}")
            continue
        except Exception as e:
            print(f"  -> Unexpected error for channel {channel_id}: {e}")
            continue
        
        # Rate limiting - wait 5 seconds before next call
        if i < len(channel_ids) - 1:  # Don't wait after the last request
            print("  -> Waiting 5 seconds...")
            time.sleep(5)
    
    print(f"Completed processing {len(channel_ids)} channels")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "posts":
        print("Downloading posts for each channel...")
        download_posts_for_channels()
    elif len(sys.argv) > 1 and sys.argv[1] == "channels":
        print("Downloading channels data...")
        download_channels_data()
    else:
        print("1. Downloading channels data...")
        download_channels_data()
        
        print("\n2. Downloading posts for each channel...")
        download_posts_for_channels()
