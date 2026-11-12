// Python source for each workflow step type. The returned strings are spliced
// into the generated activity bodies, so their whitespace is load-bearing.

import type { WorkflowStep } from './pythonDaprWorkflowTypes';

/**
 * Generate specific Python implementations for different step types
 */
export function generatePythonStepImplementation(step: WorkflowStep): string {
    switch (step.type) {
      case 'text_preprocessing':
        return `# Text preprocessing implementation
        if workflow_df is None or 'text' not in workflow_df.columns:
            raise ValueError("No text data available for preprocessing")
        
        # Clean and preprocess text
        processed_texts = []
        for text in workflow_df['text']:
            # Convert to lowercase
            clean_text = str(text).lower()
            # Remove punctuation and extra whitespace
            clean_text = ''.join(c for c in clean_text if c.isalnum() or c.isspace())
            clean_text = ' '.join(clean_text.split())
            processed_texts.append(clean_text)
        
        workflow_df['processed_text'] = processed_texts
        
        result = {
            'success': True,
            'processed_count': len(processed_texts),
            'method': 'text_preprocessing',
            'sample_processed': processed_texts[:3] if processed_texts else []
        }
        
        logger.info(f"Preprocessed {len(processed_texts)} text entries")`;

      case 'sentiment_analysis':
        return `# Sentiment analysis implementation
        if workflow_df is None:
            raise ValueError("No data available for sentiment analysis")
            
        text_column = 'processed_text' if 'processed_text' in workflow_df.columns else 'text'
        
        sentiments = []
        polarities = []
        subjectivities = []
        
        for text in workflow_df[text_column]:
            blob = TextBlob(str(text))
            sentiment = blob.sentiment
            
            # Classify sentiment
            if sentiment.polarity > 0.1:
                sentiment_label = 'positive'
            elif sentiment.polarity < -0.1:
                sentiment_label = 'negative'
            else:
                sentiment_label = 'neutral'
            
            sentiments.append(sentiment_label)
            polarities.append(sentiment.polarity)
            subjectivities.append(sentiment.subjectivity)
        
        workflow_df['sentiment'] = sentiments
        workflow_df['polarity'] = polarities
        workflow_df['subjectivity'] = subjectivities
        
        # Calculate summary statistics
        positive_count = sum(1 for s in sentiments if s == 'positive')
        negative_count = sum(1 for s in sentiments if s == 'negative')
        neutral_count = sum(1 for s in sentiments if s == 'neutral')
        avg_polarity = np.mean(polarities)
        
        result = {
            'success': True,
            'analyzed_count': len(sentiments),
            'positive_count': positive_count,
            'negative_count': negative_count,
            'neutral_count': neutral_count,
            'average_polarity': float(avg_polarity),
            'method': 'textblob_sentiment'
        }
        
        logger.info(f"Analyzed sentiment for {len(sentiments)} entries")`;

      case 'topic_modeling':
        return `# Topic modeling implementation using TF-IDF + KMeans
        if workflow_df is None:
            raise ValueError("No data available for topic modeling")
        
        text_column = 'processed_text' if 'processed_text' in workflow_df.columns else 'text'
        texts = [str(text) for text in workflow_df[text_column]]
        
        # TF-IDF Vectorization
        vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        
        tfidf_matrix = vectorizer.fit_transform(texts)
        feature_names = vectorizer.get_feature_names_out()
        
        # K-Means clustering for topic discovery
        n_topics = min(5, len(texts) // 2)  # Dynamic topic count
        if n_topics < 2:
            n_topics = 2
            
        kmeans = KMeans(n_clusters=n_topics, random_state=42, n_init=10)
        topic_assignments = kmeans.fit_predict(tfidf_matrix)
        
        # Extract top keywords for each topic
        topics = {}
        for i in range(n_topics):
            # Get top features for this cluster center
            center = kmeans.cluster_centers_[i]
            top_indices = center.argsort()[-10:][::-1]  # Top 10 keywords
            top_keywords = [feature_names[idx] for idx in top_indices]
            topics[f'topic_{i}'] = top_keywords
        
        workflow_df['topic'] = topic_assignments
        
        result = {
            'success': True,
            'topics_discovered': n_topics,
            'topics': topics,
            'documents_processed': len(texts),
            'method': 'tfidf_kmeans'
        }
        
        logger.info(f"Discovered {n_topics} topics from {len(texts)} documents")`;

      case 'clustering':
        return `# Data clustering implementation
        if workflow_df is None:
            raise ValueError("No data available for clustering")
        
        # Prepare numerical features for clustering
        numerical_columns = workflow_df.select_dtypes(include=[np.number]).columns
        
        if len(numerical_columns) == 0:
            # If no numerical columns, use TF-IDF on text
            text_column = 'processed_text' if 'processed_text' in workflow_df.columns else 'text'
            if text_column in workflow_df.columns:
                vectorizer = TfidfVectorizer(max_features=100, stop_words='english')
                feature_matrix = vectorizer.fit_transform(
                    [str(text) for text in workflow_df[text_column]]
                ).toarray()
            else:
                raise ValueError("No numerical or text features available for clustering")
        else:
            feature_matrix = workflow_df[numerical_columns].fillna(0).values
        
        # Standardize features
        scaler = StandardScaler()
        scaled_features = scaler.fit_transform(feature_matrix)
        
        # Perform K-Means clustering
        n_clusters = min(5, len(scaled_features) // 3)
        if n_clusters < 2:
            n_clusters = 2
            
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(scaled_features)
        
        workflow_df['cluster'] = cluster_labels
        
        # Calculate cluster statistics
        cluster_counts = np.bincount(cluster_labels)
        
        result = {
            'success': True,
            'clusters_formed': n_clusters,
            'cluster_counts': cluster_counts.tolist(),
            'features_used': len(scaled_features[0]) if len(scaled_features) > 0 else 0,
            'data_points_clustered': len(cluster_labels),
            'method': 'kmeans_clustering'
        }
        
        logger.info(f"Formed {n_clusters} clusters from {len(cluster_labels)} data points")`;

      case 'remove_duplicates':
        return `# Remove duplicates implementation using Polars
        if workflow_df is None:
            raise ValueError("No data available for duplicate removal")
        
        # Convert pandas DataFrame to Polars if needed
        import polars as pl
        original_count = len(workflow_df)
        
        # Convert to Polars DataFrame for efficient duplicate handling
        if hasattr(workflow_df, 'to_dict'):
            # If it's a pandas DataFrame
            polars_df = pl.DataFrame(workflow_df.to_dict(orient='list'))
        else:
            # Assume it's already a Polars DataFrame
            polars_df = workflow_df
        
        # Get configuration from step config
        columns_config = '${JSON.stringify(step.config.columns || [])}'
        keep_strategy = '${step.config.keep || 'first'}'
        
        # Parse columns configuration
        import json
        columns_to_check = json.loads(columns_config) if columns_config != '[]' else None
        
        if columns_to_check and len(columns_to_check) > 0:
            # Remove duplicates based on specified columns
            if keep_strategy == 'first':
                deduplicated_df = polars_df.unique(subset=columns_to_check, keep='first')
            elif keep_strategy == 'last':
                deduplicated_df = polars_df.unique(subset=columns_to_check, keep='last')
            else:
                # Remove all duplicates (keep='none' equivalent)
                deduplicated_df = polars_df.unique(subset=columns_to_check, keep='first')
        else:
            # Remove duplicates across all columns
            if keep_strategy == 'first':
                deduplicated_df = polars_df.unique(keep='first')
            elif keep_strategy == 'last':
                deduplicated_df = polars_df.unique(keep='last')
            else:
                deduplicated_df = polars_df.unique(keep='first')
        
        # Convert back to pandas DataFrame for compatibility with other steps
        workflow_df = deduplicated_df.to_pandas()
        
        final_count = len(workflow_df)
        duplicates_removed = original_count - final_count
        
        result = {
            'success': True,
            'original_count': original_count,
            'final_count': final_count,
            'duplicates_removed': duplicates_removed,
            'columns_checked': columns_to_check or 'all_columns',
            'keep_strategy': keep_strategy,
            'duplicate_percentage': round((duplicates_removed / original_count) * 100, 2) if original_count > 0 else 0,
            'method': 'polars_unique'
        }
        
        logger.info(f"Removed {duplicates_removed} duplicates ({result['duplicate_percentage']}%) from {original_count} records")`;

      default:
        return `# Generic step implementation
        logger.info(f"Executing generic step: ${step.type}")
        
        result = {
            'success': True,
            'step_type': '${step.type}',
            'executed': True,
            'timestamp': datetime.now().isoformat(),
            'data_shape': list(workflow_df.shape) if workflow_df is not None else [0, 0]
        }
        
        logger.info(f"Completed generic step: ${step.type}")`;
    }
}
