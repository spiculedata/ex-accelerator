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

- The project processes social media data from the Junkipedia API using a medallion architecture (Bronze → Silver → Gold)
- Uses DuckDB as the analytical database for data storage and querying
- Uses a Python virtual environment for dependency isolation
- Main scripts: `download.py` (data fetching), `process_posts.py` (ETL pipeline), `setup.sh` (environment setup)
- No testing framework or build system is currently configured

## Documentation Requirements

**IMPORTANT**: When making changes to the project structure, scripts, or functionality, you MUST update the following documentation files to keep them current:

- **DEVELOPER_GUIDE.md**: Update architecture diagrams, usage examples, file structure, and development workflows
- **CLAUDE.md**: Update project overview, technical details, and common commands
- **setup.sh comments**: Update script descriptions and functionality explanations

Always ensure documentation reflects the current state of the codebase and includes any new features, scripts, or architectural changes.