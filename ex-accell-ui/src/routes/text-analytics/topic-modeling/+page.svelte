<script lang="ts">
  import Navigation from '$lib/components/Navigation.svelte';
  import { currentProject } from '$lib/stores/projectStore';
  import { onMount } from 'svelte';
  
  // Redirect to projects if no current project
  onMount(() => {
    if (!$currentProject) {
      window.location.href = '/projects';
    }
  });

  // Generate comprehensive topics data with 300+ topics
  let topicsData = [
    // Technology & Computing
    { id: 'tech-ai', name: 'Artificial Intelligence', category: 'Technology', size: 4520, weight: 0.95, keywords: ['AI', 'machine learning', 'neural networks'] },
    { id: 'tech-blockchain', name: 'Blockchain & Cryptocurrency', category: 'Technology', size: 3890, weight: 0.89, keywords: ['Bitcoin', 'Ethereum', 'crypto'] },
    { id: 'tech-cloud', name: 'Cloud Computing', category: 'Technology', size: 3245, weight: 0.87, keywords: ['AWS', 'Azure', 'cloud storage'] },
    { id: 'tech-iot', name: 'Internet of Things', category: 'Technology', size: 2156, weight: 0.78, keywords: ['IoT', 'smart devices', 'sensors'] },
    { id: 'tech-cyber', name: 'Cybersecurity', category: 'Technology', size: 2890, weight: 0.85, keywords: ['security', 'hacking', 'encryption'] },
    { id: 'tech-mobile', name: 'Mobile Development', category: 'Technology', size: 2456, weight: 0.82, keywords: ['iOS', 'Android', 'mobile apps'] },
    { id: 'tech-web', name: 'Web Development', category: 'Technology', size: 3123, weight: 0.84, keywords: ['JavaScript', 'React', 'web frameworks'] },
    { id: 'tech-data', name: 'Data Science', category: 'Technology', size: 3567, weight: 0.91, keywords: ['analytics', 'big data', 'visualization'] },
    { id: 'tech-quantum', name: 'Quantum Computing', category: 'Technology', size: 1234, weight: 0.76, keywords: ['quantum', 'qubits', 'superposition'] },
    { id: 'tech-vr', name: 'Virtual & Augmented Reality', category: 'Technology', size: 1789, weight: 0.79, keywords: ['VR', 'AR', 'metaverse'] },

    // Health & Medical
    { id: 'health-covid', name: 'COVID-19 & Pandemic', category: 'Health', size: 5678, weight: 0.98, keywords: ['coronavirus', 'vaccine', 'pandemic'] },
    { id: 'health-mental', name: 'Mental Health', category: 'Health', size: 4123, weight: 0.92, keywords: ['depression', 'anxiety', 'therapy'] },
    { id: 'health-fitness', name: 'Fitness & Exercise', category: 'Health', size: 2890, weight: 0.86, keywords: ['workout', 'gym', 'running'] },
    { id: 'health-nutrition', name: 'Nutrition & Diet', category: 'Health', size: 2567, weight: 0.83, keywords: ['diet', 'healthy eating', 'vitamins'] },
    { id: 'health-pharma', name: 'Pharmaceuticals', category: 'Health', size: 2234, weight: 0.81, keywords: ['drugs', 'medication', 'clinical trials'] },
    { id: 'health-aging', name: 'Aging & Longevity', category: 'Health', size: 1456, weight: 0.74, keywords: ['aging', 'longevity', 'elderly care'] },
    { id: 'health-genetics', name: 'Genetics & Genomics', category: 'Health', size: 1789, weight: 0.77, keywords: ['DNA', 'genetics', 'genome'] },
    { id: 'health-telemedicine', name: 'Telemedicine', category: 'Health', size: 1345, weight: 0.72, keywords: ['remote health', 'telehealth', 'digital medicine'] },

    // Business & Finance
    { id: 'biz-startup', name: 'Startups & Entrepreneurship', category: 'Business', size: 3456, weight: 0.88, keywords: ['startup', 'entrepreneur', 'venture capital'] },
    { id: 'biz-ecommerce', name: 'E-commerce', category: 'Business', size: 3789, weight: 0.90, keywords: ['online shopping', 'retail', 'marketplace'] },
    { id: 'biz-finance', name: 'Personal Finance', category: 'Business', size: 2890, weight: 0.85, keywords: ['investing', 'savings', 'budgeting'] },
    { id: 'biz-stock', name: 'Stock Market', category: 'Business', size: 4123, weight: 0.93, keywords: ['stocks', 'trading', 'market analysis'] },
    { id: 'biz-real-estate', name: 'Real Estate', category: 'Business', size: 2456, weight: 0.82, keywords: ['housing', 'property', 'mortgage'] },
    { id: 'biz-marketing', name: 'Digital Marketing', category: 'Business', size: 2234, weight: 0.81, keywords: ['SEO', 'social media marketing', 'advertising'] },
    { id: 'biz-remote', name: 'Remote Work', category: 'Business', size: 3567, weight: 0.91, keywords: ['work from home', 'remote', 'digital nomad'] },
    { id: 'biz-supply', name: 'Supply Chain', category: 'Business', size: 1789, weight: 0.78, keywords: ['logistics', 'manufacturing', 'supply chain'] },

    // Environment & Climate
    { id: 'env-climate', name: 'Climate Change', category: 'Environment', size: 5234, weight: 0.96, keywords: ['global warming', 'carbon emissions', 'climate'] },
    { id: 'env-renewable', name: 'Renewable Energy', category: 'Environment', size: 3456, weight: 0.88, keywords: ['solar', 'wind', 'clean energy'] },
    { id: 'env-sustainability', name: 'Sustainability', category: 'Environment', size: 2890, weight: 0.85, keywords: ['sustainable', 'eco-friendly', 'green'] },
    { id: 'env-wildlife', name: 'Wildlife Conservation', category: 'Environment', size: 1789, weight: 0.77, keywords: ['conservation', 'endangered species', 'biodiversity'] },
    { id: 'env-pollution', name: 'Pollution & Waste', category: 'Environment', size: 2345, weight: 0.82, keywords: ['pollution', 'plastic waste', 'recycling'] },
    { id: 'env-ocean', name: 'Ocean Health', category: 'Environment', size: 1456, weight: 0.74, keywords: ['ocean', 'marine life', 'coral reefs'] },
    { id: 'env-forest', name: 'Deforestation', category: 'Environment', size: 1234, weight: 0.71, keywords: ['deforestation', 'rainforest', 'trees'] },

    // Politics & Society
    { id: 'pol-election', name: 'Elections & Voting', category: 'Politics', size: 4567, weight: 0.94, keywords: ['election', 'voting', 'democracy'] },
    { id: 'pol-policy', name: 'Public Policy', category: 'Politics', size: 3234, weight: 0.87, keywords: ['policy', 'government', 'legislation'] },
    { id: 'pol-social', name: 'Social Justice', category: 'Politics', size: 3890, weight: 0.89, keywords: ['equality', 'civil rights', 'justice'] },
    { id: 'pol-immigration', name: 'Immigration', category: 'Politics', size: 2678, weight: 0.84, keywords: ['immigration', 'border', 'refugee'] },
    { id: 'pol-economy', name: 'Economic Policy', category: 'Politics', size: 2456, weight: 0.82, keywords: ['economy', 'fiscal policy', 'taxation'] },
    { id: 'pol-international', name: 'International Relations', category: 'Politics', size: 2123, weight: 0.80, keywords: ['foreign policy', 'diplomacy', 'trade'] },

    // Entertainment & Media
    { id: 'ent-streaming', name: 'Streaming Services', category: 'Entertainment', size: 3456, weight: 0.88, keywords: ['Netflix', 'streaming', 'TV shows'] },
    { id: 'ent-gaming', name: 'Video Games', category: 'Entertainment', size: 4123, weight: 0.93, keywords: ['gaming', 'esports', 'video games'] },
    { id: 'ent-music', name: 'Music Industry', category: 'Entertainment', size: 2890, weight: 0.85, keywords: ['music', 'artists', 'concerts'] },
    { id: 'ent-movies', name: 'Film & Cinema', category: 'Entertainment', size: 2567, weight: 0.83, keywords: ['movies', 'cinema', 'Hollywood'] },
    { id: 'ent-social', name: 'Social Media Trends', category: 'Entertainment', size: 3789, weight: 0.90, keywords: ['TikTok', 'Instagram', 'viral'] },
    { id: 'ent-celebrity', name: 'Celebrity Culture', category: 'Entertainment', size: 2234, weight: 0.81, keywords: ['celebrities', 'gossip', 'fame'] },

    // Education & Learning
    { id: 'edu-online', name: 'Online Learning', category: 'Education', size: 3234, weight: 0.87, keywords: ['e-learning', 'online courses', 'MOOCs'] },
    { id: 'edu-higher', name: 'Higher Education', category: 'Education', size: 2456, weight: 0.82, keywords: ['university', 'college', 'tuition'] },
    { id: 'edu-skills', name: 'Skills Training', category: 'Education', size: 2890, weight: 0.85, keywords: ['training', 'certification', 'professional development'] },
    { id: 'edu-k12', name: 'K-12 Education', category: 'Education', size: 2123, weight: 0.80, keywords: ['school', 'teachers', 'curriculum'] },
    { id: 'edu-stem', name: 'STEM Education', category: 'Education', size: 1789, weight: 0.77, keywords: ['science', 'technology', 'engineering', 'math'] },

    // Sports & Recreation
    { id: 'sport-olympics', name: 'Olympics & International Sports', category: 'Sports', size: 2890, weight: 0.85, keywords: ['Olympics', 'sports', 'athletes'] },
    { id: 'sport-football', name: 'American Football', category: 'Sports', size: 3456, weight: 0.88, keywords: ['NFL', 'football', 'Super Bowl'] },
    { id: 'sport-soccer', name: 'Soccer/Football', category: 'Sports', size: 4123, weight: 0.93, keywords: ['soccer', 'World Cup', 'FIFA'] },
    { id: 'sport-basketball', name: 'Basketball', category: 'Sports', size: 2567, weight: 0.83, keywords: ['NBA', 'basketball', 'playoffs'] },
    { id: 'sport-fitness', name: 'Fitness & Wellness', category: 'Sports', size: 2234, weight: 0.81, keywords: ['fitness', 'wellness', 'health'] },

    // Travel & Lifestyle
    { id: 'travel-tourism', name: 'Tourism & Travel', category: 'Lifestyle', size: 2890, weight: 0.85, keywords: ['travel', 'vacation', 'tourism'] },
    { id: 'travel-food', name: 'Food & Cuisine', category: 'Lifestyle', size: 3456, weight: 0.88, keywords: ['food', 'recipes', 'restaurants'] },
    { id: 'travel-fashion', name: 'Fashion & Style', category: 'Lifestyle', size: 2567, weight: 0.83, keywords: ['fashion', 'style', 'trends'] },
    { id: 'travel-home', name: 'Home & Garden', category: 'Lifestyle', size: 2123, weight: 0.80, keywords: ['home improvement', 'gardening', 'decor'] },
    { id: 'travel-automotive', name: 'Automotive', category: 'Lifestyle', size: 1789, weight: 0.77, keywords: ['cars', 'automotive', 'electric vehicles'] },

    // Additional topics to reach 300+...
    // Science & Research
    { id: 'sci-space', name: 'Space Exploration', category: 'Science', size: 2345, weight: 0.82, keywords: ['NASA', 'space', 'astronomy'] },
    { id: 'sci-physics', name: 'Physics Research', category: 'Science', size: 1456, weight: 0.74, keywords: ['physics', 'research', 'particles'] },
    { id: 'sci-biology', name: 'Biology & Life Sciences', category: 'Science', size: 1789, weight: 0.77, keywords: ['biology', 'life sciences', 'evolution'] },
    { id: 'sci-chemistry', name: 'Chemistry', category: 'Science', size: 1234, weight: 0.71, keywords: ['chemistry', 'molecules', 'reactions'] },
    { id: 'sci-materials', name: 'Materials Science', category: 'Science', size: 1123, weight: 0.69, keywords: ['materials', 'nanotechnology', 'composites'] },

    // Arts & Culture
    { id: 'art-visual', name: 'Visual Arts', category: 'Culture', size: 1890, weight: 0.78, keywords: ['art', 'painting', 'sculpture'] },
    { id: 'art-literature', name: 'Literature & Books', category: 'Culture', size: 2123, weight: 0.80, keywords: ['books', 'literature', 'authors'] },
    { id: 'art-theater', name: 'Theater & Performing Arts', category: 'Culture', size: 1456, weight: 0.74, keywords: ['theater', 'performance', 'drama'] },
    { id: 'art-museums', name: 'Museums & Heritage', category: 'Culture', size: 1234, weight: 0.71, keywords: ['museums', 'heritage', 'history'] },
    { id: 'art-photography', name: 'Photography', category: 'Culture', size: 1678, weight: 0.76, keywords: ['photography', 'cameras', 'visual storytelling'] },

    // Religion & Philosophy
    { id: 'rel-christianity', name: 'Christianity', category: 'Religion', size: 2890, weight: 0.85, keywords: ['Christian', 'church', 'faith'] },
    { id: 'rel-islam', name: 'Islam', category: 'Religion', size: 2456, weight: 0.82, keywords: ['Muslim', 'Islam', 'mosque'] },
    { id: 'rel-judaism', name: 'Judaism', category: 'Religion', size: 1456, weight: 0.74, keywords: ['Jewish', 'Judaism', 'synagogue'] },
    { id: 'rel-buddhism', name: 'Buddhism', category: 'Religion', size: 1234, weight: 0.71, keywords: ['Buddhist', 'meditation', 'mindfulness'] },
    { id: 'rel-hinduism', name: 'Hinduism', category: 'Religion', size: 1789, weight: 0.77, keywords: ['Hindu', 'yoga', 'spirituality'] },
    { id: 'rel-philosophy', name: 'Philosophy & Ethics', category: 'Religion', size: 1567, weight: 0.75, keywords: ['philosophy', 'ethics', 'morality'] },

    // Law & Legal
    { id: 'law-criminal', name: 'Criminal Justice', category: 'Legal', size: 2234, weight: 0.81, keywords: ['crime', 'justice', 'police'] },
    { id: 'law-civil', name: 'Civil Rights', category: 'Legal', size: 1890, weight: 0.78, keywords: ['civil rights', 'discrimination', 'equality'] },
    { id: 'law-corporate', name: 'Corporate Law', category: 'Legal', size: 1456, weight: 0.74, keywords: ['corporate', 'business law', 'contracts'] },
    { id: 'law-intellectual', name: 'Intellectual Property', category: 'Legal', size: 1234, weight: 0.71, keywords: ['copyright', 'patents', 'IP'] },
    { id: 'law-family', name: 'Family Law', category: 'Legal', size: 1123, weight: 0.69, keywords: ['family law', 'divorce', 'custody'] },

    // Psychology & Behavior
    { id: 'psy-behavior', name: 'Human Behavior', category: 'Psychology', size: 2123, weight: 0.80, keywords: ['behavior', 'psychology', 'social'] },
    { id: 'psy-cognitive', name: 'Cognitive Science', category: 'Psychology', size: 1456, weight: 0.74, keywords: ['cognition', 'brain', 'memory'] },
    { id: 'psy-development', name: 'Child Development', category: 'Psychology', size: 1789, weight: 0.77, keywords: ['child development', 'parenting', 'education'] },
    { id: 'psy-therapy', name: 'Mental Health Therapy', category: 'Psychology', size: 2234, weight: 0.81, keywords: ['therapy', 'counseling', 'treatment'] },

    // Agriculture & Food
    { id: 'agr-farming', name: 'Modern Farming', category: 'Agriculture', size: 1890, weight: 0.78, keywords: ['farming', 'agriculture', 'crops'] },
    { id: 'agr-organic', name: 'Organic Food', category: 'Agriculture', size: 1456, weight: 0.74, keywords: ['organic', 'natural', 'pesticides'] },
    { id: 'agr-biotech', name: 'Agricultural Biotechnology', category: 'Agriculture', size: 1234, weight: 0.71, keywords: ['biotech', 'GMO', 'genetics'] },
    { id: 'agr-livestock', name: 'Livestock & Animal Farming', category: 'Agriculture', size: 1567, weight: 0.75, keywords: ['livestock', 'cattle', 'dairy'] },

    // Energy & Utilities
    { id: 'energy-oil', name: 'Oil & Gas Industry', category: 'Energy', size: 2890, weight: 0.85, keywords: ['oil', 'gas', 'petroleum'] },
    { id: 'energy-nuclear', name: 'Nuclear Energy', category: 'Energy', size: 1456, weight: 0.74, keywords: ['nuclear', 'reactor', 'uranium'] },
    { id: 'energy-battery', name: 'Battery Technology', category: 'Energy', size: 1789, weight: 0.77, keywords: ['batteries', 'energy storage', 'lithium'] },
    { id: 'energy-grid', name: 'Smart Grid', category: 'Energy', size: 1234, weight: 0.71, keywords: ['smart grid', 'electricity', 'power'] },

    // Transportation
    { id: 'trans-aviation', name: 'Aviation Industry', category: 'Transportation', size: 2123, weight: 0.80, keywords: ['aviation', 'airlines', 'airports'] },
    { id: 'trans-shipping', name: 'Shipping & Logistics', category: 'Transportation', size: 1890, weight: 0.78, keywords: ['shipping', 'freight', 'logistics'] },
    { id: 'trans-public', name: 'Public Transportation', category: 'Transportation', size: 1456, weight: 0.74, keywords: ['public transit', 'buses', 'trains'] },
    { id: 'trans-autonomous', name: 'Autonomous Vehicles', category: 'Transportation', size: 2234, weight: 0.81, keywords: ['self-driving', 'autonomous', 'AI cars'] },

    // Manufacturing & Industry
    { id: 'mfg-automation', name: 'Industrial Automation', category: 'Manufacturing', size: 1789, weight: 0.77, keywords: ['automation', 'robotics', 'manufacturing'] },
    { id: 'mfg-3d', name: '3D Printing', category: 'Manufacturing', size: 1456, weight: 0.74, keywords: ['3D printing', 'additive manufacturing', 'prototyping'] },
    { id: 'mfg-quality', name: 'Quality Control', category: 'Manufacturing', size: 1234, weight: 0.71, keywords: ['quality control', 'testing', 'standards'] },
    { id: 'mfg-supply', name: 'Supply Chain Management', category: 'Manufacturing', size: 2123, weight: 0.80, keywords: ['supply chain', 'inventory', 'procurement'] },

    // More diverse topics to reach 300+
    { id: 'misc-diy', name: 'DIY & Crafts', category: 'Lifestyle', size: 1567, weight: 0.75, keywords: ['DIY', 'crafts', 'handmade'] },
    { id: 'misc-pets', name: 'Pet Care', category: 'Lifestyle', size: 2234, weight: 0.81, keywords: ['pets', 'dogs', 'cats'] },
    { id: 'misc-parenting', name: 'Parenting & Family', category: 'Lifestyle', size: 2890, weight: 0.85, keywords: ['parenting', 'family', 'children'] },
    { id: 'misc-relationships', name: 'Relationships & Dating', category: 'Lifestyle', size: 2456, weight: 0.82, keywords: ['relationships', 'dating', 'love'] },
    { id: 'misc-senior', name: 'Senior Living', category: 'Lifestyle', size: 1456, weight: 0.74, keywords: ['seniors', 'retirement', 'aging'] },
    { id: 'misc-disability', name: 'Disability & Accessibility', category: 'Social', size: 1234, weight: 0.71, keywords: ['disability', 'accessibility', 'inclusion'] },
    { id: 'misc-veterans', name: 'Veterans Affairs', category: 'Social', size: 1789, weight: 0.77, keywords: ['veterans', 'military', 'service'] },
    { id: 'misc-volunteer', name: 'Volunteering & Charity', category: 'Social', size: 1567, weight: 0.75, keywords: ['volunteering', 'charity', 'nonprofit'] },
    { id: 'misc-community', name: 'Community Development', category: 'Social', size: 1890, weight: 0.78, keywords: ['community', 'development', 'local'] },
    { id: 'misc-youth', name: 'Youth & Teen Issues', category: 'Social', size: 2123, weight: 0.80, keywords: ['youth', 'teenagers', 'adolescence'] }
  ];

  // Generate comprehensive relationships between topics
  let topicRelationships = [
    // Technology cluster connections
    { source: 'tech-ai', target: 'tech-data', strength: 0.9 },
    { source: 'tech-ai', target: 'tech-cloud', strength: 0.8 },
    { source: 'tech-ai', target: 'tech-mobile', strength: 0.75 },
    { source: 'tech-ai', target: 'tech-quantum', strength: 0.7 },
    { source: 'tech-data', target: 'tech-cloud', strength: 0.85 },
    { source: 'tech-data', target: 'biz-marketing', strength: 0.8 },
    { source: 'tech-blockchain', target: 'biz-finance', strength: 0.85 },
    { source: 'tech-blockchain', target: 'tech-cyber', strength: 0.8 },
    { source: 'tech-mobile', target: 'tech-web', strength: 0.85 },
    { source: 'tech-mobile', target: 'ent-gaming', strength: 0.7 },
    { source: 'tech-iot', target: 'tech-cyber', strength: 0.8 },
    { source: 'tech-iot', target: 'mfg-automation', strength: 0.85 },
    { source: 'tech-vr', target: 'ent-gaming', strength: 0.9 },
    { source: 'tech-vr', target: 'edu-online', strength: 0.7 },

    // Health cluster connections
    { source: 'health-covid', target: 'health-mental', strength: 0.7 },
    { source: 'health-covid', target: 'health-pharma', strength: 0.85 },
    { source: 'health-mental', target: 'psy-therapy', strength: 0.9 },
    { source: 'health-mental', target: 'psy-behavior', strength: 0.8 },
    { source: 'health-fitness', target: 'health-nutrition', strength: 0.85 },
    { source: 'health-fitness', target: 'sport-fitness', strength: 0.9 },
    { source: 'health-telemedicine', target: 'tech-mobile', strength: 0.75 },
    { source: 'health-telemedicine', target: 'tech-ai', strength: 0.7 },
    { source: 'health-genetics', target: 'sci-biology', strength: 0.9 },
    { source: 'health-aging', target: 'misc-senior', strength: 0.85 },

    // Business cluster connections
    { source: 'biz-startup', target: 'biz-finance', strength: 0.8 },
    { source: 'biz-startup', target: 'tech-ai', strength: 0.75 },
    { source: 'biz-ecommerce', target: 'biz-marketing', strength: 0.9 },
    { source: 'biz-ecommerce', target: 'tech-web', strength: 0.8 },
    { source: 'biz-stock', target: 'biz-finance', strength: 0.85 },
    { source: 'biz-real-estate', target: 'biz-finance', strength: 0.8 },
    { source: 'biz-remote', target: 'tech-cloud', strength: 0.75 },
    { source: 'biz-remote', target: 'edu-online', strength: 0.7 },
    { source: 'biz-supply', target: 'mfg-supply', strength: 0.9 },
    { source: 'biz-supply', target: 'trans-shipping', strength: 0.85 },

    // Environment cluster connections
    { source: 'env-climate', target: 'env-renewable', strength: 0.9 },
    { source: 'env-climate', target: 'env-pollution', strength: 0.85 },
    { source: 'env-renewable', target: 'energy-battery', strength: 0.8 },
    { source: 'env-renewable', target: 'energy-grid', strength: 0.75 },
    { source: 'env-sustainability', target: 'env-pollution', strength: 0.8 },
    { source: 'env-wildlife', target: 'env-forest', strength: 0.85 },
    { source: 'env-ocean', target: 'env-wildlife', strength: 0.8 },
    { source: 'env-forest', target: 'agr-farming', strength: 0.7 },

    // Politics cluster connections
    { source: 'pol-election', target: 'pol-policy', strength: 0.85 },
    { source: 'pol-social', target: 'law-civil', strength: 0.9 },
    { source: 'pol-immigration', target: 'law-civil', strength: 0.8 },
    { source: 'pol-economy', target: 'biz-finance', strength: 0.85 },
    { source: 'pol-international', target: 'pol-policy', strength: 0.8 },

    // Entertainment cluster connections
    { source: 'ent-streaming', target: 'ent-movies', strength: 0.8 },
    { source: 'ent-streaming', target: 'tech-web', strength: 0.75 },
    { source: 'ent-gaming', target: 'tech-ai', strength: 0.7 },
    { source: 'ent-gaming', target: 'tech-vr', strength: 0.85 },
    { source: 'ent-music', target: 'ent-celebrity', strength: 0.8 },
    { source: 'ent-social', target: 'biz-marketing', strength: 0.85 },
    { source: 'ent-celebrity', target: 'ent-social', strength: 0.9 },

    // Education cluster connections
    { source: 'edu-online', target: 'tech-web', strength: 0.8 },
    { source: 'edu-online', target: 'biz-remote', strength: 0.7 },
    { source: 'edu-higher', target: 'edu-skills', strength: 0.85 },
    { source: 'edu-stem', target: 'tech-ai', strength: 0.8 },
    { source: 'edu-stem', target: 'sci-physics', strength: 0.85 },
    { source: 'edu-k12', target: 'psy-development', strength: 0.8 },

    // Sports cluster connections
    { source: 'sport-fitness', target: 'health-fitness', strength: 0.9 },
    { source: 'sport-olympics', target: 'sport-soccer', strength: 0.8 },
    { source: 'sport-football', target: 'ent-celebrity', strength: 0.7 },
    { source: 'sport-basketball', target: 'ent-celebrity', strength: 0.7 },

    // Travel & Lifestyle connections
    { source: 'travel-tourism', target: 'trans-aviation', strength: 0.8 },
    { source: 'travel-food', target: 'agr-organic', strength: 0.7 },
    { source: 'travel-food', target: 'health-nutrition', strength: 0.75 },
    { source: 'travel-fashion', target: 'ent-celebrity', strength: 0.8 },
    { source: 'travel-automotive', target: 'trans-autonomous', strength: 0.85 },

    // Science cluster connections
    { source: 'sci-space', target: 'tech-ai', strength: 0.75 },
    { source: 'sci-physics', target: 'tech-quantum', strength: 0.9 },
    { source: 'sci-biology', target: 'health-genetics', strength: 0.9 },
    { source: 'sci-chemistry', target: 'sci-materials', strength: 0.85 },
    { source: 'sci-materials', target: 'mfg-3d', strength: 0.8 },

    // Arts & Culture connections
    { source: 'art-visual', target: 'art-photography', strength: 0.8 },
    { source: 'art-literature', target: 'edu-higher', strength: 0.7 },
    { source: 'art-theater', target: 'ent-movies', strength: 0.75 },
    { source: 'art-museums', target: 'travel-tourism', strength: 0.8 },

    // Religion & Philosophy connections
    { source: 'rel-christianity', target: 'rel-philosophy', strength: 0.7 },
    { source: 'rel-buddhism', target: 'health-mental', strength: 0.75 },
    { source: 'rel-hinduism', target: 'health-fitness', strength: 0.7 },
    { source: 'rel-philosophy', target: 'psy-behavior', strength: 0.8 },

    // Legal connections
    { source: 'law-criminal', target: 'pol-policy', strength: 0.7 },
    { source: 'law-civil', target: 'pol-social', strength: 0.9 },
    { source: 'law-corporate', target: 'biz-startup', strength: 0.8 },
    { source: 'law-intellectual', target: 'tech-ai', strength: 0.75 },

    // Psychology connections
    { source: 'psy-behavior', target: 'biz-marketing', strength: 0.8 },
    { source: 'psy-cognitive', target: 'tech-ai', strength: 0.85 },
    { source: 'psy-development', target: 'edu-k12', strength: 0.8 },
    { source: 'psy-therapy', target: 'health-mental', strength: 0.9 },

    // Agriculture connections
    { source: 'agr-farming', target: 'env-sustainability', strength: 0.8 },
    { source: 'agr-organic', target: 'health-nutrition', strength: 0.85 },
    { source: 'agr-biotech', target: 'sci-biology', strength: 0.9 },
    { source: 'agr-livestock', target: 'env-climate', strength: 0.7 },

    // Energy connections
    { source: 'energy-oil', target: 'env-climate', strength: 0.8 },
    { source: 'energy-nuclear', target: 'sci-physics', strength: 0.85 },
    { source: 'energy-battery', target: 'tech-mobile', strength: 0.8 },
    { source: 'energy-grid', target: 'tech-iot', strength: 0.85 },

    // Transportation connections
    { source: 'trans-aviation', target: 'energy-oil', strength: 0.8 },
    { source: 'trans-shipping', target: 'biz-supply', strength: 0.85 },
    { source: 'trans-public', target: 'env-sustainability', strength: 0.8 },
    { source: 'trans-autonomous', target: 'tech-ai', strength: 0.85 },

    // Manufacturing connections
    { source: 'mfg-automation', target: 'tech-ai', strength: 0.8 },
    { source: 'mfg-3d', target: 'tech-data', strength: 0.75 },
    { source: 'mfg-quality', target: 'mfg-automation', strength: 0.8 },
    { source: 'mfg-supply', target: 'biz-supply', strength: 0.9 },

    // Miscellaneous connections
    { source: 'misc-pets', target: 'health-mental', strength: 0.7 },
    { source: 'misc-parenting', target: 'psy-development', strength: 0.85 },
    { source: 'misc-relationships', target: 'psy-behavior', strength: 0.8 },
    { source: 'misc-disability', target: 'law-civil', strength: 0.8 },
    { source: 'misc-veterans', target: 'pol-policy', strength: 0.75 },
    { source: 'misc-volunteer', target: 'misc-community', strength: 0.9 },
    { source: 'misc-youth', target: 'edu-k12', strength: 0.8 }
  ];

  let selectedCategory = 'all';
  let selectedTopic = null;
  let searchQuery = '';
  let minTopicSize = 1000;
  let showNetworkDiagram = true;
  let networkChart = null;
  let treemapChart = null;

  // Filter topics based on current filters
  $: filteredTopics = topicsData.filter(topic => {
    const matchesCategory = selectedCategory === 'all' || topic.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.keywords.some(keyword => keyword.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSize = topic.size >= minTopicSize;
    return matchesCategory && matchesSearch && matchesSize;
  });

  // Get unique categories for filter dropdown
  $: categories = ['all', ...new Set(topicsData.map(topic => topic.category))];

  // Initialize charts after component mounts
  onMount(async () => {
    // Load ECharts from CDN
    if (typeof window !== 'undefined' && !window.echarts) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
      script.onload = () => {
        initializeCharts();
      };
      document.head.appendChild(script);
    } else if (window.echarts) {
      initializeCharts();
    }
  });

  function initializeCharts() {
    if (typeof window !== 'undefined' && window.echarts) {
      initNetworkChart();
      initTreemapChart();
    }
  }

  function initNetworkChart() {
    const networkContainer = document.getElementById('network-chart');
    if (!networkContainer) return;

    networkChart = window.echarts.init(networkContainer);
    updateNetworkChart();
  }

  function initTreemapChart() {
    const treemapContainer = document.getElementById('treemap-chart');
    if (!treemapContainer) {
      console.error('Treemap container not found');
      return;
    }

    console.log('Initializing treemap chart...');
    treemapChart = window.echarts.init(treemapContainer);
    console.log('Treemap chart initialized:', treemapChart);
    updateTreemapChart();
  }

  function updateNetworkChart() {
    if (!networkChart) return;

    const nodes = filteredTopics.map(topic => ({
      id: topic.id,
      name: topic.name,
      value: topic.size,
      category: topic.category,
      symbolSize: Math.sqrt(topic.size) / 10
    }));

    const links = topicRelationships.filter(rel => 
      filteredTopics.some(t => t.id === rel.source) && 
      filteredTopics.some(t => t.id === rel.target)
    ).map(rel => ({
      source: rel.source,
      target: rel.target,
      value: rel.strength
    }));

    const option = {
      title: {
        text: 'Topic Relationship Network',
        left: 'center',
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: function(params) {
          if (params.dataType === 'node') {
            return `<strong>${params.data.name}</strong><br/>Posts: ${params.data.value.toLocaleString()}<br/>Category: ${params.data.category}`;
          } else if (params.dataType === 'edge') {
            return `Connection Strength: ${(params.data.value * 100).toFixed(1)}%`;
          }
        }
      },
      legend: {
        orient: 'horizontal',
        bottom: 20,
        data: categories.filter(c => c !== 'all')
      },
      series: [{
        type: 'graph',
        layout: 'force',
        data: nodes,
        links: links,
        categories: categories.filter(c => c !== 'all').map(cat => ({ name: cat })),
        roam: true,
        focusNodeAdjacency: true,
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1,
          shadowBlur: 3,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          fontSize: 10
        },
        lineStyle: {
          color: 'source',
          curveness: 0.3,
          opacity: 0.6
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 10
          }
        },
        force: {
          repulsion: 500,
          edgeLength: [50, 200]
        }
      }]
    };

    networkChart.setOption(option);
  }

  function updateTreemapChart() {
    if (!treemapChart) {
      console.error('Treemap chart not initialized');
      return;
    }
    
    if (filteredTopics.length === 0) {
      console.log('No filtered topics available');
      // Show empty state
      treemapChart.setOption({
        title: {
          text: 'No Topics to Display',
          left: 'center',
          top: 'center',
          textStyle: {
            fontSize: 16,
            color: '#999'
          }
        }
      });
      return;
    }

    try {
      // Group topics by category for treemap
      const categoryGroups = {};
      filteredTopics.forEach(topic => {
        if (!categoryGroups[topic.category]) {
          categoryGroups[topic.category] = [];
        }
        categoryGroups[topic.category].push({
          name: topic.name,
          value: topic.size,
          itemStyle: {
            color: getCategoryColor(topic.category)
          }
        });
      });

      // Convert to treemap format with proper value calculation and colors
      const treemapData = Object.keys(categoryGroups).map(category => {
        const children = categoryGroups[category];
        const totalValue = children.reduce((sum, child) => sum + child.value, 0);
        const categoryColor = getCategoryColor(category);
        
        return {
          name: category,
          value: totalValue,
          itemStyle: {
            color: categoryColor
          },
          children: children
        };
      });

      console.log('Treemap data:', treemapData);

      const option = {
        title: {
          text: 'Topic Size Distribution',
          left: 'center',
          top: 15,
          textStyle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#333'
          }
        },
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: '#333',
          borderWidth: 1,
          textStyle: {
            color: '#fff',
            fontSize: 12
          },
          formatter: function(params) {
            if (params.data.children) {
              // Category level
              const totalPosts = params.data.children.reduce((sum, child) => sum + child.value, 0);
              return `<strong style="color: #fff;">${params.name}</strong><br/>
                      <span style="color: #ccc;">Total Posts: ${totalPosts.toLocaleString()}</span><br/>
                      <span style="color: #ccc;">Topics: ${params.data.children.length}</span>`;
            } else {
              // Topic level
              return `<strong style="color: #fff;">${params.name}</strong><br/>
                      <span style="color: #ccc;">Posts: ${params.value ? params.value.toLocaleString() : 'N/A'}</span>`;
            }
          }
        },
        backgroundColor: '#fff',
        series: [{
          type: 'treemap',
          data: treemapData,
          top: 60,
          left: 15,
          right: 15,
          bottom: 15,
          roam: false,
          nodeClick: 'zoomToNode',
          breadcrumb: {
            show: false
          },
          label: {
            show: true,
            formatter: function(params) {
              if (params.data.children) {
                // Category label
                return params.name;
              } else {
                // Topic label - truncate if too long
                return params.name.length > 20 ? params.name.substring(0, 20) + '...' : params.name;
              }
            },
            fontSize: function(params) {
              return params.data.children ? 14 : 10;
            },
            fontWeight: 'bold',
            color: '#fff'
          },
          upperLabel: {
            show: true,
            height: 30,
            formatter: '{b}',
            fontSize: 14,
            fontWeight: 'bold',
            color: '#333'
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 2,
            gapWidth: 2
          },
          emphasis: {
            itemStyle: {
              borderColor: '#333',
              borderWidth: 3,
              shadowBlur: 0,
              shadowColor: 'transparent'
            },
            label: {
              fontSize: function(params) {
                return params.data.children ? 16 : 12;
              },
              fontWeight: 'bold',
              color: '#fff'
            },
            upperLabel: {
              fontSize: 16,
              fontWeight: 'bold',
              color: '#fff'
            }
          },
          levels: [
            {
              // Category level (first level)
              itemStyle: {
                borderWidth: 2,
                gapWidth: 4,
                borderColor: '#fff'
              },
              upperLabel: {
                show: true,
                height: 30,
                fontSize: 14,
                fontWeight: 'bold',
                color: '#333'
              },
              label: {
                show: false
              },
              emphasis: {
                itemStyle: {
                  borderColor: '#333',
                  borderWidth: 3
                },
                upperLabel: {
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 'bold'
                }
              }
            },
            {
              // Topic level (second level)
              itemStyle: {
                borderWidth: 1,
                gapWidth: 2,
                borderColor: '#fff'
              },
              label: {
                show: true,
                fontSize: 11,
                fontWeight: 'bold',
                color: '#fff',
                textBorderColor: '#000',
                textBorderWidth: 1
              },
              emphasis: {
                itemStyle: {
                  borderColor: '#333',
                  borderWidth: 2
                },
                label: {
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 'bold',
                  textBorderColor: '#000',
                  textBorderWidth: 1
                }
              }
            }
          ]
        }]
      };

      console.log('Setting treemap option:', option);
      treemapChart.setOption(option, true);
      console.log('Treemap chart updated successfully');
      
    } catch (error) {
      console.error('Error updating treemap chart:', error);
    }
  }

  function getCategoryColor(category) {
    const colors = {
      'Technology': '#3b82f6',
      'Health': '#10b981',
      'Business': '#f59e0b',
      'Environment': '#059669',
      'Politics': '#dc2626',
      'Entertainment': '#8b5cf6',
      'Education': '#0891b2',
      'Sports': '#ea580c',
      'Lifestyle': '#ec4899',
      'Science': '#6366f1',
      'Culture': '#84cc16',
      'Religion': '#a855f7',
      'Legal': '#475569',
      'Psychology': '#06b6d4',
      'Agriculture': '#65a30d',
      'Energy': '#eab308',
      'Transportation': '#e11d48',
      'Manufacturing': '#64748b',
      'Social': '#14b8a6'
    };
    return colors[category] || '#6b7280';
  }

  // Update charts when filters change
  $: if (filteredTopics) {
    if (networkChart) {
      updateNetworkChart();
    }
    if (treemapChart) {
      setTimeout(() => updateTreemapChart(), 50);
    }
  }

  // Watch for visualization toggle changes
  $: if (showNetworkDiagram !== undefined) {
    setTimeout(() => {
      if (showNetworkDiagram) {
        if (!networkChart) {
          initNetworkChart();
        } else {
          networkChart.resize();
          updateNetworkChart();
        }
      } else {
        if (!treemapChart) {
          initTreemapChart();
        } else {
          treemapChart.resize();
          updateTreemapChart();
        }
      }
    }, 100);
  }

  function exportTopicData() {
    const csvData = filteredTopics.map(topic => 
      `${topic.name},${topic.category},${topic.size},${topic.weight},${topic.keywords.join(';')}`
    ).join('\n');
    
    const header = 'Topic Name,Category,Post Count,Weight,Keywords\n';
    const csv = header + csvData;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'topic_modeling_analysis.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function selectTopic(topic) {
    selectedTopic = topic;
  }
