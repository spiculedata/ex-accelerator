import { getAllCountries } from '$lib/countryMapping';

// Global South countries list from BISA
export const GLOBAL_SOUTH_COUNTRIES = [
  'Afghanistan', 'Algeria', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Bahamas', 'Bahrain',
  'Bangladesh', 'Barbados', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina',
  'Botswana', 'Brazil', 'Brunei Darussalam', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cape Verde',
  'Cambodia', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
  'Congo (Dem. Rep.)', 'Congo (Republic of)', 'Costa Rica', "Côte d'Ivoire", 'Ivory Coast', 'Cuba',
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

/** The ISO code of the country with this name, by exact match first and then by partial match; null when none fits. */
export function getCountryCodeByName(countryName: string): string | null {
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

/** Global South country codes that appear in the available countries. */
export function getGlobalSouthCountryCodes(availableCountries: string[]): string[] {
  return GLOBAL_SOUTH_COUNTRIES.map((name) => getCountryCodeByName(name)).filter(
    (code) => code && availableCountries.includes(code)
  ) as string[];
}
