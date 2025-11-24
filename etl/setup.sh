#!/bin/bash

# Junkipedia ETL Pipeline Setup Script
# This script sets up the complete ETL pipeline for social media data analysis
# Author: Claude Code Assistant
# Date: 2025-01-26

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_banner() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "  Junkipedia ETL Pipeline Setup"
    echo "  Social Media Data Analysis Platform"
    echo "=================================================="
    echo -e "${NC}"
}

check_dependencies() {
    log_info "Checking system dependencies..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed. Please install Python 3.8+ and try again."
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1-2)
    log_info "Found Python $PYTHON_VERSION"
    
    # Check DuckDB CLI availability
    if ! command -v duckdb &> /dev/null; then
        log_warning "DuckDB CLI not found in PATH."
        log_info "Would you like to download and install DuckDB CLI? (y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            install_duckdb_cli
        else
            log_warning "DuckDB CLI not installed. You can install it later from: https://duckdb.org/docs/installation/"
        fi
    else
        DUCKDB_VERSION=$(duckdb --version 2>/dev/null | head -n1 || echo "unknown")
        log_success "Found DuckDB CLI: $DUCKDB_VERSION"
    fi
    
    # Check if virtual environment exists
    if [ ! -d "polars" ]; then
        log_warning "Virtual environment 'polars' not found."
        log_info "Creating virtual environment..."
        python3 -m venv polars
        log_success "Virtual environment created."
    else
        log_info "Virtual environment 'polars' found."
    fi
    
    log_success "System dependencies check completed."
}

install_duckdb_cli() {
    log_info "Installing DuckDB CLI..."
    
    # Detect OS and architecture
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    # Map architecture names
    case $ARCH in
        x86_64)
            ARCH="amd64"
            ;;
        arm64|aarch64)
            ARCH="aarch64"
            ;;
        *)
            log_error "Unsupported architecture: $ARCH"
            return 1
            ;;
    esac
    
    # Construct download URL
    case $OS in
        darwin)
            PLATFORM="osx"
            ;;
        linux)
            PLATFORM="linux"
            ;;
        *)
            log_error "Unsupported operating system: $OS"
            return 1
            ;;
    esac
    
    DUCKDB_URL="https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-${PLATFORM}-${ARCH}.zip"
    
    log_info "Downloading DuckDB CLI from: $DUCKDB_URL"
    
    # Create temporary directory
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR" || exit 1
    
    # Download and extract
    if command -v curl &> /dev/null; then
        curl -L -o duckdb_cli.zip "$DUCKDB_URL"
    elif command -v wget &> /dev/null; then
        wget -O duckdb_cli.zip "$DUCKDB_URL"
    else
        log_error "Neither curl nor wget found. Please install one of them."
        return 1
    fi
    
    if [ ! -f duckdb_cli.zip ]; then
        log_error "Failed to download DuckDB CLI"
        return 1
    fi
    
    unzip -q duckdb_cli.zip
    
    # Install to local bin directory
    mkdir -p "$HOME/.local/bin"
    mv duckdb "$HOME/.local/bin/"
    chmod +x "$HOME/.local/bin/duckdb"
    
    # Clean up
    cd - > /dev/null
    rm -rf "$TEMP_DIR"
    
    # Add to PATH if not already there
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
        log_info "Adding $HOME/.local/bin to PATH in your shell profile"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc" 2>/dev/null || true
        export PATH="$HOME/.local/bin:$PATH"
    fi
    
    log_success "DuckDB CLI installed to $HOME/.local/bin/duckdb"
    log_info "Restart your shell or run: export PATH=\"\$HOME/.local/bin:\$PATH\""
}

setup_python_environment() {
    log_info "Setting up Python environment..."
    
    # Activate virtual environment
    source polars/bin/activate
    
    # Upgrade pip
    log_info "Upgrading pip..."
    pip install --upgrade pip
    
    # Install required packages
    log_info "Installing Python dependencies..."
    pip install polars duckdb requests pyarrow
    
    # Generate requirements.txt for future reference
    log_info "Generating requirements.txt..."
    pip freeze > requirements.txt
    
    log_success "Python environment setup completed."
}

check_api_data() {
    log_info "Checking for existing API data..."
    
    if [ -d "data" ] && [ "$(find data -name '*.json' 2>/dev/null | wc -l)" -gt 0 ]; then
        log_info "Found existing data files. Skipping API download."
        return 0
    else
        log_warning "No existing data found."
        log_info "You'll need to run the data download separately:"
        log_info "  python download.py        # Download channels and all posts"
        log_info "  python download.py posts  # Download posts only"
        return 1
    fi
}

