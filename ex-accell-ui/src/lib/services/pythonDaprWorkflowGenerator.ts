// Python-based Dapr Workflow Generator
// Generates Python scripts for data processing wrapped in Dapr workflow activities

import { writeFile, mkdir, access, readFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { GeneratedWorkflow } from './daprWorkflowGenerator';

const execAsync = promisify(exec);

interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  description: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
  connections: any[];
}

export interface PythonDaprWorkflow extends GeneratedWorkflow {
  pythonScript: string;
  requirements: string;
  virtualEnvPath: string;
  activationScript: string;
}

export class PythonDaprWorkflowGenerator {
  private workflowsDir = join(process.cwd(), 'python-workflows');
  private venvDir = join(process.cwd(), 'workflow-venvs');

  /**
   * Generate complete Python Dapr workflow using pure Python SDK
   */
  async generatePythonDaprWorkflow(workflow: WorkflowDefinition): Promise<PythonDaprWorkflow> {
    const workflowName = this.generateWorkflowName(workflow);
    const workflowId = `${workflowName}_${Date.now()}`;
    
    // Generate pure Python Dapr workflow script
    const pythonScript = this.generatePythonWorkflowScript(workflow);
    
    // Generate requirements.txt for dependencies (including Dapr SDK)
    const requirements = this.generateRequirements(workflow);
    
    const virtualEnvPath = join(this.venvDir, workflowId);
    const activationScript = this.generateVenvActivationScript(virtualEnvPath);
    
    return {
      workflowName,
      workflowCode: '',  // No longer using Node.js workflow code
      activityCode: '',  // No longer using Node.js activity code
      appCode: '',       // No longer using Node.js app code
      workflowPattern: 'pure-python-dapr-sdk',
      executionOrder: this.calculateExecutionOrder(workflow),
      pythonScript,
      requirements,
      virtualEnvPath,
      activationScript
    };
  }

  /**
   * Deploy pure Python Dapr workflow with virtual environment setup
   */
  async deployPythonDaprWorkflow(
    workflowId: string, 
    generatedWorkflow: PythonDaprWorkflow
  ): Promise<string> {
    try {
      // Create directories
      await this.ensureDirectories(workflowId);
      
      // Deploy Python workflow script (contains everything now)
      const pythonScriptPath = await this.deployPythonScript(workflowId, generatedWorkflow.pythonScript);
      
      // Deploy requirements.txt (includes Dapr SDK)
      await this.deployRequirements(workflowId, generatedWorkflow.requirements);
      
      // Create and setup virtual environment with Dapr SDK
      await this.setupVirtualEnvironment(workflowId, generatedWorkflow.virtualEnvPath);
      
      return pythonScriptPath;
      
    } catch (error) {
      throw new Error(`Failed to deploy Python Dapr workflow: ${error.message}`);
    }
  }