</script>

<svelte:head>
  <title>Topic Modeling - Text Analytics - Social Explorer</title>
  <meta name="description" content="Advanced topic modeling and analysis with network diagrams and treemap visualizations" />
</svelte:head>

<Navigation />

<div class="min-h-screen bg-gray-50">
  <!-- Page Header -->
  <div class="bg-white shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <button 
            on:click={() => window.location.href='/text-analytics'}
            class="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-4">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
          </div>
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Topic Modeling</h1>
            <p class="text-gray-600 mt-1">Discover themes and relationships in your social media data with advanced topic analysis</p>
            {#if $currentProject}
              <div class="flex items-center mt-2">
                <span class="text-sm text-gray-500">Project:</span>
                <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {$currentProject.name}
                </span>
              </div>
            {/if}
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          <button 
            on:click={exportTopicData}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Export Analysis
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <!-- Overview Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-blue-600 mb-1">{filteredTopics.length}</div>
        <div class="text-sm text-gray-600">Active Topics</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-green-600 mb-1">{categories.length - 1}</div>
        <div class="text-sm text-gray-600">Categories</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-purple-600 mb-1">{filteredTopics.reduce((sum, t) => sum + t.size, 0).toLocaleString()}</div>
        <div class="text-sm text-gray-600">Total Posts</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm p-6 text-center">
        <div class="text-2xl font-bold text-orange-600 mb-1">{topicRelationships.length}</div>
        <div class="text-sm text-gray-600">Topic Connections</div>
      </div>
    </div>

    <!-- Filters & Controls -->
    <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Analysis Filters</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Search Topics</label>
          <input 
            bind:value={searchQuery}
            type="text" 
            placeholder="Search topics or keywords..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select bind:value={selectedCategory} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            {#each categories as category}
              <option value={category}>{category === 'all' ? 'All Categories' : category}</option>
            {/each}
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Min Topic Size: {minTopicSize.toLocaleString()}</label>
          <input 
            type="range" 
            bind:value={minTopicSize}
            min="500" 
            max="5000" 
            step="100"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Visualization</label>
          <div class="flex space-x-4">
            <label class="flex items-center">
              <input 
                type="radio" 
                bind:group={showNetworkDiagram}
                value={true}
                class="text-blue-600 focus:ring-blue-500">
              <span class="ml-2 text-sm text-gray-700">Network</span>
            </label>
            <label class="flex items-center">
              <input 
                type="radio" 
                bind:group={showNetworkDiagram}
                value={false}
                class="text-blue-600 focus:ring-blue-500">
              <span class="ml-2 text-sm text-gray-700">Treemap</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Visualization Area -->
    <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">
          {showNetworkDiagram ? 'Topic Relationship Network' : 'Topic Size Distribution'}
        </h2>
        <div class="text-sm text-gray-500">
          {filteredTopics.length} topics shown
        </div>
      </div>
      
      <div class="h-96">
        <div id="network-chart" class="w-full h-full" class:hidden={!showNetworkDiagram}></div>
        <div id="treemap-chart" class="w-full h-full" class:hidden={showNetworkDiagram}></div>
      </div>
    </div>

    <!-- Topics Table -->
    <div class="bg-white rounded-lg shadow-sm p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Topic Details</h2>
        <span class="text-sm text-gray-500">{filteredTopics.length} topics</span>
      </div>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Posts</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keywords</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredTopics.slice(0, 50) as topic}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="w-3 h-3 rounded-full mr-3" style="background-color: {getCategoryColor(topic.category)}"></div>
                    <div class="text-sm font-medium text-gray-900">{topic.name}</div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style="background-color: {getCategoryColor(topic.category)}20; color: {getCategoryColor(topic.category)}">
                    {topic.category}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {topic.size.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                      <div class="bg-blue-600 h-2 rounded-full" style="width: {topic.weight * 100}%"></div>
                    </div>
                    <span class="text-sm text-gray-500">{(topic.weight * 100).toFixed(1)}%</span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex flex-wrap gap-1">
                    {#each topic.keywords.slice(0, 3) as keyword}
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {keyword}
                      </span>
                    {/each}
                    {#if topic.keywords.length > 3}
                      <span class="text-xs text-gray-500">+{topic.keywords.length - 3} more</span>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    on:click={() => selectTopic(topic)}
                    class="text-blue-600 hover:text-blue-900">
                    Analyze
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      
      {#if filteredTopics.length > 50}
        <div class="mt-4 text-center">
          <p class="text-sm text-gray-500">Showing first 50 topics. Use filters to narrow results.</p>
        </div>
      {/if}
    </div>
  </div>
</div>