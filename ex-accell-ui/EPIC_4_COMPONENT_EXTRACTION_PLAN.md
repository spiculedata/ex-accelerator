# Epic 4: Component Bloat Extraction Plan

**Target**: data-capture/+page.svelte (3,776 lines → target: ~500 lines)

## Current Structure Analysis

### File Breakdown
- **Script Section**: Lines 1-1365 (1,365 lines)
  - 76 functions and variables
  - State management for all tabs
  - Event handlers
  - API calls

- **Template Section**: Lines 1366-3776 (2,411 lines)
  - Tab navigation: ~60 lines
  - Web Crawler: ~900 lines (lines 1477-2383)
  - File Upload: ~110 lines (lines 2384-2495)
  - Princeton SMART: ~250 lines (lines 2496-2749)
  - Schedule & Status: ~240 lines (lines 2750-2988)
  - WavePulse: ~800 lines (lines 2989-end)

## Extraction Strategy

### Phase 1: Extract Crawler Configuration Form
**Target**: ~900 lines → CrawlerConfigForm.svelte
**Location**: Lines 1477-2383

**State to Extract**:
```typescript
- crawlerConfig (basic settings)
- urls (URL management)
- urlUploadState
- currentStep (wizard state)
- validationErrors
```

**Functions to Extract**:
```typescript
- validateStep1/2/3/4()
- isUrlValid()
- checkDuplicateJobName()
- handleScheduleCrawl()
```

**Props Interface**:
```typescript
interface CrawlerConfigFormProps {
  onSchedule: (config: CrawlerConfig) => Promise<void>;
  existingJobs: string[];
}
```

**Expected Result**: ~400 line component (55% reduction)

### Phase 2: Extract Job Scheduler/Status View
**Target**: ~240 lines → JobScheduler.svelte
**Location**: Lines 2750-2988

**State to Extract**:
```typescript
- crawlJobs
- selectedJob
- logViewerState
```

**Functions to Extract**:
```typescript
- loadJobStates()
- loadJobLogs()
- handleEditJob()
- handleDeleteJob()
- cancelJob()
```

**Props Interface**:
```typescript
interface JobSchedulerProps {
  jobs: CrawlJob[];
  onEdit: (job: CrawlJob) => void;
  onDelete: (jobName: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}
```

**Expected Result**: ~180 line component (25% reduction)

### Phase 3: Extract Princeton SMART Configuration
**Target**: ~250 lines → PrincetonSmartConfig.svelte
**Location**: Lines 2496-2749

**State to Extract**:
```typescript
- princetonSmartConfig
- princetonSmartValidation
```

**Functions to Extract**:
```typescript
- validatePrincetonConfig()
- handlePrincetonSmartExtract()
```

**Props Interface**:
```typescript
interface PrincetonSmartConfigProps {
  onExtract: (config: PrincetonConfig) => Promise<void>;
}
```

**Expected Result**: ~200 line component (20% reduction)

### Phase 4: Extract WavePulse Configuration
**Target**: ~800 lines → WavePulseConfig.svelte
**Location**: Lines 2989-end

**State to Extract**:
```typescript
- wavePulseConfig
- wavePulseSchedules
```

**Functions to Extract**:
```typescript
- handleWavePulseSchedule()
- formatWavePulseSchedule()
```

**Expected Result**: ~300 line component (62% reduction)

### Phase 5: Create Reusable UI Components

#### FormInput.svelte (~50 lines)
```typescript
interface FormInputProps {
  label: string;
  value: string;
  error?: string;
  tooltip?: string;
  required?: boolean;
  onChange: (value: string) => void;
}
```

#### SelectDropdown.svelte (~40 lines)
```typescript
interface SelectDropdownProps {
  label: string;
  value: string;
  options: Array<{label: string; value: string}>;
  error?: string;
  onChange: (value: string) => void;
}
```

#### TabNavigation.svelte (~60 lines)
```typescript
interface Tab {
  id: string;
  label: string;
  badge?: number;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}
```

#### StatusBadge.svelte (~30 lines)
```typescript
interface StatusBadgeProps {
  status: 'pending' | 'running' | 'completed' | 'failed';
  label: string;
}
```

### Phase 6: Refactor Main Page
**Final Structure** (~500 lines):

```svelte
<script lang="ts">
  import CrawlerConfigForm from '$lib/components/CrawlerConfigForm.svelte';
  import JobScheduler from '$lib/components/JobScheduler.svelte';
  import PrincetonSmartConfig from '$lib/components/PrincetonSmartConfig.svelte';
  import WavePulseConfig from '$lib/components/WavePulseConfig.svelte';
  import TabNavigation from '$lib/components/TabNavigation.svelte';

  // Minimal orchestration logic (~200 lines)
  let activeTab = 'crawler';
  let jobs = [];

  async function handleScheduleCrawl(config) {
    // Orchestrate job scheduling
  }
</script>

<!-- Tab navigation (~60 lines) -->
<TabNavigation {tabs} {activeTab} />

<!-- Tab content (~240 lines) -->
{#if activeTab === 'crawler'}
  <CrawlerConfigForm onSchedule={handleScheduleCrawl} />
{:else if activeTab === 'scheduler'}
  <JobScheduler {jobs} />
{/if}
```

## Expected Outcomes

### File Size Reduction

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| data-capture/+page.svelte | 3,776 lines | ~500 lines | **87%** |
| CrawlerConfigForm.svelte | - | ~400 lines | (new) |
| JobScheduler.svelte | - | ~180 lines | (new) |
| PrincetonSmartConfig.svelte | - | ~200 lines | (new) |
| WavePulseConfig.svelte | - | ~300 lines | (new) |
| UI Components (5 files) | - | ~210 lines | (new) |

### Code Organization Benefits

1. **Maintainability**: Each component has single responsibility
2. **Testability**: Components can be tested in isolation
3. **Reusability**: UI components can be used across pages
4. **Type Safety**: Each component fully typed with props interfaces
5. **Developer Experience**: Easier to understand and modify

### Type Error Reduction

**data-capture/+page.svelte**: 101 errors → ~15 errors (85% reduction)
**Expected**: Distribute errors across focused components, easier to fix

## Implementation Order

1. ✅ Analyze structure (complete)
2. ⏳ Create component extraction plan (this document)
3. ⏳ Create $lib/components directory
4. ⏳ Extract CrawlerConfigForm component
5. ⏳ Extract JobScheduler component
6. ⏳ Extract PrincetonSmartConfig component
7. ⏳ Extract WavePulseConfig component
8. ⏳ Create reusable UI components
9. ⏳ Refactor main page to use extracted components
10. ⏳ Test all functionality
11. ⏳ Verify type errors reduced
12. ⏳ Update documentation

## Success Criteria

- ✅ Main page reduced to <500 lines
- ✅ All components <400 lines each
- ✅ Reusable UI component library created
- ✅ All functionality preserved
- ✅ Build still passing
- ✅ Type errors reduced by 80%+ in this file
- ✅ Components follow best practices (props, events, types)

## Notes

- Start with CrawlerConfigForm (largest, most complex)
- Create UI components as needed during extraction
- Maintain all existing functionality
- Keep git history with meaningful commits
- Test after each extraction