  /**
   * Generate Python workflow script using pure Dapr Python SDK
   */
  private generatePythonWorkflowScript(workflow: WorkflowDefinition): string {
    const steps = workflow.steps.filter(step => 
      step.type !== 'dataset_input' && step.type !== 'dataset_output'
    );

    const workflowName = this.generateWorkflowName(workflow);

    return `#!/usr/bin/env python3
"""
Generated Python Dapr Workflow: ${workflow.name}
Description: ${workflow.description}
Generated at: ${new Date().toISOString()}

Pure Python Dapr SDK implementation based on official examples
"""

import asyncio
import json
import sys
import logging
import traceback
from datetime import datetime, timedelta
from typing import Dict, Any, List

# Dapr imports - following official Python SDK examples
from dapr.ext.workflow import (
    WorkflowRuntime,
    DaprWorkflowContext,
    WorkflowActivityContext,
    DaprWorkflowClient,
    RetryPolicy
)

# Data processing imports
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from textblob import TextBlob
import nltk

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global data storage for workflow
workflow_data = {}

# ============================================================================
# WORKFLOW ACTIVITIES
# ============================================================================

def load_data_activity(ctx: WorkflowActivityContext, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """Load data activity"""
    try:
        dataset_id = input_data.get('dataset', 'default')
        logger.info(f"Loading dataset: {dataset_id}")
        
        # TODO: Implement actual data loading from unified database
        # For now, create sample data
        sample_data = pd.DataFrame({
            'text': [
                'This is great!',
                'I love this product',
                'Not very good quality',
                'Amazing service and support',
                'Could be better'
            ] * 20,  # Sample data
            'category': ['electronics', 'books', 'clothing', 'services', 'food'] * 20
        })
        
        # Store data globally (in production, use proper state management)
        workflow_data[ctx.instance_id] = sample_data
        
        logger.info(f"Loaded dataset with {len(sample_data)} records")
        
        return {
            'success': True,
            'records_loaded': len(sample_data),
            'columns': list(sample_data.columns),
            'sample_data': sample_data.head(3).to_dict('records')
        }
        
    except Exception as e:
        logger.error(f"Failed to load data: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

# All activities and workflow are defined within main() using decorators

# ============================================================================
# MAIN WORKFLOW SETUP
# ============================================================================
    """Main workflow function using Dapr Python SDK"""
    try:
        logger.info(f"Starting Dapr workflow: ${workflow.name}")
        logger.info(f"Workflow instance ID: {ctx.instance_id}")
        logger.info(f"Input data: {input_data}")
        
        # Step 1: Load data
        logger.info("Executing activity: load_data")
        load_result = yield ctx.call_activity(load_data_activity, input=input_data)
        
        if not load_result.get('success'):
            raise Exception(f"Failed to load data: {load_result.get('error')}")
        
        results = {'load_data': load_result}
        
        # Execute workflow steps in order
${this.generateDaprWorkflowStepCalls(steps)}
        
        # Generate final results
        final_results = {
            'success': True,
            'workflow_name': '${workflow.name}',
            'instance_id': ctx.instance_id,
            'results': results,
            'processed_records': load_result.get('records_loaded', 0),
            'completed_at': datetime.now().isoformat(),
            'execution_summary': {
                'steps_completed': len(results),
                'workflow_pattern': 'python_dapr_sdk'
            }
        }
        
        logger.info("Workflow execution completed successfully")
        return final_results
        
    except Exception as e:
        logger.error(f"Workflow execution failed: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'completed_at': datetime.now().isoformat()
        }

# ============================================================================
# DAPR WORKFLOW SETUP - Following Official Python SDK Examples
# ============================================================================

# Create workflow runtime globally
# Note: WorkflowRuntime will use environment variables for Dapr connection
wfr = WorkflowRuntime()

# Register workflow with decorator pattern
@wfr.workflow(name='${workflowName}')
def ${workflowName}(ctx: DaprWorkflowContext, input_data: dict):
    """Main workflow function using Dapr Python SDK"""
    try:
        logger.info(f"Starting Dapr workflow: ${workflow.name}")
        logger.info(f"Workflow instance ID: {ctx.instance_id}")
        logger.info(f"Input data: {input_data}")
        
        # Step 1: Load data
        logger.info("Executing activity: load_data")
        load_result = yield ctx.call_activity('load_data_activity', input=input_data)
        
        if not load_result.get('success'):
            raise Exception(f"Failed to load data: {load_result.get('error')}")
        
        results = {'load_data': load_result}
        
        # Execute workflow steps in order
${this.generateDaprWorkflowStepCalls(steps)}
        
        # Generate final results
        final_results = {
            'success': True,
            'workflow_name': '${workflow.name}',
            'instance_id': ctx.instance_id,
            'results': results,
            'processed_records': load_result.get('records_loaded', 0),
            'completed_at': datetime.now().isoformat(),
            'execution_summary': {
                'steps_completed': len(results),
                'workflow_pattern': 'python_dapr_sdk'
            }
        }
        
        logger.info("Workflow execution completed successfully")
        return final_results
        
    except Exception as e:
        logger.error(f"Workflow execution failed: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'completed_at': datetime.now().isoformat()
        }

# Register activities with decorator pattern
@wfr.activity(name='load_data_activity')
def load_data_activity(ctx: WorkflowActivityContext, input_data: dict):
    """Load data activity"""
    try:
        dataset_id = input_data.get('dataset', 'default')
        logger.info(f"Loading dataset: {dataset_id}")
        
        # TODO: Implement actual data loading from unified database
        # For now, create sample data
        sample_data = pd.DataFrame({
            'text': [
                'This is great!',
                'I love this product',
                'Not very good quality',
                'Amazing service and support',
                'Could be better'
            ] * 20,  # Sample data
            'category': ['electronics', 'books', 'clothing', 'services', 'food'] * 20
        })
        
        # Store data globally (in production, use proper state management)
        workflow_data['current'] = sample_data
        
        logger.info(f"Loaded dataset with {len(sample_data)} records")
        
        return {
            'success': True,
            'records_loaded': len(sample_data),
            'columns': list(sample_data.columns),
            'sample_data': sample_data.head(3).to_dict('records')
        }
        
    except Exception as e:
        logger.error(f"Failed to load data: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

${this.generateDaprDecoratedActivityMethods(steps)}

def main():
    """Main function to register workflows with Dapr runtime - for JS SDK execution"""
    
    # Configure Dapr connection from environment variables
    import os
    dapr_http_port = os.getenv('DAPR_HTTP_PORT', '3500')
    dapr_grpc_port = os.getenv('DAPR_GRPC_PORT', '50001')
    dapr_http_endpoint = os.getenv('DAPR_HTTP_ENDPOINT', f'http://localhost:{dapr_http_port}')
    dapr_grpc_endpoint = os.getenv('DAPR_GRPC_ENDPOINT', f'http://localhost:{dapr_grpc_port}')
    
    logger.info(f"Dapr configuration - HTTP Port: {dapr_http_port}, gRPC Port: {dapr_grpc_port}")
    logger.info(f"Connecting to Dapr at HTTP: {dapr_http_endpoint}, gRPC: {dapr_grpc_endpoint}")
    
    # Debug: Show all Dapr-related environment variables
    logger.info("All Dapr environment variables:")
    for key, value in os.environ.items():
        if 'DAPR' in key.upper():
            logger.info(f"  {key} = {value}")
    
    # Start the workflow runtime to register workflows and activities
    logger.info("Starting Dapr workflow runtime for workflow registration...")
    wfr.start()
    print(f"Workflow '{${workflowName}}' registered successfully with Dapr runtime")
    print("Workflow runtime ready for JS SDK execution")
    print("ready to accept workflow execution requests from Dapr JS SDK")
    
    # Keep the runtime alive to serve workflow execution requests from JS SDK
    try:
        logger.info("Workflow runtime is running and ready to serve execution requests...")
        print("Ready to accept workflow execution requests from Dapr JS SDK")
        print(f"Listening on Dapr endpoints: {dapr_http_endpoint} (HTTP), {dapr_grpc_endpoint} (gRPC)")
        
        # Runtime stays alive to handle workflow executions triggered by JS SDK
        import time
        while True:
            time.sleep(1)  # Keep runtime alive
    except KeyboardInterrupt:
        logger.info("Shutting down workflow runtime...")
        wfr.shutdown()
        logger.info("Workflow runtime shutdown complete")

if __name__ == "__main__":
    main()
`;
  }

