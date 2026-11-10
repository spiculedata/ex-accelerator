<script lang="ts">
  import { CHART } from '$lib/utils/chartColors';
  // Tailwind-only styling for the dual-handle range sliders (thumb and track pseudo-elements)
  const rangeSliderClass =
    'absolute w-full h-2 bg-transparent rounded-xl appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-linear-to-br [&::-webkit-slider-thumb]:from-violet-500 [&::-webkit-slider-thumb]:to-purple-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-linear-to-br [&::-moz-range-thumb]:from-violet-500 [&::-moz-range-thumb]:to-purple-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer [&::-webkit-slider-track]:h-1.5 [&::-webkit-slider-track]:bg-gray-300 [&::-webkit-slider-track]:rounded-sm [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-gray-300 [&::-moz-range-track]:rounded-sm';

	import 'leaflet/dist/leaflet.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { getCountryNameWithFallback, getAllCountries } from '$lib/countryMapping';
	import DataUnavailable from '$lib/components/ui/DataUnavailable.svelte';
	
	let mapContainer: HTMLDivElement;
	let map: any;
	let leaflet: any;
	let events: any[] = [];
	let loading = true;
	let error = '';
	// GDELT has not been loaded into this database: say so, rather than show an error or an empty map
	let gdeltUnavailable = false;
	let markers: any = {};
	let activeEventTypes = new Set(['all']);
	let isToggling = false;
	let goldsteinRange = [-10, 10];
	let isUpdatingFilter = false;
	let goldsteinMin = -10;
	let goldsteinMax = 10;
	let toneRange = [-50, 50];
	let toneMin = -50;
	let toneMax = 50;
	let selectedCountries = new Set(['all']);
	let availableCountries: string[] = [];
	let countrySearchTerm = '';
	let filteredCountries: string[] = [];
	let dateRange = ['', '']; // [startDate, endDate] in YYYY-MM-DD format
	let availableDateRange = ['', '']; // Auto-detected from data
	let dateRefreshTimeout: ReturnType<typeof setTimeout>;
	
	// Mentions functionality
	let selectedEventId: number | null = null;
	let mentions: any[] = [];
	let loadingMentions = false;
	let mentionsError = '';
	let mentionsLimitationNotice = '';
	let showMentions = false;
	
	// Batch loading state
	let isBatchLoading = false;
	let batchProgress = { current: 0, total: 0, loadedMentions: 0 };
	
	// Mentions table state
	let mentionsSortField = 'mentionTimeDate';
	let mentionsSortDirection: 'asc' | 'desc' = 'desc';
	let mentionsSearchTerm = '';
	let mentionsTypeFilter = '';
	let filteredMentions: any[] = [];
	
	// Pagination state
	let currentPage = 1;
	let itemsPerPage = 100;
	let displayedMentions: any[] = [];
	const itemsPerPageOptions = [25, 50, 100, 200, 500, 1000];
	
	// Global South countries list from BISA
	const globalSouthCountries = [
		'Afghanistan', 'Algeria', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Bahamas', 'Bahrain', 
		'Bangladesh', 'Barbados', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 
		'Botswana', 'Brazil', 'Brunei Darussalam', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cape Verde',
		'Cambodia', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 
		'Congo (Dem. Rep.)', 'Congo (Republic of)', 'Costa Rica', 'Côte d\'Ivoire', 'Ivory Coast', 'Cuba', 
		'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 
		'Eritrea', 'Eswatini', 'Ethiopia', 'Fiji', 'Gabon', 'Gambia', 'Ghana', 'Grenada', 'Guatemala', 
		'Guinea', 'Guinea-Bisseau', 'Guyana', 'Haiti', 'Honduras', 'India', 'Indonesia', 'Iran', 'Iraq', 
		'Jamaica', 'Jordan', 'Kenya', 'Kiribati', 'Laos', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 
		'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Marshall Islands', 'Mauritania', 'Mauritius', 
		'Mexico', 'Micronesia', 'Mongolia', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 
		'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'Oman', 'Pakistan', 'Palestine', 'Panama', 
		'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Rwanda', 'Saint Kitts and Nevis', 
		'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'São Tomé and Príncipe', 'Saudi Arabia', 
		'Senegal', 'Seychelles', 'Sierra Leone', 'Solomon Islands', 'Somalia', 'South Africa', 'South Sudan', 
		'Sri Lanka', 'Sudan', 'Suriname', 'Syria', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 
		'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Uganda', 'Uruguay', 
		'Vanuatu', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
	];
	
	// Function to find country code by name
	function getCountryCodeByName(countryName: string): string | null {
		const countries = getAllCountries();
		const normalizedName = countryName.toLowerCase();
		
		// Direct match
		for (const [code, data] of Object.entries(countries)) {
			if (data.name.toLowerCase() === normalizedName) {
				return code;
			}
		}
		
		// Partial match for common variations
		for (const [code, data] of Object.entries(countries)) {
			const name = data.name.toLowerCase();
			if (name.includes(normalizedName) || normalizedName.includes(name)) {
				return code;
			}
		}
		
		return null;
	}
	
	// Get Global South country codes that are available in our data
	$: globalSouthCountryCodes = (globalSouthCountries
		.map(name => getCountryCodeByName(name))
		.filter(code => code && availableCountries.includes(code as string)) as string[]);
	
	// Mention type mapping
	function getMentionTypeLabel(mentionType: number): string {
		const typeMap: { [key: number]: string } = {
			1: 'Web News',
			2: 'Print News', 
			3: 'Broadcast News'
		};
		return typeMap[mentionType] || `Type ${mentionType}`;
	}

	// Function to convert tone score to human-readable description
	function getToneDescription(toneScore: number): string {
		if (toneScore >= 5) return 'Very Positive';
		if (toneScore >= 2) return 'Positive';
		if (toneScore >= 0.5) return 'Slightly Positive';
		if (toneScore > -0.5) return 'Neutral';
		if (toneScore > -2) return 'Slightly Negative';
		if (toneScore > -5) return 'Negative';
		return 'Very Negative';
	}

	function getMentionTypeColor(mentionType: number): string {
		const colorMap: { [key: number]: string } = {
			1: 'bg-blue-100 text-blue-800',      // Web News
			2: 'bg-gray-100 text-gray-800',     // Print News
			3: 'bg-blue-100 text-blue-800'  // Broadcast News
		};
		return colorMap[mentionType] || 'bg-gray-100 text-gray-800';
	}

	// Helper functions for date conversion
	function gdeltDateToInputDate(gdeltDate: number): string {
		if (!gdeltDate) return '';
		const dateStr = gdeltDate.toString();
		
		// Handle YYYYMMDD format (8 digits)
		if (dateStr.length === 8) {
			return `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
		}
		
		// Handle YYYYMMDDHHMM format (12 digits) - mentions often include time
		if (dateStr.length === 12) {
			const year = dateStr.slice(0,4);
			const month = dateStr.slice(4,6);
			const day = dateStr.slice(6,8);
			const hour = dateStr.slice(8,10);
			const minute = dateStr.slice(10,12);
			return `${year}-${month}-${day} ${hour}:${minute}`;
		}
		
		// Handle YYYYMMDDHHMMSS format (14 digits) - full timestamp
		if (dateStr.length === 14) {
			const year = dateStr.slice(0,4);
			const month = dateStr.slice(4,6);
			const day = dateStr.slice(6,8);
			const hour = dateStr.slice(8,10);
			const minute = dateStr.slice(10,12);
			const second = dateStr.slice(12,14);
			return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
		}
		
		// Fallback: return as-is if format is unknown
		return dateStr;
	}
	
	function inputDateToGdeltDate(inputDate: string): number {
		if (!inputDate) return 0;
		return parseInt(inputDate.replace(/-/g, ''));
	}
	
	// Reactive statement to filter countries based on search term
	$: filteredCountries = availableCountries.filter(country => {
		if (!countrySearchTerm) return true;
		const countryName = getCountryNameWithFallback(country, country);
		return countryName.toLowerCase().includes(countrySearchTerm.toLowerCase());
	});

	// Function to get currently visible events based on all filters
	function getVisibleEvents(eventsArray: any, eventTypes: any, goldstein: any, tone: any, countries: any, dateRangeFilter: any) {
		const filtered = eventsArray.filter((event: any) => {
			// Check event type
			const eventType = getEventType(event.eventCode);
			const typeMatch = eventTypes.has('all') || eventTypes.has(eventType);
			
			// Check Goldstein scale range
			const goldsteinValue = event.goldstein || 0;
			const goldsteinMatch = goldsteinValue >= goldstein[0] && goldsteinValue <= goldstein[1];
			
			// Check tone range
			const toneValue = event.tone || 0;
			const toneMatch = toneValue >= tone[0] && toneValue <= tone[1];
			
			// Check country
			const countryMatch = countries.has('all') || countries.has(event.country);
			
			// Check date range
			let dateMatch = true;
			if (dateRangeFilter[0] || dateRangeFilter[1]) {
				const eventDate = event.date || 0;
				const startDate = dateRangeFilter[0] ? inputDateToGdeltDate(dateRangeFilter[0]) : 0;
				const endDate = dateRangeFilter[1] ? inputDateToGdeltDate(dateRangeFilter[1]) : 99999999;
				dateMatch = eventDate >= startDate && eventDate <= endDate;
			}
			
			return typeMatch && goldsteinMatch && toneMatch && countryMatch && dateMatch;
		});
		
		return filtered;
	}

	// Function to get events excluding country filter (for country counts)
	function getEventsExcludingCountryFilter(eventsArray: any, eventTypes: any, goldstein: any, tone: any, dateRangeFilter: any) {
		return eventsArray.filter((event: any) => {
			// Check event type
			const eventType = getEventType(event.eventCode);
			const typeMatch = eventTypes.has('all') || eventTypes.has(eventType);
			
			// Check Goldstein scale range
			const goldsteinValue = event.goldstein || 0;
			const goldsteinMatch = goldsteinValue >= goldstein[0] && goldsteinValue <= goldstein[1];
			
			// Check tone range
			const toneValue = event.tone || 0;
			const toneMatch = toneValue >= tone[0] && toneValue <= tone[1];
			
			// Check date range
			let dateMatch = true;
			if (dateRangeFilter[0] || dateRangeFilter[1]) {
				const eventDate = event.date || 0;
				const startDate = dateRangeFilter[0] ? inputDateToGdeltDate(dateRangeFilter[0]) : 0;
				const endDate = dateRangeFilter[1] ? inputDateToGdeltDate(dateRangeFilter[1]) : 99999999;
				dateMatch = eventDate >= startDate && eventDate <= endDate;
			}
			
			// No country filter here - that's the point
			return typeMatch && goldsteinMatch && toneMatch && dateMatch;
		});
	}

	// Reactive statements
	$: visibleEvents = getVisibleEvents(events, activeEventTypes, goldsteinRange, toneRange, selectedCountries, dateRange);
	$: eventsForCountryCounts = getEventsExcludingCountryFilter(events, activeEventTypes, goldsteinRange, toneRange, dateRange);
	

	// GDELT Event Type Mappings (based on CAMEO codes)
	const eventTypes: Record<string, any> = {
		'verbal_cooperation': { 
			codes: ['10', '11', '12', '13', '14', '15', '16', '17'],
			label: 'Verbal Cooperation',
			color: CHART.catGreen,
			description: 'Make statement, comment, consult, engage in diplomatic cooperation'
		},
		'material_cooperation': {
			codes: ['20', '21', '22', '23', '24', '25', '26', '27'],
			label: 'Material Cooperation', 
			color: CHART.catGreen,
			description: 'Appeal, express intent to cooperate, provide aid'
		},
		'verbal_conflict': {
			codes: ['10', '11', '12', '13', '14', '15', '16', '17'].map(c => '1' + c),
			label: 'Verbal Conflict',
			color: CHART.catOrange, 
			description: 'Demand, disapprove, reject, threaten, protest'
		},
		'material_conflict': {
			codes: ['18', '19', '20'],
			label: 'Material Conflict',
			color: CHART.danger500,
			description: 'Exhibit force, reduce relations, coerce'
		},
		'diplomacy': {
			codes: ['30', '31', '32', '33', '34', '35', '36', '37'], 
			label: 'Diplomacy',
			color: CHART.catBlue,
			description: 'Express intent to cooperate, consult, support'
		},
		'support': {
			codes: ['40', '41', '42', '43', '44', '45', '46'],
			label: 'Support & Agreements',
			color: CHART.primary500,
			description: 'Cooperate, agree, provide support'
		},
		'information': {
			codes: ['50', '51', '52', '53', '54', '55', '56', '57'],
			label: 'Information & Media',
			color: CHART.catPink,
			description: 'Engage in symbolic acts, media statements'
		},
		'economic': {
			codes: ['60', '61', '62', '63', '64', '65', '66', '67'],
			label: 'Economic Actions',
			color: CHART.success600,
			description: 'Economic cooperation, trade, sanctions'
		},
		'political': {
			codes: ['70', '71', '72', '73', '74', '75', '76'],
			label: 'Political Actions', 
			color: CHART.danger600,
			description: 'Provide diplomatic cooperation, host meetings'
		},
		'military': {
			codes: ['80', '81', '82', '83', '84', '85', '86', '87'],
			label: 'Military Actions',
			color: CHART.danger700,
			description: 'Military cooperation, exercises, operations'
		},
		'protests': {
			codes: ['14', '141', '142', '143', '144', '145'],
			label: 'Protests & Demonstrations',
			color: CHART.catVermilion,
			description: 'Protests, demonstrations, strikes'
		},
		'violence': {
			codes: ['17', '18', '19', '190', '193', '194', '195'],
			label: 'Violence & Conflict',
			color: CHART.danger700,
			description: 'Violence, fighting, armed conflict'
		}
	};

	function getEventType(eventCode: string): string {
		for (const [type, config] of Object.entries(eventTypes)) {
			if (config.codes.some((code: string) => eventCode.startsWith(code))) {
				return type;
			}
		}
		return 'other';
	}

	function getEventTypeColor(eventCode: string): string {
		const type = getEventType(eventCode);
		return eventTypes[type]?.color || CHART.ink500;
	}

	async function toggleEventType(eventType: string) {
		if (isToggling) return; // Prevent multiple rapid toggles
		
		isToggling = true;
		
		try {
			if (eventType === 'all') {
				if (activeEventTypes.has('all')) {
					activeEventTypes = new Set();
				} else {
					activeEventTypes = new Set(['all']);
				}
			} else {
				activeEventTypes.delete('all');
				if (activeEventTypes.has(eventType)) {
					activeEventTypes.delete(eventType);
				} else {
					activeEventTypes.add(eventType);
				}
			}
			
			// Add small delay for smooth UI feedback
			await new Promise(resolve => setTimeout(resolve, 50));
			updateMarkerVisibility();
		} finally {
			isToggling = false;
		}
	}

	function updateMarkerVisibility() {
		let visibleCount = 0;
		const startTime = performance.now();
		
		Object.entries(markers as Record<string, any>).forEach(([eventId, marker]) => {
			const event = events.find(e => e.id.toString() === eventId);
			if (event) {
				// Check event type
				const eventType = getEventType(event.eventCode);
				const typeMatch = activeEventTypes.has('all') || activeEventTypes.has(eventType);
				
				// Check Goldstein scale range
				const goldsteinValue = event.goldstein || 0;
				const goldsteinMatch = goldsteinValue >= goldsteinRange[0] && goldsteinValue <= goldsteinRange[1];
				
				// Check tone range
				const toneValue = event.tone || 0;
				const toneMatch = toneValue >= toneRange[0] && toneValue <= toneRange[1];
				
				// Check country
				const countryMatch = selectedCountries.has('all') || selectedCountries.has(event.country);
				
				// Check date range
				let dateMatch = true;
				if (dateRange[0] || dateRange[1]) {
					const eventDate = event.date || 0;
					const startDate = dateRange[0] ? inputDateToGdeltDate(dateRange[0]) : 0;
					const endDate = dateRange[1] ? inputDateToGdeltDate(dateRange[1]) : 99999999;
					dateMatch = eventDate >= startDate && eventDate <= endDate;
				}
				
				const shouldShow = typeMatch && goldsteinMatch && toneMatch && countryMatch && dateMatch;
				
				if (shouldShow) {
					if (!map.hasLayer(marker)) {
						marker.addTo(map);
					}
					visibleCount++;
				} else {
					if (map.hasLayer(marker)) {
						marker.remove();
					}
				}
			}
		});
		
		const endTime = performance.now();
		console.log(`Updated ${visibleCount} markers (Filters: Goldstein ${goldsteinRange[0]} to ${goldsteinRange[1]}, Tone ${toneRange[0]} to ${toneRange[1]}, Countries: ${selectedCountries.size}) in ${Math.round(endTime - startTime)}ms`);
	}

	function handleGoldsteinChange() {
		// Ensure min <= max
		if (goldsteinRange[0] > goldsteinRange[1]) {
			const temp = goldsteinRange[0];
			goldsteinRange[0] = goldsteinRange[1];
			goldsteinRange[1] = temp;
		}
		
		// Update the manual entry fields
		goldsteinMin = goldsteinRange[0];
		goldsteinMax = goldsteinRange[1];
		
		// Debounce the filter update
		clearTimeout((window as any).goldsteinTimeout);
		(window as any).goldsteinTimeout = setTimeout(() => {
			updateMarkerVisibility();
		}, 200);
	}

	function handleManualEntry() {
		// Validate and update range
		const min = Math.max(-10, Math.min(10, goldsteinMin));
		const max = Math.max(-10, Math.min(10, goldsteinMax));
		
		if (min <= max) {
			goldsteinRange = [min, max];
			goldsteinMin = min;
			goldsteinMax = max;
		} else {
			goldsteinRange = [max, min];
			goldsteinMin = max;
			goldsteinMax = min;
		}
		
		updateMarkerVisibility();
	}

	function handleToneChange() {
		// Ensure min <= max
		if (toneRange[0] > toneRange[1]) {
			const temp = toneRange[0];
			toneRange[0] = toneRange[1];
			toneRange[1] = temp;
		}
		
		// Update manual entry fields
		toneMin = toneRange[0];
		toneMax = toneRange[1];
		
		// Debounce the filter update
		clearTimeout((window as any).toneTimeout);
		(window as any).toneTimeout = setTimeout(() => {
			updateMarkerVisibility();
		}, 200);
	}

	function handleToneManualEntry() {
		// Validate and update range
		const min = Math.max(-50, Math.min(50, toneMin));
		const max = Math.max(-50, Math.min(50, toneMax));
		
		if (min <= max) {
			toneRange = [min, max];
			toneMin = min;
			toneMax = max;
		} else {
			toneRange = [max, min];
			toneMin = max;
			toneMax = min;
		}
		
		updateMarkerVisibility();
	}

	function toggleCountry(country: string) {
		if (country === 'all') {
			if (selectedCountries.has('all')) {
				selectedCountries = new Set();
			} else {
				selectedCountries = new Set(['all']);
			}
		} else {
			// Create a new Set to trigger reactivity
			const newSelectedCountries = new Set(selectedCountries);
			newSelectedCountries.delete('all'); // Remove 'all' when selecting individual countries
			
			if (newSelectedCountries.has(country)) {
				newSelectedCountries.delete(country);
			} else {
				newSelectedCountries.add(country);
			}
			
			selectedCountries = newSelectedCountries;
		}
		updateMarkerVisibility();
	}

	function toggleGlobalSouthCountries() {
		// Check if all Global South countries are currently selected
		const allGlobalSouthSelected = globalSouthCountryCodes.every(code => selectedCountries.has(code));
		
		const newSelectedCountries = new Set(selectedCountries);
		newSelectedCountries.delete('all'); // Remove 'all' when selecting specific countries
		
		if (allGlobalSouthSelected) {
			// Deselect all Global South countries
			globalSouthCountryCodes.forEach(code => newSelectedCountries.delete(code));
		} else {
			// Select all Global South countries
			globalSouthCountryCodes.forEach(code => newSelectedCountries.add(code));
		}
		
		selectedCountries = newSelectedCountries;
		updateMarkerVisibility();
	}

	// Check if all Global South countries are selected
	$: allGlobalSouthSelected = globalSouthCountryCodes.length > 0 && 
		globalSouthCountryCodes.every(code => selectedCountries.has(code));

	// Handle date range changes with debounced database refresh
	$: if (browser && dateRange) {
		clearTimeout(dateRefreshTimeout);
		dateRefreshTimeout = setTimeout(() => {
			// Only refresh from server if we have significant date changes
			// For now, always refresh since date filtering should be server-side
			if (dateRange[0] || dateRange[1]) {
				refreshDataFromServer('date range change');
			}
		}, 1000); // 1 second delay to avoid too many requests
	}


	// Reactive mentions filtering, sorting, and pagination
	$: {
		let filtered = [...mentions];
		
		// Apply search filter
		if (mentionsSearchTerm) {
			const searchLower = mentionsSearchTerm.toLowerCase();
			filtered = filtered.filter(mention => 
				(mention.mentionSourceName?.toLowerCase().includes(searchLower)) ||
				(mention.mentionIdentifier?.toLowerCase().includes(searchLower))
			);
		}
		
		// Apply type filter
		if (mentionsTypeFilter) {
			filtered = filtered.filter(mention => 
				mention.mentionType?.toString() === mentionsTypeFilter
			);
		}
		
		// Apply sorting
		filtered.sort((a, b) => {
			let aVal = a[mentionsSortField];
			let bVal = b[mentionsSortField];
			
			// Handle null/undefined values
			if (aVal == null && bVal == null) return 0;
			if (aVal == null) return mentionsSortDirection === 'asc' ? -1 : 1;
			if (bVal == null) return mentionsSortDirection === 'asc' ? 1 : -1;
			
			// Convert to comparable values
			if (typeof aVal === 'string') aVal = aVal.toLowerCase();
			if (typeof bVal === 'string') bVal = bVal.toLowerCase();
			
			const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
			return mentionsSortDirection === 'asc' ? comparison : -comparison;
		});
		
		filteredMentions = filtered;
		
		// Calculate pagination
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		displayedMentions = filteredMentions.slice(startIndex, endIndex);
	}

	function sortMentions(field: string) {
		if (mentionsSortField === field) {
			mentionsSortDirection = mentionsSortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			mentionsSortField = field;
			mentionsSortDirection = 'desc';
		}
		currentPage = 1; // Reset to first page when sorting
	}
	
	function goToPage(page: number) {
		currentPage = page;
	}
	
	function changeItemsPerPage(newItemsPerPage: number) {
		itemsPerPage = newItemsPerPage;
		currentPage = 1; // Reset to first page when changing page size
	}
	
	// Reset pagination when search or filter changes
	$: if (mentionsSearchTerm || mentionsTypeFilter) {
		currentPage = 1;
	}

	function exportMentionsToCSV() {
		if (filteredMentions.length === 0) return;
		
		// Define CSV headers
		const headers = [
			'Event ID',
			'Source Name',
			'Type',
			'Mention Date',
			'Confidence',
			'Doc Tone',
			'Doc Length',
			'Identifier',
			'Event Time Date',
			'Sentence ID',
			'In Raw Text',
			'Translation Info'
		];
		
		// Convert mentions to CSV rows
		const rows = filteredMentions.map(mention => [
			mention.globalEventId || '',
			mention.mentionSourceName || '',
			getMentionTypeLabel(mention.mentionType) || '',
			gdeltDateToInputDate(mention.mentionTimeDate) || '',
			mention.confidence || '',
			mention.mentionDocTone || '',
			mention.mentionDocLen || '',
			mention.mentionIdentifier || '',
			gdeltDateToInputDate(mention.eventTimeDate) || '',
			mention.sentenceId || '',
			mention.inRawText || '',
			mention.mentionDocTranslationInfo || ''
		]);
		
		// Create CSV content
		const csvContent = [
			headers.join(','),
			...rows.map(row => row.map(field => {
				// Escape fields that contain commas, quotes, or newlines
				const stringField = String(field);
				if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
					return `"${stringField.replace(/"/g, '""')}"`;
				}
				return stringField;
			}).join(','))
		].join('\n');
		
		// Create and trigger download
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		
		// Generate filename with timestamp
		const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
		const eventContext = selectedEventId ? `event-${selectedEventId}` : 'filtered-events';
		link.setAttribute('download', `gdelt-mentions-${eventContext}-${timestamp}.csv`);
		
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	function resetFilters() {
		// Reset event types
		activeEventTypes = new Set(['all']);
		
		// Reset Goldstein range
		goldsteinRange = [-10, 10];
		goldsteinMin = -10;
		goldsteinMax = 10;
		
		// Reset tone range
		toneRange = [-50, 50];
		toneMin = -50;
		toneMax = 50;
		
		// Reset countries
		selectedCountries = new Set(['all']);
		
		// Reset date range to show all available dates
		dateRange = [...availableDateRange];
		
		// Update marker visibility
		updateMarkerVisibility();
	}

	async function fetchEvents() {
		const params = new URLSearchParams({
			goldsteinMin: goldsteinRange[0].toString(),
			goldsteinMax: goldsteinRange[1].toString()
		});
		
		// Add date range parameters if they exist
		if (dateRange[0]) {
			params.append('dateStart', dateRange[0]);
		}
		if (dateRange[1]) {
			params.append('dateEnd', dateRange[1]);
		}
		
		const url = `/api/gdelt?${params}`;
		console.log('Fetching from URL:', url);
		
		const response = await fetch(url);
		console.log('Response status:', response.status, response.statusText);
		
		if (!response.ok) {
			const errorText = await response.text();
			console.error('Response error:', errorText);
			throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
		}
		
		const data = await response.json();
		gdeltUnavailable = !!data.unavailable;
		
		if (data.error) {
			throw new Error(data.error);
		}
		
		return data;
	}

	async function fetchMentions(eventId: number) {
		try {
			loadingMentions = true;
			mentionsError = '';
			
			// Reset pagination
			currentPage = 1;
			itemsPerPage = 100;
			
			const response = await fetch(`/api/gdelt/mentions?eventId=${eventId}`);
			
			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
			}
			
			const data = await response.json();
			
			if (data.error) {
				throw new Error(data.error);
			}
			
			mentions = data.mentions || [];
			selectedEventId = eventId;
			showMentions = true;
			
		} catch (err) {
			console.error('Error fetching mentions:', err);
			mentionsError = err instanceof Error ? err.message : 'Failed to load mentions';
			mentions = [];
		} finally {
			loadingMentions = false;
		}
	}

	async function fetchMentionsBatch(eventIds: any) {
		const response = await fetch('/api/gdelt/mentions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				eventIds: eventIds
			})
		});
		
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
		}
		
		const data = await response.json();
		
		if (data.error) {
			throw new Error(data.error);
		}
		
		return data.mentions || [];
	}

	async function fetchAllMentionsForVisible() {
		try {
			loadingMentions = true;
			isBatchLoading = false;
			mentionsError = '';
			mentionsLimitationNotice = '';
			mentions = []; // Clear previous mentions
			selectedEventId = null; // Set to null to indicate multiple events
			showMentions = true; // Show the mentions section immediately
			
			// Reset pagination
			currentPage = 1;
			itemsPerPage = 100;
			
			const allEventIds = visibleEvents.map((e: any) => e.id);
			console.log(`Starting batch mentions fetch for ${allEventIds.length} events...`);
			
			if (allEventIds.length <= 1000) {
				// Single batch - use existing logic
				const batchMentions = await fetchMentionsBatch(allEventIds);
				mentions = batchMentions;
				console.log(`Successfully loaded ${mentions.length} mentions for ${allEventIds.length} events`);
			} else {
				// Multiple batches required
				isBatchLoading = true;
				const batchSize = 1000;
				const totalBatches = Math.ceil(allEventIds.length / batchSize);
				
				batchProgress = {
					current: 0,
					total: totalBatches,
					loadedMentions: 0
				};
				
				console.log(`Large dataset: processing ${allEventIds.length} events in ${totalBatches} batches of ${batchSize}`);
				
				let allMentions: any[] = [];
				
				for (let i = 0; i < totalBatches; i++) {
					const start = i * batchSize;
					const end = Math.min(start + batchSize, allEventIds.length);
					const batchEventIds = allEventIds.slice(start, end);
					
					console.log(`Processing batch ${i + 1}/${totalBatches}: events ${start + 1}-${end}`);
					
					batchProgress.current = i + 1;
					
					const batchMentions = await fetchMentionsBatch(batchEventIds);
					allMentions = [...allMentions, ...batchMentions];
					
					// Update mentions progressively so user sees results building up
					mentions = [...allMentions];
					batchProgress.loadedMentions = allMentions.length;
					
					console.log(`Batch ${i + 1} complete: ${batchMentions.length} mentions (total: ${allMentions.length})`);
					
					// Small delay to prevent overwhelming the server and allow UI updates
					if (i < totalBatches - 1) {
						await new Promise(resolve => setTimeout(resolve, 100));
					}
				}
				
				console.log(`Batch loading complete: ${allMentions.length} mentions from ${allEventIds.length} events`);
				isBatchLoading = false;
			}
			
		} catch (err) {
			console.error('Error fetching all mentions:', err);
			mentionsError = err instanceof Error ? err.message : 'Failed to load mentions';
			mentions = [];
			isBatchLoading = false;
		} finally {
			loadingMentions = false;
		}
	}

	async function refreshDataFromServer(reason = 'filter change') {
		if (isUpdatingFilter) return;
		
		isUpdatingFilter = true;
		error = ''; // Clear any existing errors
		
		try {
			console.log(`Refreshing data due to ${reason}:`, { goldsteinRange, dateRange });
			
			// Clear existing markers
			Object.values(markers as Record<string, any>).forEach((marker: any) => marker.remove());
			markers = {};
			
			// Properly remove existing map
			if (map) {
				map.remove();
				map = null;
			}
			
			// Fetch new data
			const data = await fetchEvents();
			console.log('Refresh - Fetched events:', data.events?.length || 0);
			
			events = data.events || [];
			
			// Extract unique countries for filter and sort by country name
			availableCountries = [...new Set(events.map(e => e.country).filter(c => c))].sort((a, b) => {
				const nameA = getCountryNameWithFallback(a, a);
				const nameB = getCountryNameWithFallback(b, b);
				return nameA.localeCompare(nameB);
			});
			
			// Extract date range from events
			const eventDates = events.map(e => e.date).filter(d => d);
			if (eventDates.length > 0) {
				const minDate = Math.min(...eventDates);
				const maxDate = Math.max(...eventDates);
				const newAvailableDateRange = [gdeltDateToInputDate(minDate), gdeltDateToInputDate(maxDate)];
				
				// Only update available range if it changed
				if (newAvailableDateRange[0] !== availableDateRange[0] || newAvailableDateRange[1] !== availableDateRange[1]) {
					availableDateRange = newAvailableDateRange;
				}
			}
			
			// Reinitialize map with new data
			if (leaflet && mapContainer) {
				initializeMap();
			}
			
			console.log('Data refresh completed successfully');
		} catch (err: any) {
			console.error('Error refreshing data:', err);
			console.error('Error details:', err.message, err.stack);
			error = `Failed to refresh GDELT data: ${err.message}`;
		} finally {
			isUpdatingFilter = false;
		}
	}

	// Legacy function for backward compatibility
	async function refreshData() {
		return await refreshDataFromServer('Goldstein scale change');
	}

	// Global function for popup buttons
	if (browser) {
		(window as any).filterByCountry = (countryCode: string) => {
			const newSelectedCountries = new Set<string>();
			newSelectedCountries.add(countryCode);
			selectedCountries = newSelectedCountries;
			updateMarkerVisibility();
		};

		(window as any).showEventMentions = (eventId: number) => {
			fetchMentions(eventId);
		};
	}

	onMount(async () => {
		if (browser) {
			try {
				// Import Leaflet dynamically
				// @ts-ignore - leaflet types not installed
				leaflet = await import('leaflet');
				
				// Fetch data from API endpoint with Goldstein filter
				const data = await fetchEvents();
				
				events = data.events || [];
				console.log('Loaded events:', events.length, events.slice(0, 3));
				
				// Extract unique countries for filter and sort by country name
				availableCountries = [...new Set(events.map(e => e.country).filter(c => c))].sort((a, b) => {
					const nameA = getCountryNameWithFallback(a, a);
					const nameB = getCountryNameWithFallback(b, b);
					return nameA.localeCompare(nameB);
				});
				
				// Extract date range from events
				const eventDates = events.map(e => e.date).filter(d => d);
				if (eventDates.length > 0) {
					const minDate = Math.min(...eventDates);
					const maxDate = Math.max(...eventDates);
					availableDateRange = [gdeltDateToInputDate(minDate), gdeltDateToInputDate(maxDate)];
					
					// Initialize date range to show all dates if not set
					if (!dateRange[0] && !dateRange[1]) {
						dateRange = [...availableDateRange];
					}
				}
				
				loading = false;
				
				// Initialize the map after DOM update
				setTimeout(() => {
					initializeMap();
				}, 100);
				
			} catch (err) {
				console.error('Error loading data:', err);
				error = 'Failed to load GDELT data. Please check the database connection.';
				loading = false;
			}
		}
	});

	function initializeMap() {
		console.log('Initializing map...', { leaflet: !!leaflet, mapContainer: !!mapContainer, eventsCount: events.length });
		if (!leaflet || !mapContainer) return;
		
		// Create the map
		map = leaflet.map(mapContainer).setView([20, 0], 2);
		
		// Add tile layer with English labels
		leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
			attribution: '© Esri, © OpenStreetMap contributors',
			maxZoom: 19
		}).addTo(map);
		
		// Add markers for each event
		events.forEach(event => {
			if (event.lat && event.lng) {
				const eventType = getEventType(event.eventCode);
				const color = getEventTypeColor(event.eventCode);
				const marker = leaflet.circleMarker([event.lat, event.lng], {
					radius: Math.abs(event.goldstein || 1) * 1.5 + 4,
					fillColor: color,
					color: '#fff',
					weight: 1,
					opacity: 1,
					fillOpacity: 0.8
				}).addTo(map);
				
				// Store marker for toggling
				markers[event.id] = marker;
				
				// Add click handler for country selection
				marker.on('click', (e: any) => {
					e.originalEvent.stopPropagation(); // Prevent map click

					// Select this country and deselect 'all'
					const newSelectedCountries = new Set<string>();
					newSelectedCountries.add(event.country);
					selectedCountries = newSelectedCountries;
					
					// Update marker visibility
					updateMarkerVisibility();
				});

				// Add popup with event details
				const eventTypeConfig = eventTypes[eventType];
				marker.bindPopup(`
					<div class="p-3 max-w-sm">
						<h3 class="font-bold text-sm mb-2">Event ${event.id}</h3>
						<div class="flex items-center mb-2">
							<div class="w-3 h-3 rounded-full mr-2" style="background-color: ${color}"></div>
							<span class="text-xs font-medium">${eventTypeConfig?.label || 'Other'}</span>
						</div>
						<p class="text-xs mb-1"><strong>Type:</strong> ${eventTypeConfig?.description || 'Unknown event type'}</p>
						<p class="text-xs mb-1"><strong>Location:</strong> ${event.location || 'Unknown'}</p>
						<p class="text-xs mb-1"><strong>Country:</strong> ${getCountryNameWithFallback(event.country, `Unknown (${event.country})`)}</p>
						<p class="text-xs mb-1"><strong>Actor 1:</strong> ${event.actor1 || 'Unknown'}</p>
						<p class="text-xs mb-1"><strong>Actor 2:</strong> ${event.actor2 || 'Unknown'}</p>
						<p class="text-xs mb-1"><strong>Event Code:</strong> ${event.eventCode}</p>
						<p class="text-xs mb-1"><strong>Goldstein Scale:</strong> ${event.goldstein?.toFixed(2) || 'N/A'}</p>
						<p class="text-xs mb-1"><strong>Tone:</strong> ${event.tone?.toFixed(2) || 'N/A'}</p>
						<p class="text-xs mb-2"><strong>Date:</strong> ${gdeltDateToInputDate(event.date)}</p>
						<div class="flex gap-2">
							<button onclick="window.filterByCountry('${event.country}')" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl transition-colors">
								Filter by ${getCountryNameWithFallback(event.country, event.country)}
							</button>
							<button onclick="window.showEventMentions(${event.id})" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl transition-colors">
								Show Related Mentions
							</button>
						</div>
					</div>
				`);
			}
		});
	}
	
	function getEventColor(goldstein: number): string {
		if (!goldstein) return '#999';
		if (goldstein > 5) return CHART.catGreen; // Green for very positive
		if (goldstein > 0) return CHART.catGreen; // Light green for positive
		if (goldstein > -5) return CHART.catOrange; // Orange for slightly negative
		return CHART.danger500; // Red for very negative
	}