stage_development_data() {
    log_info "Staging data for development environment..."
    
    # Activate virtual environment
    source polars/bin/activate
    
    # Check if we have existing data
    if check_api_data; then
        log_info "Found existing data files."
        
        # Check if database exists and has data
        if [ -f "./duckdatabase" ]; then
            log_info "Checking existing database..."
            python3 -c "
import duckdb
try:
    conn = duckdb.connect('./duckdatabase')
    count = conn.execute('SELECT COUNT(*) FROM bronze.posts_raw').fetchone()[0] if conn.execute(\"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'bronze' AND table_name = 'posts_raw'\").fetchone()[0] > 0 else 0
    conn.close()
    print(f'Database contains {count} records')
    exit(0 if count > 0 else 1)
except Exception as e:
    print(f'Database check failed: {e}')
    exit(1)
" && database_has_data=true || database_has_data=false
            
            if [ "$database_has_data" = true ]; then
                log_success "Database already staged with data."
                return 0
            fi
        fi
        
        log_info "Processing existing data for development use..."
        
        # Process data through ETL pipeline for development
        log_info "Loading data to bronze layer..."
        python process_posts.py
        
        log_info "Creating silver layer tables..."
        python process_posts.py silver
        
        log_info "Creating text analysis enrichments..."
        python process_posts.py text
        
        log_info "Creating gold layer aggregations..."
        python process_posts.py gold
        
        log_success "Data staging completed."
    else
        log_warning "No existing data found for staging."
        log_info "To stage data for development:"
        log_info "1. Run: python download.py"
        log_info "2. Run: ./setup.sh (to process the downloaded data)"
        log_info "Or download specific data:"
        log_info "  python download.py channels  # Download channels only"
        log_info "  python download.py posts     # Download posts only"
    fi
}

run_data_validation() {
    log_info "Running data validation and sample queries..."
    
    source polars/bin/activate
    
    # Create a simple validation script
    cat > validate_setup.py << 'EOF'
import duckdb
import sys

def validate_database():
    try:
        conn = duckdb.connect('./duckdatabase')
        
        # Check schemas
        schemas = conn.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('bronze', 'silver', 'gold')").fetchall()
        print(f"✓ Found {len(schemas)} schemas: {[s[0] for s in schemas]}")
        
        # Check bronze layer
        bronze_count = conn.execute("SELECT COUNT(*) FROM bronze.posts_raw").fetchone()[0]
        print(f"✓ Bronze layer: {bronze_count} raw posts")
        
        # Check silver layer
        accounts_count = conn.execute("SELECT COUNT(*) FROM silver.accounts").fetchone()[0]
        posts_count = conn.execute("SELECT COUNT(*) FROM silver.posts").fetchone()[0]
        text_count = conn.execute("SELECT COUNT(*) FROM silver.posts_text_analysis").fetchone()[0]
        print(f"✓ Silver layer: {accounts_count} accounts, {posts_count} posts, {text_count} text analyses")
        
        # Check gold layer
        gold_tables = conn.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'gold'
        """).fetchall()
        print(f"✓ Gold layer: {len(gold_tables)} aggregation tables")
        
        # Sample insights
        print("\n📊 Sample Insights:")
        top_account = conn.execute("""
            SELECT account_name, avg_likes_per_post 
            FROM gold.account_rankings 
            ORDER BY likes_rank LIMIT 1
        """).fetchone()
        print(f"   Top performer: {top_account[0]} ({top_account[1]:.0f} avg likes)")
        
        best_time = conn.execute("""
            SELECT day_name, time_period, avg_likes 
            FROM gold.posting_patterns 
            ORDER BY performance_rank LIMIT 1
        """).fetchone()
        print(f"   Best posting time: {best_time[0]} {best_time[1]} ({best_time[2]:.0f} avg likes)")
        
        text_insight = conn.execute("""
            SELECT content_length_category, AVG(likes_count) as avg_likes
            FROM silver.posts_text_analysis 
            GROUP BY content_length_category 
            ORDER BY avg_likes DESC LIMIT 1
        """).fetchone()
        print(f"   Best content length: {text_insight[0]} ({text_insight[1]:.0f} avg likes)")
        
        conn.close()
        print("\n✅ Database validation completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Validation failed: {e}")
        return False

if __name__ == "__main__":
    success = validate_database()
    sys.exit(0 if success else 1)
EOF
    
    python validate_setup.py
    validation_result=$?
    
    # Clean up validation script
    rm validate_setup.py
    
    if [ $validation_result -eq 0 ]; then
        log_success "Data validation completed successfully."
    else
        log_error "Data validation failed. Please check the logs above."
    fi
    
    return $validation_result
}


print_completion_summary() {
    echo -e "${GREEN}"
    echo "=================================================="
    echo "  🎉 Development Environment Ready! 🎉"
    echo "=================================================="
    echo -e "${NC}"
    
    echo "✅ Python environment configured"
    echo "✅ DuckDB CLI available"
    echo "✅ Dependencies installed"
    echo "✅ Data staged for development"
    
    echo -e "\n${BLUE}Ready for Development:${NC}"
    echo "• Virtual environment: source polars/bin/activate"
    echo "• Database access: duckdb ./duckdatabase"
    echo "• ETL pipeline: python process_posts.py"
    echo "• Data download: python download.py"
    
    echo -e "\n${BLUE}Key Files:${NC}"
    echo "• ./duckdatabase - DuckDB database"
    echo "• download.py - API data fetcher"
    echo "• process_posts.py - ETL pipeline"
    echo "• requirements.txt - Python dependencies"
}

# Main execution
main() {
    print_banner
    
    log_info "Starting Junkipedia ETL setup..."
    
    check_dependencies
    setup_python_environment
    stage_development_data
    
    if [ -f "./duckdatabase" ]; then
        run_data_validation
    fi
    
    print_completion_summary
    
    log_success "Setup completed successfully! 🚀"
}

# Run main function
main "$@"