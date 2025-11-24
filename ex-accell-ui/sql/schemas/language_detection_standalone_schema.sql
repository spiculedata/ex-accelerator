-- Standalone Language Detection Schema for DuckDB
-- Self-contained schema that doesn't depend on external tables

-- Drop existing tables if they exist to avoid conflicts
DROP TABLE IF EXISTS language_detection;
DROP TABLE IF EXISTS language_candidates;
DROP TABLE IF EXISTS language_trends;
DROP TABLE IF EXISTS language_mixing;
DROP VIEW IF EXISTS language_overview;
DROP VIEW IF EXISTS language_confidence_analysis;

-- Create language detection table
CREATE TABLE language_detection (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL,
    language_id INTEGER REFERENCES languages(id),
    confidence_score DECIMAL(4,3) NOT NULL, -- 0.000 to 1.000
    detection_model VARCHAR(50) DEFAULT 'langdetect',
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create language candidates table
CREATE TABLE language_candidates (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL,
    language_id INTEGER REFERENCES languages(id),
    confidence_score DECIMAL(4,3) NOT NULL,
    rank INTEGER NOT NULL, -- 1 = primary, 2 = secondary, etc.
    detection_model VARCHAR(50) DEFAULT 'langdetect',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create language trends table
CREATE TABLE language_trends (
    id INTEGER PRIMARY KEY,
    language_id INTEGER REFERENCES languages(id),
    data_source_id INTEGER DEFAULT 1,
    analysis_date DATE NOT NULL,
    post_count INTEGER DEFAULT 0,
    avg_confidence DECIMAL(4,3),
    total_characters INTEGER DEFAULT 0,
    total_words INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create language mixing table
CREATE TABLE language_mixing (
    id INTEGER PRIMARY KEY,
    post_id INTEGER NOT NULL,
    primary_language_id INTEGER REFERENCES languages(id),
    secondary_language_id INTEGER REFERENCES languages(id),
    mixing_type VARCHAR(20) DEFAULT 'code-switching',
    primary_confidence DECIMAL(4,3),
    secondary_confidence DECIMAL(4,3),
    segment_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample language detection data
INSERT INTO language_detection (id, post_id, language_id, confidence_score, detection_model)
WITH post_sample AS (
    SELECT generate_series as post_id
    FROM generate_series(1, 30000)
),
language_distribution AS (
    SELECT 
        post_id,
        CASE 
            WHEN random() < 0.672 THEN 1  -- English 67.2%
            WHEN random() < 0.805 THEN 2  -- Spanish 13.3%
            WHEN random() < 0.872 THEN 3  -- French 6.7%
            WHEN random() < 0.920 THEN 4  -- German 4.8%
            WHEN random() < 0.952 THEN 5  -- Portuguese 3.2%
            WHEN random() < 0.975 THEN 6  -- Italian 2.3%
            WHEN random() < 0.990 THEN 7  -- Japanese 1.5%
            ELSE 8                        -- Korean 1.0%
        END as language_id,
        (0.30 + random() * 0.70)::DECIMAL(4,3) as confidence_score  -- Confidence between 0.30 and 1.0
    FROM post_sample
)
SELECT 
    row_number() OVER () as id,
    post_id,
    language_id,
    confidence_score,
    'langdetect'
FROM language_distribution;

-- Insert sample language candidates (alternative detections)
INSERT INTO language_candidates (id, post_id, language_id, confidence_score, rank)
WITH uncertain_posts AS (
    SELECT ld.post_id, ld.language_id as primary_lang, ld.confidence_score as primary_conf
    FROM language_detection ld
    WHERE ld.confidence_score < 0.85 -- Only posts with uncertain detection
    AND random() < 0.3 -- 30% of uncertain posts have alternatives
),
secondary_candidates AS (
    SELECT 
        up.post_id,
        CASE 
            WHEN up.primary_lang = 1 THEN 2  -- English -> Spanish
            WHEN up.primary_lang = 2 THEN 1  -- Spanish -> English
            WHEN up.primary_lang = 3 THEN 1  -- French -> English
            WHEN up.primary_lang = 4 THEN 1  -- German -> English
            WHEN up.primary_lang = 5 THEN 2  -- Portuguese -> Spanish
            WHEN up.primary_lang = 6 THEN 3  -- Italian -> French
            ELSE 1                           -- Default to English
        END as language_id,
        (up.primary_conf - 0.10 - random() * 0.20)::DECIMAL(4,3) as confidence_score,
        2 as rank
    FROM uncertain_posts up
)
SELECT 
    row_number() OVER () as id,
    post_id,
    language_id,
    GREATEST(0.100, confidence_score) as confidence_score,
    rank
FROM secondary_candidates;

-- Insert sample language trends (last 30 days)
INSERT INTO language_trends (id, language_id, data_source_id, analysis_date, post_count, avg_confidence, total_characters, total_words)
WITH date_range AS (
    SELECT CURRENT_DATE - INTERVAL (generate_series) DAY as analysis_date
    FROM generate_series(0, 29)
),
language_list AS (
    SELECT id as language_id FROM languages WHERE id <= 8 -- Top 8 languages
),
source_list AS (
    SELECT generate_series as data_source_id
    FROM generate_series(1, 7) -- 7 data sources
)
SELECT 
    row_number() OVER () as id,
    ll.language_id,
    sl.data_source_id,
    dr.analysis_date,
    (CASE ll.language_id
        WHEN 1 THEN 800 + random() * 200  -- English
        WHEN 2 THEN 150 + random() * 50   -- Spanish
        WHEN 3 THEN 75 + random() * 25    -- French
        WHEN 4 THEN 55 + random() * 20    -- German
        WHEN 5 THEN 35 + random() * 15    -- Portuguese
        WHEN 6 THEN 25 + random() * 10    -- Italian
        WHEN 7 THEN 15 + random() * 8     -- Japanese
        ELSE 10 + random() * 5             -- Korean
    END)::INTEGER as post_count,
    (0.75 + random() * 0.20)::DECIMAL(4,3) as avg_confidence,
    (5000 + random() * 2000)::INTEGER as total_characters,
    (800 + random() * 300)::INTEGER as total_words
FROM date_range dr
CROSS JOIN language_list ll
CROSS JOIN source_list sl;

-- Insert sample language mixing data
INSERT INTO language_mixing (id, post_id, primary_language_id, secondary_language_id, mixing_type, primary_confidence, secondary_confidence, segment_count)
WITH mixing_posts AS (
    SELECT 
        (1 + random() * 30000)::INTEGER as post_id,
        CASE 
            WHEN random() < 0.5 THEN 1 ELSE 2 -- English-Spanish mixing most common
        END as primary_language_id,
        CASE 
            WHEN random() < 0.5 THEN 2 ELSE 1 -- Spanish-English mixing
        END as secondary_language_id,
        CASE 
            WHEN random() < 0.7 THEN 'code-switching'
            WHEN random() < 0.9 THEN 'borrowing'
            ELSE 'transliteration'
        END as mixing_type,
        (0.60 + random() * 0.25)::DECIMAL(4,3) as primary_confidence,
        (0.40 + random() * 0.30)::DECIMAL(4,3) as secondary_confidence,
        (2 + random() * 3)::INTEGER as segment_count
    FROM generate_series(1, 500) -- 500 posts with language mixing
)
SELECT 
    row_number() OVER () as id,
    post_id,
    primary_language_id,
    secondary_language_id,
    mixing_type,
    primary_confidence,
    secondary_confidence,
    segment_count
FROM mixing_posts;

-- Create analytical views
CREATE VIEW language_overview AS
SELECT 
    l.code,
    l.name,
    l.native_name,
    COUNT(ld.id) as post_count,
    ROUND(COUNT(ld.id) * 100.0 / (SELECT COUNT(*) FROM language_detection), 2) as percentage,
    AVG(ld.confidence_score) as avg_confidence,
    MIN(ld.confidence_score) as min_confidence,
    MAX(ld.confidence_score) as max_confidence,
    COUNT(CASE WHEN ld.confidence_score >= 0.9 THEN 1 END) as high_confidence_count,
    COUNT(CASE WHEN ld.confidence_score < 0.8 THEN 1 END) as low_confidence_count
FROM languages l
LEFT JOIN language_detection ld ON l.id = ld.language_id
GROUP BY l.id, l.code, l.name, l.native_name
HAVING COUNT(ld.id) > 0
ORDER BY post_count DESC;

-- Create language confidence analysis view
CREATE VIEW language_confidence_analysis AS
SELECT 
    l.name as language_name,
    COUNT(ld.id) as total_detections,
    COUNT(CASE WHEN ld.confidence_score >= 0.95 THEN 1 END) as very_high_confidence,
    COUNT(CASE WHEN ld.confidence_score >= 0.90 AND ld.confidence_score < 0.95 THEN 1 END) as high_confidence,
    COUNT(CASE WHEN ld.confidence_score >= 0.80 AND ld.confidence_score < 0.90 THEN 1 END) as medium_confidence,
    COUNT(CASE WHEN ld.confidence_score < 0.80 THEN 1 END) as low_confidence,
    AVG(ld.confidence_score) as avg_confidence,
    STDDEV(ld.confidence_score) as confidence_stddev
FROM languages l
JOIN language_detection ld ON l.id = ld.language_id
GROUP BY l.id, l.name
ORDER BY total_detections DESC;

-- Create language mixing analysis view
CREATE VIEW language_mixing_analysis AS
SELECT 
    l1.name as primary_language,
    l2.name as secondary_language,
    lm.mixing_type,
    COUNT(*) as occurrence_count,
    AVG(lm.primary_confidence) as avg_primary_confidence,
    AVG(lm.secondary_confidence) as avg_secondary_confidence,
    AVG(lm.segment_count) as avg_segments
FROM language_mixing lm
JOIN languages l1 ON lm.primary_language_id = l1.id
JOIN languages l2 ON lm.secondary_language_id = l2.id
GROUP BY l1.name, l2.name, lm.mixing_type
ORDER BY occurrence_count DESC;

-- Create geographic distribution view
CREATE VIEW language_geographic_distribution AS
SELECT 
    l.name as language_name,
    lg.country_code,
    lg.region,
    lg.post_count,
    lg.percentage,
    RANK() OVER (PARTITION BY l.id ORDER BY lg.post_count DESC) as country_rank
FROM language_geography lg
JOIN languages l ON lg.language_id = l.id
ORDER BY l.name, lg.post_count DESC;