  /**
   * Generate Python Dapr activities for workflow steps
   */
  private generatePythonDaprActivities(steps: WorkflowStep[]): string {
    return steps.map(step => {
      const activityName = `${this.toPythonMethodName(step.name)}_activity`;
      const implementation = this.generatePythonDaprActivityImplementation(step);
      
      return `def ${activityName}(ctx: WorkflowActivityContext, input_data: Dict[str, Any]) -> Dict[str, Any]:
    """${step.description || step.name} activity"""
    try:
        logger.info(f"Executing activity: ${step.name}")
        
        # Get workflow data from global storage
        workflow_df = workflow_data.get(ctx.instance_id)
        if workflow_df is None:
            raise Exception("No workflow data found - load_data must be called first")
        
        ${implementation}
        
        # Update global workflow data
        workflow_data[ctx.instance_id] = workflow_df
        
        return result
        
    except Exception as e:
        logger.error(f"Activity ${step.name} failed: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'step_name': '${step.name}'
        }`;
    }).join('\n\n');
  }

  /**
   * Generate Dapr workflow step calls
   */
  private generateDaprWorkflowStepCalls(steps: WorkflowStep[]): string {
    return steps.map((step, index) => {
      const activityName = `${this.toPythonMethodName(step.name)}_activity`;
      return `        # Step ${index + 1}: ${step.name}
        logger.info("Executing step: ${step.name}")
        step_result = yield ctx.call_activity('${activityName}', input=input_data)
        
        if not step_result.get('success'):
            raise Exception(f"Step ${step.name} failed: {step_result.get('error')}")
        
        results['${step.id}'] = step_result`;
    }).join('\n\n');
  }

  /**
   * Generate Dapr decorated activity methods
   */
  private generateDaprDecoratedActivityMethods(steps: WorkflowStep[]): string {
    return steps.map(step => {
      const activityName = `${this.toPythonMethodName(step.name)}_activity`;
      const implementation = this.generatePythonDaprActivityImplementation(step);
      
      return `@wfr.activity(name='${activityName}')
def ${activityName}(ctx: WorkflowActivityContext, input_data: dict):
    """${step.description || step.name} activity"""
    try:
        logger.info(f"Executing activity: ${step.name}")
        
        # Get workflow data from global storage
        workflow_df = workflow_data.get('current')
        if workflow_df is None:
            raise Exception("No workflow data found - load_data must be called first")
        
        ${implementation}
        
        # Update global workflow data
        workflow_data['current'] = workflow_df
        
        return result
        
    except Exception as e:
        logger.error(f"Activity ${step.name} failed: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'step_name': '${step.name}'
        }`;
    }).join('\n\n');
  }

