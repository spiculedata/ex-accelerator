#!/usr/bin/env python3
"""
Bootstrap script for Jupyter notebook environment
This script sets up the Python environment for text analytics notebooks
"""

import os
import sys
import subprocess
import nltk
import ssl
from pathlib import Path

def download_nltk_data():
    """Download required NLTK data packages"""
    print("Downloading NLTK data packages...")
    
    # Handle SSL certificate issues
    try:
        _create_unverified_https_context = ssl._create_unverified_context
    except AttributeError:
        pass
    else:
        ssl._create_default_https_context = _create_unverified_https_context
    
    # Required NLTK data packages for text analytics
    packages = [
        'punkt',
        'punkt_tab',
        'vader_lexicon',
        'stopwords',
        'wordnet',
        'averaged_perceptron_tagger',
        'brown',
        'movie_reviews',
        'twitter_samples',
        'omw-1.4'
    ]
    
    for package in packages:
        try:
            print(f"Downloading {package}...")
            nltk.download(package, quiet=True)
            print(f"✓ {package} downloaded successfully")
        except Exception as e:
            print(f"⚠ Failed to download {package}: {e}")
    
    print("NLTK data download completed!")

def create_sample_notebooks():
    """Create sample notebook files"""
    print("Creating sample notebook templates...")
    
    notebooks_dir = Path("notebooks")
    notebooks_dir.mkdir(exist_ok=True)
    
    # Sentiment Analysis Notebook
    sentiment_notebook = {
        "cells": [
            {
                "cell_type": "markdown",
                "metadata": {},
                "source": [
                    "# Sentiment Analysis with NLTK and TextBlob\n",
                    "\n",
                    "This notebook demonstrates sentiment analysis techniques for social media text data.\n",
                    "\n",
                    "## Features:\n",
                    "- TextBlob sentiment analysis\n",
                    "- NLTK VADER sentiment analyzer\n",
                    "- Visualization of sentiment distributions\n",
                    "- Comparison of different sentiment analysis methods"
                ]
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "source": [
                    "# Import required libraries\n",
                    "import pandas as pd\n",
                    "import numpy as np\n",
                    "import matplotlib.pyplot as plt\n",
                    "import seaborn as sns\n",
                    "from textblob import TextBlob\n",
                    "from nltk.sentiment import SentimentIntensityAnalyzer\n",
                    "import nltk\n",
                    "\n",
                    "# Ensure NLTK data is available\n",
                    "try:\n",
                    "    nltk.data.find('vader_lexicon')\n",
                    "except LookupError:\n",
                    "    nltk.download('vader_lexicon')\n",
                    "\n",
                    "# Initialize sentiment analyzer\n",
                    "sia = SentimentIntensityAnalyzer()\n",
                    "\n",
                    "print('Libraries loaded successfully!')\n",
                    "print('Sentiment analyzers initialized!')"
                ]
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "source": [
                    "# Sample social media texts\n",
                    "sample_texts = [\n",
                    "    \"I absolutely love this new product! It's amazing! 😍\",\n",
                    "    \"This is terrible, worst experience ever. Completely disappointed.\",\n",
                    "    \"It's okay, nothing special but not bad either.\",\n",
                    "    \"Fantastic quality and great customer service! Highly recommend! 👍\",\n",
                    "    \"Not worth the money, very disappointed with the results.\",\n",
                    "    \"Mixed feelings about this. Some parts are good, others not so much.\",\n",
                    "    \"Outstanding performance! Exceeded all my expectations! 🎉\",\n",
                    "    \"Meh... it's just average. Nothing to get excited about.\"\n",
                    "]\n",
                    "\n",
                    "# Create DataFrame\n",
                    "df = pd.DataFrame({'text': sample_texts})\n",
                    "print(f'Loaded {len(df)} sample texts')\n",
                    "df.head()"
                ]
            },
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "source": [
                    "# Perform sentiment analysis with TextBlob\n",
                    "def analyze_sentiment_textblob(text):\n",
                    "    blob = TextBlob(text)\n",
                    "    return {\n",
                    "        'polarity': blob.sentiment.polarity,\n",
                    "        'subjectivity': blob.sentiment.subjectivity\n",
                    "    }\n",
                    "\n",
                    "# Perform sentiment analysis with VADER\n",
                    "def analyze_sentiment_vader(text):\n",
                    "    scores = sia.polarity_scores(text)\n",
                    "    return scores\n",
                    "\n",
                    "# Apply sentiment analysis\n",
                    "df['textblob'] = df['text'].apply(analyze_sentiment_textblob)\n",
                    "df['vader'] = df['text'].apply(analyze_sentiment_vader)\n",
                    "\n",
                    "# Extract TextBlob scores\n",
                    "df['tb_polarity'] = df['textblob'].apply(lambda x: x['polarity'])\n",
                    "df['tb_subjectivity'] = df['textblob'].apply(lambda x: x['subjectivity'])\n",
                    "\n",
                    "# Extract VADER scores\n",
                    "df['vader_compound'] = df['vader'].apply(lambda x: x['compound'])\n",
                    "df['vader_pos'] = df['vader'].apply(lambda x: x['pos'])\n",
                    "df['vader_neu'] = df['vader'].apply(lambda x: x['neu'])\n",
                    "df['vader_neg'] = df['vader'].apply(lambda x: x['neg'])\n",
                    "\n",
                    "print('Sentiment analysis completed!')\n",
                    "df[['text', 'tb_polarity', 'vader_compound']].head()"
                ]
            }
        ],
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3"
            },
            "language_info": {
                "codemirror_mode": {
                    "name": "ipython",
                    "version": 3
                },
                "file_extension": ".py",
                "mimetype": "text/x-python",
                "name": "python",
                "nbconvert_exporter": "python",
                "pygments_lexer": "ipython3",
                "version": "3.12.0"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 4
    }
    
    # Write sentiment analysis notebook
    import json
    with open(notebooks_dir / "sentiment_analysis.ipynb", "w") as f:
        json.dump(sentiment_notebook, f, indent=2)
    
    print("✓ sentiment_analysis.ipynb created")
    
    # Create other notebook templates (simplified versions)
    templates = [
        ("topic_modeling.ipynb", "Topic Modeling with LDA"),
        ("text_classification.ipynb", "Text Classification with Scikit-learn"),
        ("language_detection.ipynb", "Language Detection and Analysis"),
        ("custom_research.ipynb", "Custom Research Template")
    ]
    
    for filename, title in templates:
        basic_notebook = {
            "cells": [
                {
                    "cell_type": "markdown",
                    "metadata": {},
                    "source": [f"# {title}\n\nThis notebook provides a template for {title.lower()}."]
                },
                {
                    "cell_type": "code",
                    "execution_count": None,
                    "metadata": {},
                    "source": [
                        "# Import required libraries\n",
                        "import pandas as pd\n",
                        "import numpy as np\n",
                        "import matplotlib.pyplot as plt\n",
                        "import seaborn as sns\n",
                        "\n",
                        "print('Ready to begin analysis!')"
                    ]
                }
            ],
            "metadata": {
                "kernelspec": {
                    "display_name": "Python 3",
                    "language": "python",
                    "name": "python3"
                },
                "language_info": {
                    "codemirror_mode": {
                        "name": "ipython",
                        "version": 3
                    },
                    "file_extension": ".py",
                    "mimetype": "text/x-python",
                    "name": "python",
                    "nbconvert_exporter": "python",
                    "pygments_lexer": "ipython3",
                    "version": "3.12.0"
                }
            },
            "nbformat": 4,
            "nbformat_minor": 4
        }
        
        with open(notebooks_dir / filename, "w") as f:
            json.dump(basic_notebook, f, indent=2)
        
        print(f"✓ {filename} created")

