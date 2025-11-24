#!/usr/bin/env python3
"""
Sample script to demonstrate GDELT data processing capabilities
"""

import duckdb
from pathlib import Path

def query_gdelt_data():
    """Run some sample queries on the processed GDELT data"""
    
    db_path = "./duckdatabase"
    if not Path(db_path).exists():
        print("Database not found. Run gdelt_pipeline.py first.")
        return
    
    conn = duckdb.connect(db_path)
    
    print("GDELT Data Analysis Sample")
    print("=" * 50)
    
    # Table counts
    print("\n1. Table Statistics:")
    for table in ['gdelt_events', 'gdelt_mentions', 'gdelt_gkg']:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"   {table}: {count:,} rows")
    
    # Sample events data
    print("\n2. Sample Events (Top 5 by Goldstein Scale):")
    results = conn.execute("""
        SELECT SQLDATE, Actor1Name, Actor2Name, EventCode, GoldsteinScale, SOURCEURL
        FROM gdelt_events 
        WHERE GoldsteinScale IS NOT NULL
        ORDER BY GoldsteinScale DESC 
        LIMIT 5
    """).fetchall()
    
    for row in results:
        date, actor1, actor2, event, goldstein, url = row
        print(f"   {date}: {actor1} -> {actor2} (Event: {event}, Score: {goldstein})")
    
    # Country analysis
    print("\n3. Top Countries by Event Count:")
    results = conn.execute("""
        SELECT ActionGeo_CountryCode, COUNT(*) as event_count
        FROM gdelt_events 
        WHERE ActionGeo_CountryCode IS NOT NULL
        GROUP BY ActionGeo_CountryCode
        ORDER BY event_count DESC
        LIMIT 10
    """).fetchall()
    
    for country, count in results:
        print(f"   {country}: {count} events")
    
    # Sentiment analysis
    print("\n4. Average Tone by Event Type:")
    results = conn.execute("""
        SELECT EventRootCode, AVG(AvgTone) as avg_tone, COUNT(*) as event_count
        FROM gdelt_events 
        WHERE EventRootCode IS NOT NULL AND AvgTone IS NOT NULL
        GROUP BY EventRootCode
        HAVING COUNT(*) > 10
        ORDER BY avg_tone DESC
        LIMIT 10
    """).fetchall()
    
    for event_type, tone, count in results:
        print(f"   {event_type}: {tone:.2f} (n={count})")
    
    conn.close()
    print("\nAnalysis complete!")

if __name__ == "__main__":
    query_gdelt_data()