  /**
   * Generate Python Dapr activity implementations
   */
  private generatePythonDaprActivityImplementation(step: WorkflowStep): string {
    return this.generatePythonStepImplementation(step);
  }

  /**
   * Generate specific Python implementations for different step types
   */
  private generatePythonStepImplementation(step: WorkflowStep): string {
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

  /**
   * Generate requirements.txt for Python dependencies including Dapr SDK
   */
  private generateRequirements(workflow: WorkflowDefinition): string {
    const baseRequirements = [
      'dapr>=1.15.0',           // Python Dapr SDK  
      'dapr-ext-workflow>=1.15.0',  // Dapr Workflow Extension
      'pandas>=2.0.0',
      'numpy>=1.24.0',
      'polars>=0.20.0',         // High-performance DataFrame library
      'scikit-learn>=1.3.0',
      'textblob>=0.17.1',
      'nltk>=3.8.1'
    ];

    const steps = workflow.steps;
    const additionalRequirements: string[] = [];

    // Add step-specific requirements
    if (steps.some(s => s.type === 'sentiment_analysis')) {
      additionalRequirements.push('vaderSentiment>=3.3.2');
    }

    if (steps.some(s => s.type === 'topic_modeling')) {
      additionalRequirements.push('gensim>=4.3.0');
    }

    return [...baseRequirements, ...additionalRequirements].join('\n');
  }

  // === HELPER METHODS FOR PURE PYTHON DAPR WORKFLOW ===

  /**
   * Ensure all necessary directories exist
   */
  private async ensureDirectories(workflowId: string): Promise<void> {
    const dirs = [
      this.workflowsDir,
      this.venvDir,
      join(this.workflowsDir, workflowId),
      join(this.venvDir, workflowId)
    ];

    for (const dir of dirs) {
      try {
        await mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }
  }

  /**
   * Deploy Python workflow script
   */
  private async deployPythonScript(workflowId: string, pythonScript: string): Promise<string> {
    const scriptPath = join(this.workflowsDir, workflowId, 'workflow.py');
    await writeFile(scriptPath, pythonScript);
    console.log(`Pure Python Dapr workflow script deployed: ${scriptPath}`);
    return scriptPath;
  }

  /**
   * Deploy requirements.txt
   */
  private async deployRequirements(workflowId: string, requirements: string): Promise<void> {
    const requirementsPath = join(this.workflowsDir, workflowId, 'requirements.txt');
    await writeFile(requirementsPath, requirements);
    console.log(`Requirements deployed: ${requirementsPath}`);
  }

  /**
   * Setup virtual environment with dependencies including Dapr SDK
   */
  private async setupVirtualEnvironment(workflowId: string, venvPath: string): Promise<void> {
    try {
      console.log(`Setting up virtual environment with Dapr SDK: ${venvPath}`);
      
      // Create virtual environment
      await execAsync(`python3 -m venv "${venvPath}"`);
      
      // Upgrade pip
      const pipPath = join(venvPath, 'bin', 'pip');
      await execAsync(`"${pipPath}" install --upgrade pip`);
      
      // Install requirements (includes Dapr SDK)
      const requirementsPath = join(this.workflowsDir, workflowId, 'requirements.txt');
      await execAsync(`"${pipPath}" install -r "${requirementsPath}"`);
      
      console.log('Virtual environment with Dapr SDK setup completed');
      
    } catch (error) {
      throw new Error(`Failed to setup virtual environment: ${error.message}`);
    }
  }

  /**
   * Generate virtual environment activation script
   */
  private generateVenvActivationScript(venvPath: string): string {
    return `#!/bin/bash
# Virtual environment activation script
source "${join(venvPath, 'bin', 'activate')}"
echo "Virtual environment activated: ${venvPath}"
`;
  }

  // Helper methods
  private generateWorkflowName(workflow: WorkflowDefinition): string {
    const baseName = workflow.name || 'UntitledWorkflow';
    return baseName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .map((word, index) => {
        if (index === 0) {
          return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('') || 'defaultWorkflow';
  }

  private toPythonMethodName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  private detectWorkflowPattern(workflow: WorkflowDefinition): string {
    return 'pure-python-dapr-sdk';
  }

  private calculateExecutionOrder(workflow: WorkflowDefinition): string[] {
    return workflow.steps
      .filter(step => step.type !== 'dataset_input' && step.type !== 'dataset_output')
      .map(step => step.id);
  }
}

// Export singleton instance
export const pythonDaprWorkflowGenerator = new PythonDaprWorkflowGenerator();
