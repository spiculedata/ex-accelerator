-- Topic Modeling Database Schema
-- Comprehensive topic modeling and document clustering analysis
-- This schema supports AI-powered topic extraction and analysis

-- Core topic modeling data
CREATE TABLE IF NOT EXISTS topic_documents (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    title VARCHAR(500),
    source VARCHAR(100), -- document source/platform
    timestamp BIGINT NOT NULL,
    document_id VARCHAR(200), -- Source-specific document ID
    author VARCHAR(200), -- Document author
    engagement_score DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Topic definitions and metadata
CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY,
    topic_id VARCHAR(100) NOT NULL UNIQUE, -- Human-readable topic ID
    name VARCHAR(300) NOT NULL,
    category VARCHAR(100) NOT NULL,
    category_color VARCHAR(20) DEFAULT '#3b82f6',
    size INTEGER NOT NULL DEFAULT 0, -- Number of documents in topic
    weight DECIMAL(5,3) NOT NULL DEFAULT 0, -- Topic weight/importance
    coherence_score DECIMAL(4,3), -- Topic coherence measure
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Topic keywords and their weights
CREATE TABLE IF NOT EXISTS topic_keywords (
    id INTEGER PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    keyword VARCHAR(200) NOT NULL,
    weight DECIMAL(6,4) NOT NULL, -- Keyword weight in topic
    rank_position INTEGER NOT NULL, -- Rank of keyword in topic
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document-topic assignments (many-to-many)
CREATE TABLE IF NOT EXISTS document_topics (
    id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES topic_documents(id),
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    probability DECIMAL(6,4) NOT NULL, -- Document belongs to topic with this probability
    is_primary BOOLEAN DEFAULT FALSE, -- Whether this is the primary topic for the document
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, topic_id)
);

-- Topic relationships and clustering
CREATE TABLE IF NOT EXISTS topic_relationships (
    id INTEGER PRIMARY KEY,
    topic1_id INTEGER NOT NULL REFERENCES topics(id),
    topic2_id INTEGER NOT NULL REFERENCES topics(id),
    similarity_score DECIMAL(5,4) NOT NULL, -- Similarity between topics
    relationship_type VARCHAR(50) NOT NULL, -- SIMILAR, HIERARCHICAL, OVERLAPPING
    strength DECIMAL(3,2) NOT NULL, -- Relationship strength 0-1
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(topic1_id, topic2_id)
);

-- Topic evolution over time
CREATE TABLE IF NOT EXISTS topic_trends (
    id INTEGER PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    analysis_date DATE NOT NULL,
    document_count INTEGER NOT NULL,
    average_engagement DECIMAL(5,2),
    growth_rate DECIMAL(6,3), -- Growth rate compared to previous period
    trend_direction VARCHAR(20), -- RISING, FALLING, STABLE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(topic_id, analysis_date)
);

-- Topic modeling model metadata
CREATE TABLE IF NOT EXISTS modeling_runs (
    id INTEGER PRIMARY KEY,
    run_id VARCHAR(100) NOT NULL UNIQUE,
    algorithm VARCHAR(50) NOT NULL, -- LDA, NMF, BERTopic, etc.
    num_topics INTEGER NOT NULL,
    perplexity DECIMAL(8,4), -- Model perplexity score
    coherence DECIMAL(5,4), -- Overall model coherence
    parameters TEXT, -- JSON of model parameters
    status VARCHAR(20) DEFAULT 'COMPLETED',
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data for topic modeling

-- Insert sample documents
INSERT INTO topic_documents (id, text, title, source, timestamp, document_id, author, engagement_score) VALUES
(1, 'Artificial intelligence and machine learning are revolutionizing how we approach data analysis and predictive modeling in business contexts.', 'AI Revolution in Business', 'tech_blog', 1706363520000, 'tb_001', 'Tech Analyst', 87.5),
(2, 'Mental health awareness has become increasingly important, especially in workplace environments where stress and burnout are common concerns.', 'Mental Health in the Workplace', 'health_news', 1706359700000, 'hn_001', 'Health Reporter', 92.3),
(3, 'Climate change impacts are becoming more visible through extreme weather events and changing environmental patterns worldwide.', 'Climate Change Reality', 'environment_today', 1706358100000, 'et_001', 'Environmental Scientist', 78.9),
(4, 'Cybersecurity threats are evolving rapidly with new attack vectors targeting cloud infrastructure and remote work environments.', 'Cybersecurity Challenges 2025', 'security_weekly', 1706354400000, 'sw_001', 'Security Expert', 85.2),
(5, 'Sustainable energy solutions including solar and wind power are becoming more cost-effective alternatives to traditional fossil fuels.', 'Renewable Energy Progress', 'energy_review', 1706352280000, 'er_001', 'Energy Analyst', 81.7),
(6, 'Educational technology is transforming learning experiences through personalized AI tutors and interactive digital platforms.', 'EdTech Innovation', 'education_focus', 1706349600000, 'ef_001', 'Education Researcher', 76.4),
(7, 'Financial technology innovations are democratizing access to banking services and investment opportunities for underserved populations.', 'FinTech Inclusion', 'fintech_insights', 1706346900000, 'fi_001', 'Finance Writer', 88.1),
(8, 'Healthcare innovation through telemedicine and AI diagnostics is improving patient outcomes and accessibility to medical care.', 'Healthcare Digital Transformation', 'medical_journal', 1706344800000, 'mj_001', 'Medical Professional', 94.6),
(9, 'Urban planning strategies are incorporating smart city technologies to improve traffic flow and reduce environmental impact.', 'Smart Cities Development', 'urban_planning', 1706342400000, 'up_001', 'Urban Planner', 73.8),
(10, 'Blockchain technology applications extend beyond cryptocurrency to supply chain management and digital identity verification.', 'Blockchain Beyond Crypto', 'tech_trends', 1706340000000, 'tt_001', 'Technology Writer', 82.5);

-- Insert topics
INSERT INTO topics (id, topic_id, name, category, category_color, size, weight, coherence_score) VALUES
(1, 'tech-ai', 'Artificial Intelligence', 'Technology', '#3b82f6', 847, 0.245, 0.892),
(2, 'health-mental', 'Mental Health Awareness', 'Health', '#ef4444', 723, 0.201, 0.867),
(3, 'env-climate', 'Climate Change Impact', 'Environment', '#10b981', 656, 0.189, 0.834),
(4, 'tech-cyber', 'Cybersecurity Threats', 'Technology', '#3b82f6', 567, 0.165, 0.798),
(5, 'env-energy', 'Sustainable Energy', 'Environment', '#10b981', 534, 0.145, 0.812),
(6, 'edu-tech', 'Educational Technology', 'Education', '#f59e0b', 467, 0.123, 0.756),
(7, 'fin-tech', 'Financial Technology', 'Finance', '#8b5cf6', 423, 0.111, 0.743),
(8, 'health-innovation', 'Healthcare Innovation', 'Health', '#ef4444', 398, 0.098, 0.721),
(9, 'urban-smart', 'Smart Cities', 'Urban Planning', '#06b6d4', 356, 0.089, 0.687),
(10, 'tech-blockchain', 'Blockchain Technology', 'Technology', '#3b82f6', 334, 0.078, 0.672);

-- Insert topic keywords
INSERT INTO topic_keywords (id, topic_id, keyword, weight, rank_position) VALUES
-- AI topic keywords
(1, 1, 'artificial intelligence', 0.2845, 1),
(2, 1, 'machine learning', 0.2134, 2),
(3, 1, 'neural networks', 0.1876, 3),
(4, 1, 'deep learning', 0.1543, 4),
(5, 1, 'algorithms', 0.1345, 5),
-- Mental Health keywords
(6, 2, 'mental health', 0.3012, 1),
(7, 2, 'depression', 0.2456, 2),
(8, 2, 'anxiety', 0.2134, 3),
(9, 2, 'therapy', 0.1789, 4),
(10, 2, 'counseling', 0.1456, 5),
-- Climate Change keywords
(11, 3, 'climate change', 0.2987, 1),
(12, 3, 'global warming', 0.2234, 2),
(13, 3, 'emissions', 0.1998, 3),
(14, 3, 'environmental impact', 0.1656, 4),
(15, 3, 'sustainability', 0.1423, 5),
-- Cybersecurity keywords
(16, 4, 'cybersecurity', 0.2765, 1),
(17, 4, 'data breach', 0.2345, 2),
(18, 4, 'malware', 0.1987, 3),
(19, 4, 'phishing', 0.1678, 4),
(20, 4, 'ransomware', 0.1456, 5);

-- Insert document-topic assignments
INSERT INTO document_topics (id, document_id, topic_id, probability, is_primary) VALUES
(1, 1, 1, 0.8945, TRUE),  -- AI document -> AI topic
(2, 1, 7, 0.1055, FALSE), -- AI document -> FinTech topic (secondary)
(3, 2, 2, 0.9234, TRUE),  -- Mental health document -> Mental health topic
(4, 3, 3, 0.8765, TRUE),  -- Climate document -> Climate topic
(5, 3, 5, 0.1235, FALSE), -- Climate document -> Energy topic (secondary)
(6, 4, 4, 0.9123, TRUE),  -- Cybersecurity document -> Cybersecurity topic
(7, 5, 5, 0.8876, TRUE),  -- Energy document -> Energy topic
(8, 5, 3, 0.1124, FALSE), -- Energy document -> Climate topic (secondary)
(9, 6, 6, 0.8654, TRUE),  -- EdTech document -> EdTech topic
(10, 7, 7, 0.8987, TRUE), -- FinTech document -> FinTech topic
(11, 8, 8, 0.9345, TRUE), -- Healthcare document -> Healthcare topic
(12, 9, 9, 0.8234, TRUE), -- Smart Cities document -> Smart Cities topic
(13, 10, 10, 0.8567, TRUE); -- Blockchain document -> Blockchain topic

-- Insert topic relationships
INSERT INTO topic_relationships (id, topic1_id, topic2_id, similarity_score, relationship_type, strength) VALUES
(1, 1, 7, 0.7234, 'SIMILAR', 0.72), -- AI and FinTech
(2, 3, 5, 0.8456, 'HIERARCHICAL', 0.85), -- Climate and Energy
(3, 2, 8, 0.6789, 'SIMILAR', 0.68), -- Mental Health and Healthcare
(4, 1, 4, 0.5432, 'OVERLAPPING', 0.54), -- AI and Cybersecurity
(5, 6, 8, 0.5876, 'SIMILAR', 0.59), -- EdTech and Healthcare Innovation
(6, 9, 1, 0.6123, 'OVERLAPPING', 0.61), -- Smart Cities and AI
(7, 10, 7, 0.7345, 'SIMILAR', 0.73), -- Blockchain and FinTech
(8, 4, 10, 0.4987, 'OVERLAPPING', 0.50); -- Cybersecurity and Blockchain

-- Insert topic trends (last 30 days)
INSERT INTO topic_trends (id, topic_id, analysis_date, document_count, average_engagement, growth_rate, trend_direction) VALUES
-- AI topic trends
(1, 1, '2025-01-27', 45, 85.2, 12.5, 'RISING'),
(2, 1, '2025-01-26', 42, 83.7, 8.3, 'RISING'),
(3, 1, '2025-01-25', 38, 82.1, 5.2, 'RISING'),
-- Mental Health trends
(4, 2, '2025-01-27', 38, 91.4, 3.2, 'STABLE'),
(5, 2, '2025-01-26', 37, 90.8, 2.1, 'STABLE'),
(6, 2, '2025-01-25', 36, 89.9, 1.8, 'STABLE'),
-- Climate Change trends
(7, 3, '2025-01-27', 32, 78.6, -2.1, 'FALLING'),
(8, 3, '2025-01-26', 34, 79.2, -1.8, 'FALLING'),
(9, 3, '2025-01-25', 35, 80.1, -0.9, 'STABLE'),
-- Cybersecurity trends
(10, 4, '2025-01-27', 28, 84.3, 15.8, 'RISING'),
(11, 4, '2025-01-26', 24, 82.7, 12.4, 'RISING'),
(12, 4, '2025-01-25', 21, 81.2, 9.1, 'RISING');

-- Insert modeling run metadata
INSERT INTO modeling_runs (id, run_id, algorithm, num_topics, perplexity, coherence, parameters, status, started_at, completed_at) VALUES
(1, 'run_20250127_001', 'LDA', 10, 45.234, 0.758, '{"alpha": 0.1, "beta": 0.01, "iterations": 1000}', 'COMPLETED', '2025-01-27 08:00:00', '2025-01-27 08:45:00'),
(2, 'run_20250126_001', 'BERTopic', 15, NULL, 0.823, '{"min_topic_size": 10, "nr_topics": 15}', 'COMPLETED', '2025-01-26 10:00:00', '2025-01-26 11:20:00'),
(3, 'run_20250125_001', 'NMF', 12, NULL, 0.692, '{"n_components": 12, "max_iter": 200}', 'COMPLETED', '2025-01-25 14:00:00', '2025-01-25 14:30:00');

-- Analytical Views for Topic Modeling

-- Topic overview with statistics
CREATE VIEW IF NOT EXISTS topic_overview AS
SELECT 
    t.topic_id,
    t.name,
    t.category,
    t.category_color,
    t.size,
    t.weight,
    t.coherence_score,
    GROUP_CONCAT(tk.keyword ORDER BY tk.rank_position) as keywords,
    COUNT(DISTINCT dt.document_id) as document_count,
    AVG(td.engagement_score) as avg_engagement
FROM topics t
LEFT JOIN topic_keywords tk ON t.id = tk.topic_id AND tk.rank_position <= 5
LEFT JOIN document_topics dt ON t.id = dt.topic_id
LEFT JOIN topic_documents td ON dt.document_id = td.id
GROUP BY t.id, t.topic_id, t.name, t.category, t.category_color, t.size, t.weight, t.coherence_score
ORDER BY t.weight DESC;

-- Topic categories summary
CREATE VIEW IF NOT EXISTS topic_categories AS
SELECT 
    category,
    category_color,
    COUNT(*) as topic_count,
    SUM(size) as total_documents,
    AVG(weight) as avg_weight,
    AVG(coherence_score) as avg_coherence
FROM topics
GROUP BY category, category_color
ORDER BY total_documents DESC;

-- Topic relationships with names
CREATE VIEW IF NOT EXISTS topic_relationships_view AS
SELECT 
    tr.id,
    t1.topic_id as topic1_id,
    t1.name as topic1_name,
    t2.topic_id as topic2_id,
    t2.name as topic2_name,
    tr.similarity_score,
    tr.relationship_type,
    tr.strength
FROM topic_relationships tr
JOIN topics t1 ON tr.topic1_id = t1.id
JOIN topics t2 ON tr.topic2_id = t2.id
ORDER BY tr.similarity_score DESC;

-- Document-topic assignments with details
CREATE VIEW IF NOT EXISTS document_topic_assignments AS
SELECT 
    td.id as document_id,
    td.title,
    td.source,
    td.author,
    td.engagement_score,
    t.topic_id,
    t.name as topic_name,
    t.category,
    dt.probability,
    dt.is_primary
FROM topic_documents td
JOIN document_topics dt ON td.id = dt.document_id
JOIN topics t ON dt.topic_id = t.id
ORDER BY td.id, dt.probability DESC;

-- Topic trends with growth analysis
CREATE VIEW IF NOT EXISTS topic_trends_analysis AS
SELECT 
    t.topic_id,
    t.name,
    t.category,
    tt.analysis_date,
    tt.document_count,
    tt.average_engagement,
    tt.growth_rate,
    tt.trend_direction,
    LAG(tt.document_count) OVER (PARTITION BY t.id ORDER BY tt.analysis_date) as prev_count,
    LAG(tt.average_engagement) OVER (PARTITION BY t.id ORDER BY tt.analysis_date) as prev_engagement
FROM topics t
JOIN topic_trends tt ON t.id = tt.topic_id
ORDER BY t.topic_id, tt.analysis_date DESC;

-- Topic keyword analysis
CREATE VIEW IF NOT EXISTS topic_keywords_analysis AS
SELECT 
    t.topic_id,
    t.name as topic_name,
    t.category,
    tk.keyword,
    tk.weight,
    tk.rank_position,
    t.size as topic_size,
    t.coherence_score
FROM topics t
JOIN topic_keywords tk ON t.id = tk.topic_id
ORDER BY t.topic_id, tk.rank_position;