<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import Navigation from '$lib/components/Navigation.svelte';
	
	let mapContainer: HTMLDivElement;
	let map: any;
	let leaflet: any;
	let events: any[] = [];
	let loading = true;
	let error = '';
	let markers: any = {};
	let activeEventTypes = new Set(['all']);

	// GDELT Event Type Mappings (based on CAMEO codes)
	const eventTypes = {
		'verbal_cooperation': { 
			codes: ['10', '11', '12', '13', '14', '15', '16', '17'],
			label: 'Verbal Cooperation',
			color: '#22c55e',
			description: 'Make statement, comment, consult, engage in diplomatic cooperation'
		},
		'material_cooperation': {
			codes: ['20', '21', '22', '23', '24', '25', '26', '27'],
			label: 'Material Cooperation', 
			color: '#84cc16',
			description: 'Appeal, express intent to cooperate, provide aid'
		},
		'verbal_conflict': {
			codes: ['10', '11', '12', '13', '14', '15', '16', '17'].map(c => '1' + c),
			label: 'Verbal Conflict',
			color: '#f59e0b', 
			description: 'Demand, disapprove, reject, threaten, protest'
		},
		'material_conflict': {
			codes: ['18', '19', '20'],
			label: 'Material Conflict',
			color: '#ef4444',
			description: 'Exhibit force, reduce relations, coerce'
		},
		'diplomacy': {
			codes: ['30', '31', '32', '33', '34', '35', '36', '37'], 
			label: 'Diplomacy',
			color: '#3b82f6',
			description: 'Express intent to cooperate, consult, support'
		},
		'support': {
			codes: ['40', '41', '42', '43', '44', '45', '46'],
			label: 'Support & Agreements',
			color: '#06b6d4',
			description: 'Cooperate, agree, provide support'
		},
		'information': {
			codes: ['50', '51', '52', '53', '54', '55', '56', '57'],
			label: 'Information & Media',
			color: '#8b5cf6',
			description: 'Engage in symbolic acts, media statements'
		},
		'economic': {
			codes: ['60', '61', '62', '63', '64', '65', '66', '67'],
			label: 'Economic Actions',
			color: '#059669',
			description: 'Economic cooperation, trade, sanctions'
		},
		'political': {
			codes: ['70', '71', '72', '73', '74', '75', '76'],
			label: 'Political Actions', 
			color: '#dc2626',
			description: 'Provide diplomatic cooperation, host meetings'
		},
		'military': {
			codes: ['80', '81', '82', '83', '84', '85', '86', '87'],
			label: 'Military Actions',
			color: '#b91c1c',
			description: 'Military cooperation, exercises, operations'
		},
		'protests': {
			codes: ['14', '141', '142', '143', '144', '145'],
			label: 'Protests & Demonstrations',
			color: '#ea580c',
			description: 'Protests, demonstrations, strikes'
		},
		'violence': {
			codes: ['17', '18', '19', '190', '193', '194', '195'],
			label: 'Violence & Conflict',
			color: '#991b1b',
			description: 'Violence, fighting, armed conflict'
		}
	};

	function getEventType(eventCode: string): string {
		for (const [type, config] of Object.entries(eventTypes)) {
			if (config.codes.some(code => eventCode.startsWith(code))) {
				return type;
			}
		}
		return 'other';
	}

	function getEventTypeColor(eventCode: string): string {
		const type = getEventType(eventCode);
		return eventTypes[type]?.color || '#6b7280';
	}

	function toggleEventType(eventType: string) {
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
		updateMarkerVisibility();
	}

	function updateMarkerVisibility() {
		Object.entries(markers).forEach(([eventId, marker]) => {
			const event = events.find(e => e.id.toString() === eventId);
			if (event) {
				const eventType = getEventType(event.eventCode);
				const shouldShow = activeEventTypes.has('all') || activeEventTypes.has(eventType);
				
				if (shouldShow) {
					marker.addTo(map);
				} else {
					marker.remove();
				}
			}
		});
	}

	onMount(async () => {
		if (browser) {
			try {
				// Import Leaflet dynamically
				leaflet = await import('leaflet');
				
				// Fetch data from API endpoint
				const response = await fetch('/api/gdelt');
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				
				const data = await response.json();
				if (data.error) {
					throw new Error(data.error);
				}
				
				events = data.events || [];
				console.log('Loaded events:', events.length, events.slice(0, 3));
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
		
		// Add tile layer
		leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap contributors'
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
						<p class="text-xs mb-1"><strong>Country:</strong> ${event.country || 'Unknown'}</p>
						<p class="text-xs mb-1"><strong>Actor 1:</strong> ${event.actor1 || 'Unknown'}</p>
						<p class="text-xs mb-1"><strong>Actor 2:</strong> ${event.actor2 || 'Unknown'}</p>
						<p class="text-xs mb-1"><strong>Event Code:</strong> ${event.eventCode}</p>
						<p class="text-xs mb-1"><strong>Goldstein Scale:</strong> ${event.goldstein?.toFixed(2) || 'N/A'}</p>
						<p class="text-xs mb-1"><strong>Tone:</strong> ${event.tone?.toFixed(2) || 'N/A'}</p>
						<p class="text-xs"><strong>Date:</strong> ${event.date}</p>
					</div>
				`);
			}
		});
	}
	
	function getEventColor(goldstein: number): string {
		if (!goldstein) return '#999';
		if (goldstein > 5) return '#22c55e'; // Green for very positive
		if (goldstein > 0) return '#84cc16'; // Light green for positive
		if (goldstein > -5) return '#f59e0b'; // Orange for slightly negative
		return '#ef4444'; // Red for very negative
	}
</script>

<svelte:head>
	<title>GDELT World Events Dashboard</title>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
	<!-- Page Header -->
	<div class="relative bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
		<!-- Background pattern -->
		<div class="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-slate-900/10 opacity-40"></div>
		
		<div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
			<div class="flex items-center justify-between">
				<div class="flex items-center">
					<div class="w-16 h-16 bg-gradient-to-br from-violet-400 to-purple-600 rounded-2xl shadow-lg flex items-center justify-center mr-6 border border-white/20 backdrop-blur-sm">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
					</div>
					<div>
						<h1 class="text-4xl font-bold text-white mb-2">GDELT World Events</h1>
						<p class="text-lg text-slate-300">
							Real-time global events visualization powered by GDELT database
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

		{#if loading}
			<div class="flex items-center justify-center h-96 bg-white rounded-lg shadow-sm">
				<div class="text-center">
					<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
					<p class="text-gray-600 font-medium">Loading GDELT events...</p>
					<p class="text-sm text-gray-500 mt-2">Fetching global event data from database</p>
				</div>
			</div>
		{:else if error}
			<div class="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-400">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="ml-3">
						<h3 class="text-sm font-medium text-red-800">Error Loading Data</h3>
						<p class="text-sm text-red-700 mt-1">{error}</p>
						<p class="text-xs text-red-600 mt-2">Please check the database connection and try again.</p>
					</div>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
				<!-- Event Type Legend -->
				<div class="lg:col-span-1">
					<div class="bg-white rounded-lg shadow-sm p-6 sticky top-4">
						<div class="flex items-center mb-6">
							<div class="w-8 h-8 bg-gradient-to-br from-violet-400 to-purple-600 rounded-lg flex items-center justify-center mr-3">
								<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
								</svg>
							</div>
							<h3 class="text-lg font-semibold text-gray-900">Event Types</h3>
						</div>
					
						<!-- All Events Toggle -->
						<div class="mb-4">
							<button
								on:click={() => toggleEventType('all')}
								class="flex items-center w-full p-3 rounded-lg transition-all duration-200 {activeEventTypes.has('all') ? 'bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200 shadow-sm' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} border"
							>
							<div class="w-4 h-4 rounded-full bg-gray-400 mr-3"></div>
							<div class="flex-1 text-left">
								<div class="text-sm font-medium text-gray-900">All Events</div>
								<div class="text-xs text-gray-500">Show all event types</div>
							</div>
							<div class="text-xs font-medium text-gray-600">
								{events.length}
							</div>
						</button>
					</div>

						<!-- Individual Event Types -->
						<div class="space-y-2 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
							{#each Object.entries(eventTypes) as [key, eventType]}
								{@const eventCount = events.filter(e => getEventType(e.eventCode) === key).length}
								{#if eventCount > 0}
									<button
										on:click={() => toggleEventType(key)}
										class="flex items-center w-full p-3 rounded-lg transition-all duration-200 {activeEventTypes.has(key) ? 'bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200 shadow-sm' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} border text-left group"
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

						<!-- Legend Footer -->
						<div class="mt-6 pt-4 border-t border-gray-200">
							<div class="flex items-center text-xs text-gray-500">
								<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
								</svg>
								Click types to filter map events
							</div>
							<p class="text-xs text-gray-400 mt-1">Based on GDELT CAMEO codes</p>
						</div>
					</div>
				</div>

				<!-- Map Container -->
				<div class="lg:col-span-3 space-y-6">
					<!-- Stats Cards -->
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div class="bg-white rounded-lg shadow-sm p-4 text-center">
							<div class="text-2xl font-bold text-violet-600 mb-1">{events.length.toLocaleString()}</div>
							<div class="text-sm text-gray-600">Total Events</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-4 text-center">
							<div class="text-2xl font-bold text-blue-600 mb-1">{new Set(events.map(e => e.country)).size}</div>
							<div class="text-sm text-gray-600">Countries</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-4 text-center">
							<div class="text-2xl font-bold text-green-600 mb-1">{Object.keys(eventTypes).filter(k => events.some(e => getEventType(e.eventCode) === k)).length}</div>
							<div class="text-sm text-gray-600">Event Types</div>
						</div>
						<div class="bg-white rounded-lg shadow-sm p-4 text-center">
							<div class="text-2xl font-bold text-orange-600 mb-1">{Math.round(events.reduce((acc, e) => acc + (e.tone || 0), 0) / events.length * 100) / 100}</div>
							<div class="text-sm text-gray-600">Avg Tone</div>
						</div>
					</div>

					<!-- Map -->
					<div class="bg-white rounded-lg shadow-sm overflow-hidden">
						<div class="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
							<div class="flex items-center justify-between">
								<div class="flex items-center">
									<div class="w-8 h-8 bg-gradient-to-br from-violet-400 to-purple-600 rounded-lg flex items-center justify-center mr-3">
										<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
										</svg>
									</div>
									<h2 class="text-xl font-semibold text-gray-900">Global Events Map</h2>
								</div>
								<div class="flex items-center space-x-4">
									<div class="text-sm text-gray-600">
										Displaying {events.length} events
									</div>
									<div class="flex items-center text-xs text-gray-500">
										<div class="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-1"></div>
										Live Data
									</div>
								</div>
							</div>
						</div>
						<div bind:this={mapContainer} class="h-[500px] w-full"></div>
					</div>
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
				<div class="h-6 w-6 bg-gradient-to-br from-violet-400 to-purple-600 rounded-lg flex items-center justify-center mr-2">
					<span class="text-white font-bold text-xs">SE</span>
				</div>
				<span class="text-sm text-gray-600">Social Explorer - GDELT World Events</span>
			</div>
			
			<!-- Links -->
			<div class="flex items-center space-x-6 text-sm text-gray-500">
				<span>Data Source: GDELT Project</span>
				<span class="text-gray-300">|</span>
				<span>Last Updated: {new Date().toLocaleDateString()}</span>
			</div>
		</div>
	</div>
</footer>