# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Python ETL (Extract, Transform, Load) project for downloading data from the Junkipedia API. The project structure is minimal with a single Python script and a virtual environment setup.

## Architecture

- **Main Script**: `download.py` - Contains the primary ETL logic for downloading data from the Junkipedia API
- **Virtual Environment**: `polars/` - Python 3.12.2 virtual environment with required dependencies
- **API Documentation**: The project integrates with the Junkipedia API (https://www.junkipedia.org/apidocs)

## Development Environment

The project uses a Python virtual environment located in the `polars/` directory:
- Python version: 3.12.2
- Virtual environment path: `/Users/tombarber/Projects/ex-accelerator/etl/polars`
- Activation command: `source polars/bin/activate`

## Common Commands

### Environment Setup
```bash
# Activate the virtual environment
source polars/bin/activate

# Deactivate the virtual environment
deactivate
```

### Running the ETL Process
```bash
# Run the main download script
python download.py
```

### Package Management
```bash
# Install new packages (ensure virtual environment is activated)
pip install <package-name>

# List installed packages
pip list

# Generate requirements file if needed
pip freeze > requirements.txt
```

## Key Technical Details

- The project appears to be focused on data extraction from the Junkipedia API
- Uses a Python virtual environment for dependency isolation
- The main functionality is contained in a single `download.py` script
- No testing framework or build system is currently configured