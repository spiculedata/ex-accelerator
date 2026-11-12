// Renders the generated Python Dapr workflow script. Template whitespace is
// load-bearing (Python indentation) and pinned by snapshot tests.

import { generateWorkflowName, toPythonMethodName } from './pythonDaprNaming';
import { generatePythonStepImplementation } from './pythonDaprStepTemplates';
import type { WorkflowDefinition, WorkflowStep } from './pythonDaprWorkflowTypes';

/**
 * Generate Python workflow script using pure Dapr Python SDK
 */
export function generatePythonWorkflowScript(workflow: WorkflowDefinition): string {
  const steps = workflow.steps.filter(step =>
    step.type !== 'dataset_input' && step.type !== 'dataset_output'
  );

  const workflowName = generateWorkflowName(workflow);

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
${generateDaprWorkflowStepCalls(steps)}
        
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
${generateDaprWorkflowStepCalls(steps)}
        
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

${generateDaprDecoratedActivityMethods(steps)}

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
 * Generate Dapr workflow step calls
 */
function generateDaprWorkflowStepCalls(steps: WorkflowStep[]): string {
    return steps.map((step, index) => {
      const activityName = `${toPythonMethodName(step.name)}_activity`;
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
function generateDaprDecoratedActivityMethods(steps: WorkflowStep[]): string {
    return steps.map(step => {
      const activityName = `${toPythonMethodName(step.name)}_activity`;
      const implementation = generatePythonStepImplementation(step);
      
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
