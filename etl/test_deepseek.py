#!/usr/bin/env python3
"""
Simple test script to verify DeepSeek model is available through OpenLLM
"""

import subprocess
import sys
import time

def test_model_availability():
    """Test if DeepSeek model is available"""
    print("Testing DeepSeek model availability...")
    
    try:
        # Check if model is available
        result = subprocess.run(
            ["openllm", "model", "list"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if "deepseek:r1-llama3.1-8b" in result.stdout:
            print("✅ DeepSeek R1 Llama 8B model is available")
            return True
        else:
            print("❌ DeepSeek model not found in available models")
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ Command timed out")
        return False
    except Exception as e:
        print(f"❌ Error checking model availability: {e}")
        return False

def test_model_info():
    """Get information about the downloaded model"""
    print("\nGetting model information...")
    
    try:
        result = subprocess.run(
            ["openllm", "model", "get", "deepseek:r1-llama3.1-8b"],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("✅ Model information retrieved successfully")
            print(f"Model details: {result.stdout.strip()}")
            return True
        else:
            print(f"❌ Failed to get model info: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Error getting model info: {e}")
        return False

def main():
    """Main test function"""
    print("=== DeepSeek OpenLLM Test ===\n")
    
    # Test 1: Model availability
    model_available = test_model_availability()
    
    # Test 2: Model info
    if model_available:
        test_model_info()
        
        print("\n=== Test Results ===")
        print("✅ OpenLLM is installed and working")
        print("✅ DeepSeek R1 Llama 8B model is available")
        print("\n🚀 Ready to use! You can now:")
        print("   1. Open the Jupyter notebook: deepseek_openllm_demo.ipynb")
        print("   2. Start the OpenLLM server: openllm serve deepseek:r1-llama3.1-8b --port 3000")
        print("   3. Run the notebook cells to interact with the model")
        
    else:
        print("\n❌ Model not available. Please run:")
        print("   openllm model get deepseek:r1-llama3.1-8b")

if __name__ == "__main__":
    main()