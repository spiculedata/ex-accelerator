# Jupyter Lab Setup & Usage Guide

## 🚀 Quick Start

### 1. Bootstrap Environment (One-time setup)
```bash
npm run jupyter:bootstrap
```

### 2. Start Development with Jupyter
```bash
npm run dev:jupyter
```

This will:
- Install Python dependencies
- Start Jupyter Lab on http://localhost:8888
- Start SvelteKit dev server on http://localhost:5173

### 3. Access Notebooks
1. Open http://localhost:5173/text-analytics/research-investigation
2. Select a notebook template
3. Click "Start JupyterLab" to get instructions
4. Use embedded viewer or open directly in Jupyter Lab

## ✅ Verification Steps

After running `npm run dev:jupyter`, verify everything is working:

1. **Check SvelteKit**: http://localhost:5173 should show the application
2. **Check Jupyter Lab**: the start script prints a `http://localhost:8888/?token=...` link; Jupyter refuses requests without the token
3. **Check Notebooks**: Navigate to Research Investigation page and test embedded viewer

## 📚 Available Notebooks

All notebooks are located in the `notebooks/` directory:

### 1. Sentiment Analysis (`sentiment_analysis.ipynb`)
- TextBlob and VADER sentiment analysis
- Social media text examples
- Visualization of sentiment distributions
- Comparison of different sentiment methods

### 2. Topic Modeling (`topic_modeling.ipynb`)
- LDA (Latent Dirichlet Allocation)
- Word embeddings and clustering
- Topic visualization

### 3. Text Classification (`text_classification.ipynb`)
- Scikit-learn classifiers
- Feature extraction (TF-IDF, etc.)
- Model evaluation and comparison

### 4. Language Detection (`language_detection.ipynb`)
- Multi-language text detection
- Language-specific analysis
- Cross-language comparison

### 5. Custom Research (`custom_research.ipynb`)
- Blank template for custom analysis
- Pre-loaded with common imports
- Ready for experimentation

## 🔧 Manual Commands

If you need to run components separately:

```bash
# Install Python dependencies only
poetry install

# Bootstrap notebooks without starting servers
poetry run python bootstrap_notebooks.py

# Start only Jupyter Lab
npm run jupyter:start

# Start only SvelteKit
npm run dev
```

## 🛠️ Configuration Details

### Jupyter Lab Configuration
`npm run jupyter:bootstrap` writes the project-local `.jupyter/jupyter_lab_config.py` (your own `~/.jupyter` is not touched). It
sets the **allowed origin** for cross-origin access and framing (`JUPYTER_ALLOW_ORIGIN`, default `http://localhost:5173`) and the
**default directory** (`./notebooks`). Authentication and XSRF checks stay at Jupyter's secure defaults.

The start scripts and the app's Start button add the rest on the command line and in the environment: **loopback only**, **port 8888
with no fallback** to another port, and a **random token** on every start (set `JUPYTER_TOKEN` to choose one).

### Python Environment
Managed by Poetry (`pyproject.toml`):
- **Python 3.12+** required
- **Package mode disabled** (this is a UI project, not a Python package)
- **All text analytics libraries** pre-installed

### NLTK Data
Automatically downloaded during bootstrap:
- punkt, vader_lexicon, stopwords, wordnet
- averaged_perceptron_tagger, brown, movie_reviews
- twitter_samples, omw-1.4

## 🚨 Troubleshooting

### Common Issues

#### "Module not found" Error
```bash
# Re-run bootstrap
npm run jupyter:bootstrap

# Or manually install
poetry install
```

#### Jupyter Lab Won't Start
```bash
# Kill existing instances
pkill -f "jupyter lab"

# Check if port is in use
lsof -i :8888

# Start manually to see errors
npm run jupyter:start
```

#### Embedding Not Working
1. Check that Jupyter Lab is running: http://localhost:8888
2. Verify the project-local `.jupyter/jupyter_lab_config.py` exists (run `npm run jupyter:bootstrap`) and that `JUPYTER_ALLOW_ORIGIN` matches the address you open the app on
3. Try opening notebook directly in Jupyter Lab first

#### Poetry Issues
```bash
# Clear cache and reinstall
poetry cache clear --all pypi
poetry install --no-cache

# Check Python version
python --version  # Should be 3.12+
```

### Log Files
- `jupyter.log` - Jupyter Lab server logs
- Check browser console for embedding errors
- Use `poetry run python bootstrap_notebooks.py` to test setup

## 🎯 Usage Tips

1. **Start with Templates**: Use pre-built notebooks as starting points
2. **Embedded vs Full**: Use embedded viewer for quick checks, full Jupyter Lab for serious work
3. **Save Often**: Notebooks auto-save but manual saves are recommended
4. **Export Results**: Use "Download" buttons to save notebooks locally
5. **Collaborate**: Share notebook files via git or export as HTML/PDF

## 🔍 Development Workflow

1. **Select Template**: Choose from 5 pre-configured notebooks
2. **Start Analysis**: Use embedded viewer or full Jupyter Lab
3. **Iterate**: Modify cells, run analysis, visualize results
4. **Export**: Download completed notebooks
5. **Share**: Commit notebooks to git or export as reports

## 📦 Installed Libraries

### Data Analysis
- **pandas**: Data manipulation and analysis
- **numpy**: Numerical computing
- **matplotlib**: Static plotting
- **seaborn**: Statistical visualization
- **plotly**: Interactive plots

### Machine Learning
- **scikit-learn**: Machine learning algorithms
- **scipy**: Scientific computing

### NLP (Natural Language Processing)
- **nltk**: Natural Language Toolkit
- **textblob**: Simple NLP tasks

### Jupyter
- **jupyterlab**: Modern Jupyter interface
- **ipywidgets**: Interactive widgets

All libraries are pre-installed and ready to use in any notebook!