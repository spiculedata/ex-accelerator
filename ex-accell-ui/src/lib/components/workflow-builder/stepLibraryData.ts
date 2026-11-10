/**
 * Workflow Step Library Data
 *
 * Defines all available workflow steps organized by category.
 * Each step includes configuration for visual appearance, data flow,
 * and default configuration options.
 */

export interface StepTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  inputs: string[];
  outputs: string[];
  config: Record<string, any>;
}

export interface StepCategory {
  category: string;
  steps: StepTemplate[];
}

/**
 * Complete step library with all available workflow steps
 */
export const stepLibrary: StepCategory[] = [
  {
    category: 'Data Input',
    steps: [
      {
        id: 'dataset_input',
        name: 'Dataset Input',
        description: 'Load dataset from available sources',
        icon: '📊',
        color: 'blue',
        inputs: [],
        outputs: ['dataset'],
        config: { dataset_id: '', columns: [] }
      }
    ]
  },
  {
    category: 'Data Cleaning',
    steps: [
      {
        id: 'remove_duplicates',
        name: 'Remove Duplicates',
        description: 'Remove duplicate records based on specified columns',
        icon: '🧹',
        color: 'green',
        inputs: ['dataset'],
        outputs: ['dataset'],
        config: { columns: [], keep: 'first' }
      },
      {
        id: 'handle_missing',
        name: 'Handle Missing Values',
        description: 'Fill, drop, or interpolate missing values',
        icon: '🔧',
        color: 'yellow',
        inputs: ['dataset'],
        outputs: ['dataset'],
        config: { strategy: 'drop', columns: [], fill_value: '' }
      },
      {
        id: 'filter_rows',
        name: 'Filter Rows',
        description: 'Filter rows based on conditions',
        icon: '🔍',
        color: 'purple',
        inputs: ['dataset'],
        outputs: ['dataset'],
        config: { conditions: [] }
      }
    ]
  },
  {
    category: 'Feature Engineering',
    steps: [
      {
        id: 'text_preprocessing',
        name: 'Text Preprocessing',
        description: 'Clean and normalize text data',
        icon: '📝',
        color: 'indigo',
        inputs: ['dataset'],
        outputs: ['dataset'],
        config: {
          columns: [],
          lowercase: true,
          remove_punctuation: true,
          remove_stopwords: true,
          stem: false,
          lemmatize: false
        }
      },
      {
        id: 'feature_extraction',
        name: 'Feature Extraction',
        description: 'Extract features from text or structured data',
        icon: '⚙️',
        color: 'orange',
        inputs: ['dataset'],
        outputs: ['dataset'],
        config: {
          method: 'tfidf',
          max_features: 1000,
          ngram_range: [1, 1],
          columns: []
        }
      },
      {
        id: 'datetime_features',
        name: 'DateTime Features',
        description: 'Extract temporal features from datetime columns',
        icon: '🕒',
        color: 'pink',
        inputs: ['dataset'],
        outputs: ['dataset'],
        config: {
          columns: [],
          features: ['hour', 'day_of_week', 'month', 'year']
        }
      }
    ]
  },
  {
    category: 'ML & Analytics',
    steps: [
      {
        id: 'sentiment_analysis',
        name: 'Sentiment Analysis',
        description: 'Analyze sentiment of text content',
        icon: '😊',
        color: 'emerald',
        inputs: ['dataset'],
        outputs: ['dataset'],
        config: {
          text_column: '',
          model: 'vader',
          output_columns: ['sentiment', 'confidence']
        }
      },
      {
        id: 'topic_modeling',
        name: 'Topic Modeling',
        description: 'Discover topics in text data using LDA',
        icon: '🏷️',
        color: 'cyan',
        inputs: ['dataset'],
        outputs: ['dataset'],
        config: {
          text_column: '',
          num_topics: 10,
          method: 'lda',
          output_columns: ['topics', 'topic_weights']
        }
      },
      {
        id: 'clustering',
        name: 'Clustering',
        description: 'Group similar records using clustering algorithms',
        icon: '🎯',
        color: 'rose',
        inputs: ['dataset'],
        outputs: ['dataset'],
        config: {
          features: [],
          algorithm: 'kmeans',
          n_clusters: 5,
          output_column: 'cluster'
        }
      }
    ]
  },
  {
    category: 'Data Output',
    steps: [
      {
        id: 'dataset_output',
        name: 'Dataset Output',
        description: 'Save processed dataset',
        icon: '💾',
        color: 'gray',
        inputs: ['dataset'],
        outputs: [],
        config: {
          name: '',
          format: 'csv',
          description: ''
        }
      }
    ]
  }
];

/**
 * Get step template by ID
 */
export function getStepTemplateById(id: string): StepTemplate | undefined {
  for (const category of stepLibrary) {
    const step = category.steps.find(s => s.id === id);
    if (step) return step;
  }
  return undefined;
}

/**
 * Get all steps in a specific category
 */
export function getStepsByCategory(categoryName: string): StepTemplate[] {
  const category = stepLibrary.find(c => c.category === categoryName);
  return category?.steps || [];
}

/**
 * Get all available step categories
 */
export function getCategories(): string[] {
  return stepLibrary.map(c => c.category);
}

/**
 * Search steps by name or description
 */
export function searchSteps(query: string): StepTemplate[] {
  const lowerQuery = query.toLowerCase();
  const results: StepTemplate[] = [];

  for (const category of stepLibrary) {
    for (const step of category.steps) {
      if (
        step.name.toLowerCase().includes(lowerQuery) ||
        step.description.toLowerCase().includes(lowerQuery)
      ) {
        results.push(step);
      }
    }
  }

  return results;
}

/**
 * Tailwind classes for a step's colour name. The names are historical: several of them (blue, purple, indigo, pink,
 * cyan) now resolve to the same primary ramp, so they take distinct categorical tokens (--se-cat-*) instead, with the
 * label in ink so it stays readable on every tint. Each step also carries an icon and a category label.
 */
export const stepColorClasses: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'bg-cat-1/15', border: 'border-cat-1', text: 'text-ink-900' },
  green: { bg: 'bg-success-100', border: 'border-success-500', text: 'text-success-800' },
  yellow: { bg: 'bg-cat-7/25', border: 'border-cat-7', text: 'text-ink-900' },
  purple: { bg: 'bg-cat-4/15', border: 'border-cat-4', text: 'text-ink-900' },
  indigo: { bg: 'bg-cat-8/10', border: 'border-cat-8', text: 'text-ink-900' },
  orange: { bg: 'bg-signal-100', border: 'border-signal-500', text: 'text-signal-800' },
  pink: { bg: 'bg-cat-6/15', border: 'border-cat-6', text: 'text-ink-900' },
  emerald: { bg: 'bg-cat-3/15', border: 'border-cat-3', text: 'text-ink-900' },
  cyan: { bg: 'bg-cat-5/20', border: 'border-cat-5', text: 'text-ink-900' },
  rose: { bg: 'bg-danger-100', border: 'border-danger-500', text: 'text-danger-800' },
  gray: { bg: 'bg-ink-100', border: 'border-ink-500', text: 'text-ink-700' }
};

/**
 * Get Tailwind classes for a step color
 */
export function getStepColorClasses(color: string): { bg: string; border: string; text: string } {
  return stepColorClasses[color] || stepColorClasses.gray;
}