def setup_jupyter_config():
    """Setup Jupyter configuration for embedded use"""
    print("Setting up Jupyter configuration...")
    
    # Create Jupyter config directory
    jupyter_dir = Path.home() / ".jupyter"
    jupyter_dir.mkdir(exist_ok=True)
    
    # Create jupyter_lab_config.py
    config_content = '''
# Jupyter Lab configuration for embedded use
c = get_config()

# Allow embedding in iframes
c.ServerApp.tornado_settings = {
    'headers': {
        'Content-Security-Policy': "frame-ancestors 'self' http://localhost:5173 http://localhost:4173 http://localhost:3000",
    }
}

# Enable extensions
c.ServerApp.jpserver_extensions = {
    'jupyterlab': True
}

# Set default directory to notebooks folder
c.ServerApp.root_dir = './notebooks'

# Disable authentication for local development (not recommended for production)
c.ServerApp.token = ''
c.ServerApp.password = ''

# Allow origin for CORS
c.ServerApp.allow_origin = '*'
c.ServerApp.allow_credentials = True

# Disable CSRF protection for API calls
c.ServerApp.disable_check_xsrf = True
'''
    
    with open(jupyter_dir / "jupyter_lab_config.py", "w") as f:
        f.write(config_content)
    
    print("✓ Jupyter configuration created")

def main():
    """Main bootstrap function"""
    print("🏗️  Bootstrapping Jupyter notebook environment for Ex-Accelerator UI")
    print("=" * 60)
    
    try:
        # Download NLTK data
        download_nltk_data()
        print()
        
        # Create sample notebooks
        create_sample_notebooks()
        print()
        
        # Setup Jupyter configuration
        setup_jupyter_config()
        print()
        
        print("✅ Bootstrap completed successfully!")
        print("\nTo start the development environment with Jupyter integration:")
        print("  npm run dev:jupyter")
        print("\nOr start services manually:")
        print("  poetry run jupyter lab --port=8888 --no-browser --allow-root &")
        print("  npm run dev")
        
    except Exception as e:
        print(f"❌ Bootstrap failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()