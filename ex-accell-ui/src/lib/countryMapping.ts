import { countries } from 'countries-list';

// English overrides for countries that might have non-English names
const englishOverrides: { [key: string]: string } = {
  'CN': 'China',
  'KR': 'South Korea',
  'KP': 'North Korea',
  'JP': 'Japan',
  'RU': 'Russia',
  'DE': 'Germany',
  'FR': 'France',
  'ES': 'Spain',
  'IT': 'Italy',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'CH': 'Switzerland',
  'AT': 'Austria',
  'CZ': 'Czech Republic',
  'SK': 'Slovakia',
  'HU': 'Hungary',
  'PL': 'Poland',
  'RO': 'Romania',
  'BG': 'Bulgaria',
  'GR': 'Greece',
  'TR': 'Turkey',
  'UA': 'Ukraine',
  'BY': 'Belarus',
  'LT': 'Lithuania',
  'LV': 'Latvia',
  'EE': 'Estonia',
  'FI': 'Finland',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'IS': 'Iceland'
};

/**
 * Maps 2-letter ISO country codes to full country names in English
 * @param countryCode - 2-letter ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'FR')
 * @returns Full country name in English or undefined if code not found
 */
export function getCountryName(countryCode: string): string | undefined {
  const code = countryCode.toUpperCase();
  
  // Check English overrides first
  if (englishOverrides[code]) {
    return englishOverrides[code];
  }
  
  // Fall back to countries-list package
  return countries[code as keyof typeof countries]?.name;
}

/**
 * Maps 2-letter ISO country codes to full country names with fallback
 * @param countryCode - 2-letter ISO 3166-1 alpha-2 country code
 * @param fallback - Fallback value if country code not found (default: 'Unknown')
 * @returns Full country name or fallback value
 */
export function getCountryNameWithFallback(countryCode: string, fallback: string = 'Unknown'): string {
  return getCountryName(countryCode) ?? fallback;
}

/**
 * Gets all available country mappings
 * @returns Object with country codes as keys and country data as values
 */
export function getAllCountries() {
  return countries;
}

/**
 * Gets array of all country codes
 * @returns Array of 2-letter country codes
 */
export function getCountryCodes(): string[] {
  return Object.keys(countries);
}

/**
 * Gets array of all country names
 * @returns Array of country names
 */
export function getCountryNames(): string[] {
  return Object.values(countries).map(country => country.name);
}

/**
 * Maps an array of country codes to country names
 * @param countryCodes - Array of 2-letter country codes
 * @param fallback - Fallback value for invalid codes (default: 'Unknown')
 * @returns Array of country names
 */
export function mapCountryCodes(countryCodes: string[], fallback: string = 'Unknown'): string[] {
  return countryCodes.map(code => getCountryNameWithFallback(code, fallback));
}