</script>

<svelte:head>
	<title>GDELT World Events - Social Explorer</title>
	<meta name="description" content="A map of global news events from GDELT, with the people, places and themes behind them." />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<!-- Page Header -->
	<div class="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
		<!-- Background pattern -->
		<div class="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-slate-900/10 opacity-40"></div>
		
		<div class="relative max-w-7xl xl:max-w-full 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-5 xl:py-8">
			<div class="flex items-center justify-between">
				<div class="flex items-center">
					<div class="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl shadow-lg flex items-center justify-center mr-4 border border-white/20 backdrop-blur-sm">
						<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
					</div>
					<div>
						<h1 class="text-2xl xl:text-3xl 2xl:text-4xl font-bold text-white mb-1 xl:mb-2">GDELT World Events</h1>
						<p class="text-sm xl:text-base 2xl:text-lg text-slate-300">
							Real-time global events visualization powered by GDELT database
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="max-w-7xl xl:max-w-full 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8 xl:py-12">

		{#if loading}
			<div class="flex items-center justify-center h-96 bg-white rounded-xl shadow-sm">
				<div class="text-center">
					<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p class="text-gray-600 font-medium">Loading GDELT events...</p>
					<p class="text-sm text-gray-500 mt-2">Fetching global event data from database</p>
				</div>
			</div>
		{:else if gdeltUnavailable}
			<DataUnavailable
				title="No GDELT events are loaded"
				description="The world map shows news events from the GDELT Project. It fills in once GDELT data has been loaded into the database." />
		{:else if error}
			<div class="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-400">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="ml-3">
						<h3 class="text-sm font-medium text-red-800">Error Loading Data</h3>
						<p class="text-sm text-red-700 mt-1">{error}</p>
						<p class="text-xs text-red-600 mt-2">Check that the database is running, then reload the page.</p>
						<button 
							on:click={() => error = ''}
							class="text-xs text-red-600 hover:text-red-800 mt-2 underline"
						>
							Dismiss
						</button>
					</div>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 xl:grid-cols-5 lg:grid-cols-4 gap-6 xl:gap-8">
				<!-- Filters Panel -->
				<div class="xl:col-span-1 lg:col-span-1">
					<div class="bg-white rounded-xl shadow-sm p-6 sticky top-4 min-h-screen lg:min-h-[calc(100vh-8rem)] xl:min-h-[calc(100vh-6rem)] relative">
						
						<!-- Loading Overlay for Filter Panel -->
						{#if isUpdatingFilter}
							<div class="absolute inset-0 bg-white/90 rounded-xl flex items-center justify-center z-40">
								<div class="text-center">
									<div class="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600 mx-auto mb-3"></div>
									<div class="text-sm font-medium text-gray-700">Updating filters...</div>
									<div class="text-xs text-gray-500 mt-1">Please wait</div>
								</div>
							</div>
						{/if}
						<!-- Reset Button -->
						<div class="flex items-center justify-between mb-6 xl:mb-8">
							<div class="flex items-center">
								<div class="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mr-3">
									<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
									</svg>
								</div>
								<h3 class="text-lg xl:text-xl font-semibold text-gray-900">Filters</h3>
							</div>
							<button
								on:click={resetFilters}
								disabled={isUpdatingFilter}
								class="text-xs xl:text-sm px-3 xl:px-4 py-1.5 xl:py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Reset All
							</button>
						</div>
						
						<!-- Date Range Filter -->
						<div class="mb-6 xl:mb-8 pb-4 xl:pb-6 border-b border-gray-200">
							<div class="flex items-center mb-4 xl:mb-6">
								<div class="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mr-3">
									<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
									</svg>
								</div>
								<span class="text-sm xl:text-base font-medium text-gray-900">Date Range</span>
							</div>
							
							<div class="space-y-4">
								<div class="grid grid-cols-1 gap-3">
									<!-- From Date -->
									<div class="relative">
										<label class="block text-xs xl:text-sm font-medium text-gray-700 mb-2">From Date</label>
										<div class="relative">
											<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
												<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
												</svg>
											</div>
											<input
												type="date"
												bind:value={dateRange[0]}
												min={availableDateRange[0]}
												max={availableDateRange[1]}
												disabled={isUpdatingFilter}
												class="w-full pl-10 pr-3 py-2.5 xl:py-3 text-sm xl:text-base border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
											/>
										</div>
									</div>
									
									<!-- To Date -->
									<div class="relative">
										<label class="block text-xs xl:text-sm font-medium text-gray-700 mb-2">To Date</label>
										<div class="relative">
											<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
												<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
												</svg>
											</div>
											<input
												type="date"
												bind:value={dateRange[1]}
												min={availableDateRange[0]}
												max={availableDateRange[1]}
												disabled={isUpdatingFilter}
												class="w-full pl-10 pr-3 py-2.5 xl:py-3 text-sm xl:text-base border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
											/>
										</div>
									</div>
								</div>
								
								{#if availableDateRange[0] && availableDateRange[1]}
									<div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-200">
										<div class="flex items-center text-xs text-blue-700">
											<svg class="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
											</svg>
											<span class="font-medium">Available range: {availableDateRange[0]} to {availableDateRange[1]}</span>
										</div>
									</div>
								{/if}
								
								<!-- Quick Select Buttons -->
								<div class="grid grid-cols-2 gap-2">
									<button
										on:click={() => {
											const today = new Date();
											const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
											dateRange[0] = lastWeek.toISOString().split('T')[0];
											dateRange[1] = today.toISOString().split('T')[0];
										}}
										disabled={isUpdatingFilter}
										class="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Last 7 days
									</button>
									<button
										on:click={() => {
											dateRange = [...availableDateRange];
										}}
										disabled={isUpdatingFilter}
										class="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										All dates
									</button>
								</div>
							</div>
						</div>
						
						<!-- Event Types Section -->
						<div class="mb-6 xl:mb-8">
							<h4 class="text-sm xl:text-base font-medium text-gray-900 mb-3 xl:mb-4">Event Types</h4>
					
							<!-- All Events Toggle -->
							<div class="mb-4">
							<button
								on:click={() => toggleEventType('all')}
								disabled={isToggling}
								class="flex items-center w-full p-3 rounded-xl transition-all duration-200 {activeEventTypes.has('all') ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 shadow-sm' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} border {isToggling ? 'opacity-60 cursor-not-allowed' : ''}"
							>
							<div class="w-4 h-4 rounded-full bg-gray-400 mr-3"></div>
							<div class="flex-1 text-left">
								<div class="text-sm font-medium text-gray-900">All Events</div>
								<div class="text-xs text-gray-500">Show all event types</div>
							</div>
							<div class="text-xs font-medium text-gray-600">
								{visibleEvents.length}
							</div>
						</button>
					</div>

							<!-- Individual Event Types -->
							<div class="space-y-2 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
							{#each Object.entries(eventTypes) as [key, eventType]}
								{@const eventCount = visibleEvents.filter((e: any) => getEventType(e.eventCode) === key).length}
								{@const totalEventCount = events.filter((e: any) => getEventType(e.eventCode) === key).length}
								{#if totalEventCount > 0}
									<button
										on:click={() => toggleEventType(key)}
										disabled={isToggling}
										class="flex items-center w-full p-3 rounded-xl transition-all duration-200 {activeEventTypes.has(key) ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 shadow-sm' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} border text-left group {isToggling ? 'opacity-60 cursor-not-allowed' : ''}"
									>
									<div 
										class="w-4 h-4 rounded-full mr-3 flex-shrink-0" 
										style="background-color: {eventType.color}"
									></div>
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium text-gray-900 truncate">
											{eventType.label}
										</div>
										<div class="text-xs text-gray-500 truncate">
											{eventType.description}
										</div>
									</div>
									<div class="text-xs font-medium text-gray-600 ml-2">
										{eventCount}
									</div>
								</button>
							{/if}
							{/each}
							</div>
						</div>

						<!-- Goldstein Scale Filter -->
						<div class="mb-6 xl:mb-8 pt-4 xl:pt-6 border-t border-gray-200">
							<div class="flex items-center justify-between mb-3 xl:mb-4">
								<div class="flex items-center">
									<svg class="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
									</svg>
									<span class="text-sm font-medium text-gray-900">Goldstein Scale</span>
								</div>
								<button
									on:click={refreshData}
									disabled={isUpdatingFilter}
									class="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
								>
									{#if isUpdatingFilter}
										<svg class="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Updating...
									{:else}
										<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
										</svg>
										Refresh
									{/if}
								</button>
							</div>
							
							<div class="space-y-3">
								<!-- Range Display -->
								<div class="flex justify-between text-xs">
									<span class="text-red-600 font-medium">Conflict: {goldsteinRange[0]}</span>
									<span class="text-blue-600 font-medium">Cooperation: {goldsteinRange[1]}</span>
								</div>
								
								<!-- Dual Range Slider -->
								<div class="relative h-6">
									<input
										type="range"
										min="-10"
										max="10"
										step="0.1"
										bind:value={goldsteinRange[0]}
										on:input={handleGoldsteinChange}
										class={rangeSliderClass}
										style="z-index: 2; pointer-events: auto;"
									/>
									<input
										type="range"
										min="-10"
										max="10"
										step="0.1"
										bind:value={goldsteinRange[1]}
										on:input={handleGoldsteinChange}
										class={rangeSliderClass}
										style="z-index: 3; pointer-events: auto;"
									/>
									<div class="absolute top-1 w-full h-2 bg-gray-200 rounded-xl" style="z-index: 1;"></div>
									
									<!-- Scale Labels -->
									<div class="flex justify-between text-xs text-gray-500 mt-6">
										<span>-10</span>
										<span>0</span>
										<span>+10</span>
									</div>
								</div>
								
								<!-- Manual Entry Fields -->
								<div class="grid grid-cols-2 gap-2">
									<div>
										<label class="block text-xs text-gray-500 mb-1">Min</label>
										<input
											type="number"
											min="-10"
											max="10"
											step="0.1"
											bind:value={goldsteinMin}
											on:change={handleManualEntry}
											class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
									<div>
										<label class="block text-xs text-gray-500 mb-1">Max</label>
										<input
											type="number"
											min="-10"
											max="10"
											step="0.1"
											bind:value={goldsteinMax}
											on:change={handleManualEntry}
											class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
								</div>
								
								<!-- Scale Description -->
								<div class="text-xs text-gray-500 space-y-1">
									<div class="flex items-center">
										<div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
										<span>Negative: Conflict, threats, violence</span>
									</div>
									<div class="flex items-center">
										<div class="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
										<span>Positive: Cooperation, agreements, aid</span>
									</div>
								</div>
							</div>
						</div>

						<!-- Average Tone Filter -->
						<div class="mb-6 xl:mb-8 pt-4 xl:pt-6 border-t border-gray-200">
							<div class="flex items-center mb-3 xl:mb-4">
								<svg class="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h4a1 1 0 011 1v2m-6 0h8m-8 0a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2m-8 0V4"></path>
								</svg>
								<span class="text-sm font-medium text-gray-900">Average Tone</span>
							</div>
							
							<div class="space-y-3">
								<!-- Range Display -->
								<div class="flex justify-between text-xs">
									<span class="text-red-600 font-medium">Negative: {toneRange[0]}</span>
									<span class="text-blue-600 font-medium">Positive: {toneRange[1]}</span>
								</div>
								
								<!-- Dual Range Slider -->
								<div class="relative h-6">
									<input
										type="range"
										min="-50"
										max="50"
										step="0.5"
										bind:value={toneRange[0]}
										on:input={handleToneChange}
										class={rangeSliderClass}
										style="z-index: 2; pointer-events: auto;"
									/>
									<input
										type="range"
										min="-50"
										max="50"
										step="0.5"
										bind:value={toneRange[1]}
										on:input={handleToneChange}
										class={rangeSliderClass}
										style="z-index: 3; pointer-events: auto;"
									/>
									<div class="absolute top-1 w-full h-2 bg-gray-200 rounded-xl" style="z-index: 1;"></div>
									
									<!-- Scale Labels -->
									<div class="flex justify-between text-xs text-gray-500 mt-6">
										<span>-50</span>
										<span>0</span>
										<span>+50</span>
									</div>
								</div>
								
								<!-- Manual Entry Fields -->
								<div class="grid grid-cols-2 gap-2">
									<div>
										<label class="block text-xs text-gray-500 mb-1">Min</label>
										<input
											type="number"
											min="-50"
											max="50"
											step="0.5"
											bind:value={toneMin}
											on:change={handleToneManualEntry}
											class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
									<div>
										<label class="block text-xs text-gray-500 mb-1">Max</label>
										<input
											type="number"
											min="-50"
											max="50"
											step="0.5"
											bind:value={toneMax}
											on:change={handleToneManualEntry}
											class="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
										/>
									</div>
								</div>
								
								<!-- Scale Description -->
								<div class="text-xs text-gray-500 space-y-1">
									<div class="flex items-center">
										<div class="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
										<span>Negative: Critical, pessimistic tone</span>
									</div>
									<div class="flex items-center">
										<div class="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
										<span>Positive: Supportive, optimistic tone</span>
									</div>
								</div>
							</div>
						</div>

						<!-- Country Filter -->
						<div class="pt-4 xl:pt-6 border-t border-gray-200">
							<div class="flex items-center mb-3 xl:mb-4">
								<svg class="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
								</svg>
								<span class="text-sm font-medium text-gray-900">Countries</span>
							</div>
							
							<div class="space-y-2">
								<!-- Country Search Box -->
								<div class="mb-3">
									<div class="relative">
										<input
											type="text"
											placeholder="Search countries..."
											bind:value={countrySearchTerm}
											class="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
										/>
										<svg class="absolute left-2.5 top-2.5 w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
										</svg>
									</div>
								</div>
								
								<!-- All Countries Toggle -->
								<button
									on:click={() => toggleCountry('all')}
									class="flex items-center w-full p-2 rounded-xl transition-all duration-200 hover:bg-gray-100 border border-gray-200 text-left"
								>
									<div class="flex items-center justify-center w-4 h-4 mr-3 border border-gray-300 rounded {selectedCountries.has('all') ? 'bg-blue-600 border-blue-600' : 'bg-white'}">
										{#if selectedCountries.has('all')}
											<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
											</svg>
										{/if}
									</div>
									<span class="text-xs font-medium text-gray-900">All Countries</span>
									<span class="ml-auto text-xs text-gray-600">{new Set(eventsForCountryCounts.map((e: any) => e.country)).size}</span>
								</button>

								<!-- Individual Countries -->
								<div class="max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
									{#each filteredCountries as country}
										{@const countryEventCount = eventsForCountryCounts.filter((e: any) => e.country === country).length}
										{@const totalEventCount = events.filter((e: any) => e.country === country).length}
										{@const countryName = getCountryNameWithFallback(country, `Unknown (${country})`)}
										{#if totalEventCount > 0}
											<button
												on:click={() => toggleCountry(country)}
												class="flex items-center w-full p-2 rounded-xl transition-all duration-200 hover:bg-gray-100 border border-gray-200 text-left"
											>
												<div class="flex items-center justify-center w-4 h-4 mr-3 border border-gray-300 rounded {selectedCountries.has(country) ? 'bg-blue-600 border-blue-600' : 'bg-white'}">
													{#if selectedCountries.has(country)}
														<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
															<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
														</svg>
													{/if}
												</div>
												<span class="text-xs font-medium text-gray-900 truncate flex-1">{countryName}</span>
												<span class="ml-2 text-xs text-gray-600">{countryEventCount}</span>
											</button>
										{/if}
									{/each}
								</div>
								
								<!-- Global South Countries Toggle -->
								<div class="mt-3 pt-3 border-t border-gray-100">
									<button
										on:click={toggleGlobalSouthCountries}
										class="flex items-center w-full p-2 rounded-xl transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-amber-50 border border-blue-200 text-left bg-gradient-to-r from-blue-25 to-amber-25"
									>
										<div class="flex items-center justify-center w-4 h-4 mr-3 border border-blue-300 rounded {allGlobalSouthSelected ? 'bg-blue-500 border-blue-500' : 'bg-white'}">
											{#if allGlobalSouthSelected}
												<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
													<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
												</svg>
											{/if}
										</div>
										<div class="flex-1">
											<span class="text-xs font-medium text-blue-800">All Global South Countries</span>
											<div class="text-xs text-blue-600 mt-0.5">
												{globalSouthCountryCodes.length} countries available
											</div>
										</div>
										<div class="flex items-center text-xs text-blue-700">
											<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
											</svg>
											{globalSouthCountryCodes.filter(code => selectedCountries.has(code)).length}/{globalSouthCountryCodes.length}
										</div>
									</button>
								</div>
							</div>
						</div>

						<!-- Legend Footer -->
						<div class="mt-auto pt-4 border-t border-gray-200">
							<div class="flex items-center text-xs text-gray-500">
								<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
								</svg>
								Click types to filter map events
							</div>
							<p class="text-xs text-gray-500 mt-1">Based on GDELT CAMEO codes</p>
						</div>
					</div>
				</div>

				<!-- Map Container -->
				<div class="xl:col-span-4 lg:col-span-3">
					<!-- Sticky wrapper: stats + map pin at top while scrolling mentions -->
					<div class="sticky top-0 z-10 space-y-4 pb-4 bg-gray-50">
					<!-- Stats Cards -->
					<div class="grid grid-cols-4 gap-3">
						<div class="bg-white rounded-lg shadow-sm px-3 py-2 text-center relative {isUpdatingFilter ? 'opacity-75' : ''}">
							{#if isUpdatingFilter}
								<div class="absolute top-1 right-1">
									<div class="animate-spin rounded-full h-3 w-3 border border-blue-200 border-t-blue-600"></div>
								</div>
							{/if}
							<div class="text-xl xl:text-2xl font-bold text-blue-600">{visibleEvents.length.toLocaleString()}</div>
							<div class="text-xs text-gray-600">Visible Events</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm px-3 py-2 text-center relative {isUpdatingFilter ? 'opacity-75' : ''}">
							{#if isUpdatingFilter}
								<div class="absolute top-1 right-1">
									<div class="animate-spin rounded-full h-3 w-3 border border-emerald-200 border-t-emerald-600"></div>
								</div>
							{/if}
							<div class="text-xl xl:text-2xl font-bold text-emerald-600">{new Set(visibleEvents.map((e: any) => e.country)).size}</div>
							<div class="text-xs text-gray-600">Countries</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm px-3 py-2 text-center relative {isUpdatingFilter ? 'opacity-75' : ''}">
							{#if isUpdatingFilter}
								<div class="absolute top-1 right-1">
									<div class="animate-spin rounded-full h-3 w-3 border border-amber-200 border-t-amber-600"></div>
								</div>
							{/if}
							<div class="text-xl xl:text-2xl font-bold text-signal-700">{Object.keys(eventTypes).filter(k => visibleEvents.some((e: any) => getEventType(e.eventCode) === k)).length}</div>
							<div class="text-xs text-gray-600">Event Types</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm px-3 py-2 text-center relative {isUpdatingFilter ? 'opacity-75' : ''}">
							{#if isUpdatingFilter}
								<div class="absolute top-1 right-1">
									<div class="animate-spin rounded-full h-3 w-3 border border-blue-200 border-t-blue-600"></div>
								</div>
							{/if}
							{#if true}
								{@const avgTone = visibleEvents.length > 0 ? Math.round(visibleEvents.reduce((acc: number, e: any) => acc + (e.tone || 0), 0) / visibleEvents.length * 100) / 100 : 0}
								<div class="text-base xl:text-lg font-bold text-blue-600">{getToneDescription(avgTone)}</div>
								<div class="text-sm font-semibold text-blue-500">{avgTone}</div>
								<div class="text-xs text-gray-600">Avg Tone</div>
							{/if}
						</div>
					</div>

					<!-- Map -->
					<div class="bg-white rounded-xl shadow-sm overflow-hidden">
						<div class="px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
							<div class="flex items-center justify-between">
								<div class="flex items-center">
									<div class="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center mr-2">
										<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
										</svg>
									</div>
									<h2 class="text-base xl:text-lg font-semibold text-gray-900">Global Events Map</h2>
								</div>
								<div class="flex items-center space-x-3">
									{#if visibleEvents.length > 0 && visibleEvents.length < events.length}
										<button
											on:click={() => fetchAllMentionsForVisible()}
											disabled={loadingMentions || isBatchLoading}
											class="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white px-2 py-1 rounded-lg transition-all duration-200 flex items-center gap-1.5 min-w-max"
										>
											{#if loadingMentions || isBatchLoading}
												<div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-white"></div>
												<span class="text-blue-100">
													{#if isBatchLoading}
														Batch {batchProgress.current}/{batchProgress.total} ({batchProgress.loadedMentions} mentions)
													{:else}
														Processing...
													{/if}
												</span>
											{:else}
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
												</svg>
												<span>
													Show All Mentions ({visibleEvents.length})
												</span>
											{/if}
										</button>
									{/if}
									<div class="text-xs text-gray-600">
										{visibleEvents.length} of {events.length} events
									</div>
									<div class="flex items-center text-xs text-gray-500">
										<div class="w-1.5 h-1.5 {isUpdatingFilter ? 'bg-blue-400' : 'bg-blue-400'} rounded-full animate-pulse mr-1"></div>
										{isUpdatingFilter ? 'Refreshing...' : 'Live'}
									</div>
								</div>
							</div>
						</div>
						<div class="relative">
							<div bind:this={mapContainer} class="h-[calc(100vh-220px)] min-h-[350px] max-h-[700px] w-full"></div>
							
							<!-- Loading Overlay -->
							{#if isUpdatingFilter}
								<div class="absolute inset-0 bg-white/75 flex items-center justify-center z-50">
									<div class="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center">
										<div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
										<div class="text-lg font-semibold text-gray-900 mb-2">Refreshing Data</div>
										<div class="text-sm text-gray-600 text-center">
											Fetching updated events from database...
										</div>
									</div>
								</div>
							{/if}
							
							<!-- Bulk Mentions Processing Indicator -->
							{#if (loadingMentions || isBatchLoading) && showMentions}
								<div class="absolute top-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 z-40">
									<div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-white"></div>
									<span class="text-sm font-medium">
										{#if isBatchLoading}
											Loading batch {batchProgress.current}/{batchProgress.total}...
										{:else}
											Processing mentions...
										{/if}
									</span>
								</div>
							{/if}
						</div>
					</div>
					</div>
					<!-- END sticky wrapper -->

					<!-- Mentions Section -->
					{#if showMentions}
						<div class="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
							<div class="p-4 xl:p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
								<div class="flex items-center justify-between">
									<div class="flex items-center">
										<div class="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mr-3">
											<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
											</svg>
										</div>
										<h2 class="text-xl xl:text-2xl font-semibold text-gray-900">Related Mentions</h2>
									</div>
									<div class="flex items-center space-x-4 xl:space-x-6">
										<div class="text-sm xl:text-base text-gray-600">
											{#if selectedEventId}
												Event ID: {selectedEventId}
											{:else}
												All Filtered Events ({mentions.length} mentions)
											{/if}
										</div>
										<div class="flex items-center space-x-2">
											<button 
												on:click={exportMentionsToCSV}
												disabled={filteredMentions.length === 0}
												class="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 bg-blue-50 hover:bg-blue-100 disabled:bg-gray-50 px-3 py-1 rounded transition-colors flex items-center gap-1"
												title="Export filtered mentions to CSV"
											>
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V11a2 2 0 01-2 2z"></path>
												</svg>
												Export CSV
											</button>
											<button 
												on:click={() => showMentions = false}
												class="text-sm text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition-colors"
											>
												Close
											</button>
										</div>
									</div>
								</div>
							</div>
							
							<div class="p-4 xl:p-6">
								{#if loadingMentions}
									<div class="flex items-center justify-center py-16">
										<div class="text-center">
											<div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
											<div class="text-lg font-semibold text-gray-900 mb-2">
												{#if selectedEventId}
													Loading mentions for event {selectedEventId}...
												{:else}
													Processing {visibleEvents.length} events for mentions...
												{/if}
											</div>
											<div class="text-sm text-gray-600 mb-3">
												{#if selectedEventId}
													Fetching related mentions and media sources
												{:else}
													Analyzing mentions across all filtered events
												{/if}
											</div>
											<div class="flex items-center justify-center space-x-2 text-xs text-gray-500">
												<div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
												<span>Database query in progress</span>
												<div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style="animation-delay: 0.5s"></div>
											</div>
										</div>
									</div>
								{:else if mentionsError}
									{#if mentionsError.startsWith('Note:')}
										<!-- Information notice for data limitations -->
										<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
											<div class="flex">
												<div class="flex-shrink-0">
													<svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
														<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
													</svg>
												</div>
												<div class="ml-3">
													<h3 class="text-sm font-medium text-blue-800">Data Limitation</h3>
													<p class="text-sm text-blue-700 mt-1">{mentionsError}</p>
												</div>
											</div>
										</div>
									{:else}
										<!-- Regular error display -->
										<div class="bg-red-50 border border-red-200 rounded-xl p-4">
											<div class="flex">
												<div class="flex-shrink-0">
													<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
														<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
													</svg>
												</div>
												<div class="ml-3">
													<h3 class="text-sm font-medium text-red-800">Error Loading Mentions</h3>
													<p class="text-sm text-red-700 mt-1">{mentionsError}</p>
												</div>
											</div>
										</div>
									{/if}
								{:else if mentions.length === 0}
									<div class="text-center py-12">
										<svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
										</svg>
										<h3 class="mt-4 text-lg font-medium text-gray-900">No mentions found</h3>
										<p class="mt-2 text-sm text-gray-500">There are no mentions available for this event.</p>
									</div>
								{:else}
									<!-- Data Limitation Notice -->
									{#if mentionsLimitationNotice}
										<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
											<div class="flex">
												<div class="flex-shrink-0">
													<svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
														<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
													</svg>
												</div>
												<div class="ml-3">
													<h3 class="text-sm font-medium text-blue-800">Data Limitation</h3>
													<p class="text-sm text-blue-700 mt-1">{mentionsLimitationNotice}</p>
												</div>
											</div>
										</div>
									{/if}
									
									<!-- Search and Filter Controls -->
									<div class="mb-4 flex flex-col sm:flex-row gap-4">
										<div class="flex-1">
											<label class="block text-sm font-medium text-gray-700 mb-2">Search Sources & Identifiers</label>
											<input
												type="text"
												bind:value={mentionsSearchTerm}
												placeholder="Search by source name or identifier..."
												class="w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
											/>
										</div>
										<div class="sm:w-48">
											<label class="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
											<select
												bind:value={mentionsTypeFilter}
												class="w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
											>
												<option value="">All Types</option>
												<option value="1">Web News</option>
												<option value="2">Print News</option>
												<option value="3">Broadcast News</option>
											</select>
										</div>
									</div>

									<!-- Pagination Controls (Top) -->
									{#if filteredMentions.length > itemsPerPageOptions[0]}
										{@const totalPages = Math.ceil(filteredMentions.length / itemsPerPage)}
										
										<div class="mb-6 flex flex-col lg:flex-row items-center justify-between gap-4 border-b pb-4">
											<!-- Results per page selector -->
											<div class="flex items-center gap-3">
												<label class="text-sm text-gray-700 font-medium">Show:</label>
												<select
													bind:value={itemsPerPage}
													on:change={() => changeItemsPerPage(itemsPerPage)}
													class="px-3 py-1 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
												>
													{#each itemsPerPageOptions as option}
														<option value={option}>{option} per page</option>
													{/each}
												</select>
											</div>

											<!-- Page Navigation -->
											{#if totalPages > 1}
												{@const startPage = Math.max(1, currentPage - 2)}
												{@const endPage = Math.min(totalPages, currentPage + 2)}
												
												<div class="flex items-center space-x-2">
													<button
														on:click={() => goToPage(currentPage - 1)}
														disabled={currentPage === 1}
														class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded transition-colors"
													>
														Previous
													</button>
													
													{#if startPage > 1}
														<button on:click={() => goToPage(1)} class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors">1</button>
														{#if startPage > 2}<span class="text-gray-500">...</span>{/if}
													{/if}
													
													{#each Array.from({length: endPage - startPage + 1}, (_, i) => startPage + i) as page}
														<button
															on:click={() => goToPage(page)}
															class="px-3 py-1 text-sm rounded transition-colors {page === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
														>
															{page}
														</button>
													{/each}
													
													{#if endPage < totalPages}
														{#if endPage < totalPages - 1}<span class="text-gray-500">...</span>{/if}
														<button on:click={() => goToPage(totalPages)} class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors">{totalPages}</button>
													{/if}
													
													<button
														on:click={() => goToPage(currentPage + 1)}
														disabled={currentPage === totalPages}
														class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded transition-colors"
													>
														Next
													</button>
												</div>
											{/if}
										</div>
									{/if}

									<div class="overflow-x-auto">
										<table class="min-w-full divide-y divide-gray-200 table-auto">
											<thead class="bg-gray-50">
												<tr>
													<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortMentions('mentionSourceName')}>
														<div class="flex items-center">
															Source
															{#if mentionsSortField === 'mentionSourceName'}
																<svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={mentionsSortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}></path>
																</svg>
															{/if}
														</div>
													</th>
													<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortMentions('mentionType')}>
														<div class="flex items-center">
															Type
															{#if mentionsSortField === 'mentionType'}
																<svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={mentionsSortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}></path>
																</svg>
															{/if}
														</div>
													</th>
													<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortMentions('mentionTimeDate')}>
														<div class="flex items-center">
															Mention Date
															{#if mentionsSortField === 'mentionTimeDate'}
																<svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={mentionsSortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}></path>
																</svg>
															{/if}
														</div>
													</th>
													<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortMentions('confidence')}>
														<div class="flex items-center">
															Confidence
															{#if mentionsSortField === 'confidence'}
																<svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={mentionsSortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}></path>
																</svg>
															{/if}
														</div>
													</th>
													<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortMentions('mentionDocTone')}>
														<div class="flex items-center">
															Doc Tone
															{#if mentionsSortField === 'mentionDocTone'}
																<svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={mentionsSortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}></path>
																</svg>
															{/if}
														</div>
													</th>
													<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" on:click={() => sortMentions('mentionDocLen')}>
														<div class="flex items-center">
															Doc Length
															{#if mentionsSortField === 'mentionDocLen'}
																<svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={mentionsSortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}></path>
																</svg>
															{/if}
														</div>
													</th>
													<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Identifier</th>
												</tr>
											</thead>
											<tbody class="bg-white divide-y divide-gray-200">
												{#each displayedMentions as mention, index}
													<tr class="hover:bg-gray-50">
														<td class="px-4 py-3 text-sm text-gray-900 font-medium max-w-xs truncate" title="{mention.mentionSourceName || 'Unknown'}">
															{mention.mentionSourceName || 'Unknown'}
														</td>
														<td class="px-4 py-3 text-sm text-gray-600">
															{#if mention.mentionType}
																<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getMentionTypeColor(mention.mentionType)}">
																	{getMentionTypeLabel(mention.mentionType)}
																</span>
															{:else}
																<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
																	N/A
																</span>
															{/if}
														</td>
														<td class="px-4 py-3 text-sm text-gray-600">
															{#if mention.mentionTimeDate}
																{@const formattedDate = gdeltDateToInputDate(mention.mentionTimeDate)}
																{#if formattedDate}
																	<span title="Raw: {mention.mentionTimeDate}">{formattedDate}</span>
																{:else}
																	<span class="text-gray-500" title="Raw: {mention.mentionTimeDate}">Invalid date</span>
																{/if}
															{:else}
																<span class="text-gray-500">N/A</span>
															{/if}
														</td>
														<td class="px-4 py-3 text-sm text-gray-600">
															{#if mention.confidence}
																<div class="flex items-center">
																	<div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
																		<div class="bg-blue-600 h-2 rounded-full" style="width: {mention.confidence}%"></div>
																	</div>
																	<span class="text-xs">{mention.confidence}%</span>
																</div>
															{:else}
																N/A
															{/if}
														</td>
														<td class="px-4 py-3 text-sm text-gray-600">
															{#if mention.mentionDocTone}
																<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {mention.mentionDocTone > 0 ? 'bg-blue-100 text-blue-800' : mention.mentionDocTone < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}">
																	{mention.mentionDocTone.toFixed(2)}
																</span>
															{:else}
																N/A
															{/if}
														</td>
														<td class="px-4 py-3 text-sm text-gray-600">
															{mention.mentionDocLen?.toLocaleString() || 'N/A'}
														</td>
														<td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title="{mention.mentionIdentifier || 'N/A'}">
															{#if mention.mentionIdentifier && mention.mentionIdentifier.startsWith('http')}
																<a href="{mention.mentionIdentifier}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">
																	Link
																</a>
															{:else}
																{mention.mentionIdentifier || 'N/A'}
															{/if}
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
									
									<!-- Pagination Controls (Bottom) -->
									{#if filteredMentions.length > itemsPerPageOptions[0]}
										{@const totalPages = Math.ceil(filteredMentions.length / itemsPerPage)}
										
										<div class="mt-6 flex flex-col lg:flex-row items-center justify-between gap-4 border-t pt-4">
											<!-- Results per page selector -->
											<div class="flex items-center gap-3">
												<label class="text-sm text-gray-700 font-medium">Show:</label>
												<select
													bind:value={itemsPerPage}
													on:change={() => changeItemsPerPage(itemsPerPage)}
													class="px-3 py-1 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
												>
													{#each itemsPerPageOptions as option}
														<option value={option}>{option} per page</option>
													{/each}
												</select>
											</div>

											<!-- Page Navigation -->
											{#if totalPages > 1}
												{@const startPage = Math.max(1, currentPage - 2)}
												{@const endPage = Math.min(totalPages, currentPage + 2)}
												
												<div class="flex items-center space-x-2">
													<button
														on:click={() => goToPage(currentPage - 1)}
														disabled={currentPage === 1}
														class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded transition-colors"
													>
														Previous
													</button>
													
													{#if startPage > 1}
														<button on:click={() => goToPage(1)} class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors">1</button>
														{#if startPage > 2}<span class="text-gray-500">...</span>{/if}
													{/if}
													
													{#each Array.from({length: endPage - startPage + 1}, (_, i) => startPage + i) as page}
														<button
															on:click={() => goToPage(page)}
															class="px-3 py-1 text-sm rounded transition-colors {page === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}"
														>
															{page}
														</button>
													{/each}
													
													{#if endPage < totalPages}
														{#if endPage < totalPages - 1}<span class="text-gray-500">...</span>{/if}
														<button on:click={() => goToPage(totalPages)} class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors">{totalPages}</button>
													{/if}
													
													<button
														on:click={() => goToPage(currentPage + 1)}
														disabled={currentPage === totalPages}
														class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded transition-colors"
													>
														Next
													</button>
												</div>
											{/if}
										</div>
									{/if}
									
									<div class="mt-4 text-sm text-gray-500 text-center">
										{#if filteredMentions.length > 0}
											{@const startIndex = (currentPage - 1) * itemsPerPage + 1}
											{@const endIndex = Math.min(currentPage * itemsPerPage, filteredMentions.length)}
											
											Showing {startIndex}-{endIndex} of {filteredMentions.length} filtered mention{filteredMentions.length !== 1 ? 's' : ''}
											({mentions.length} total)
											{#if selectedEventId}
												for Event ID {selectedEventId}
											{:else}
												for {visibleEvents.length} filtered events
												{#if isBatchLoading}
													<span class="text-blue-600 font-medium">
														(batch {batchProgress.current}/{batchProgress.total} loading...)
													</span>
												{/if}
											{/if}
										{:else}
											No mentions to display
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>

		{/if}
	</div>
</div>

<!-- Footer -->
<footer class="bg-gray-50 border-t border-gray-200">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
		<div class="flex flex-col sm:flex-row justify-between items-center">
			<!-- Brand -->
			<div class="flex items-center mb-4 sm:mb-0">
				<div class="h-6 w-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mr-2">
					<span class="text-white font-bold text-xs">SE</span>
				</div>
				<span class="text-sm text-gray-600">Social Explorer - GDELT World Events</span>
			</div>
			
			<!-- Links -->
			<div class="flex items-center space-x-6 text-sm text-gray-500">
				<span>Data Source: GDELT Project</span>
				<span class="text-gray-300">|</span>
				<span>Last Updated: {new Date().toLocaleDateString()}</span>
				<span class="text-gray-300">|</span>
				<a href="https://concepttocloud.com/" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 font-medium transition-colors">
					Concept to Cloud
				</a>
			</div>
		</div>
	</div>
</footer>