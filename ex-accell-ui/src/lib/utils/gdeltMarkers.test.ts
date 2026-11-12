import { describe, expect, it } from 'vitest';
import { getEventTypeColor } from './gdeltEventTypes';
import { buildEventPopupHtml, hasCoordinates, markerOptions, markerRadius } from './gdeltMarkers';
import { GLOBAL_SOUTH_COUNTRIES, getCountryCodeByName, getGlobalSouthCountryCodes } from './gdeltCountries';

const event = { id: 12, eventCode: '40', country: 'US', goldstein: 2, tone: -1.234, date: 20260105, lat: 1, lng: 2, location: 'Place', actor1: 'A1', actor2: 'A2' };

describe('markers', () => {
  it('sizes the marker by the strength of the event, with a floor for missing values', () => {
    expect(markerRadius({ ...event, goldstein: 2 })).toBe(7);
    expect(markerRadius({ ...event, goldstein: -10 })).toBe(19);
    expect(markerRadius({ ...event, goldstein: 0 })).toBe(5.5);
    expect(markerRadius({ ...event, goldstein: null })).toBe(5.5);
  });

  it('places only events with coordinates', () => {
    expect(hasCoordinates(event)).toBe(true);
    expect(hasCoordinates({ ...event, lat: null })).toBe(false);
    expect(hasCoordinates({ ...event, lng: 0 })).toBe(false);
  });

  it('colours the marker by event type', () => {
    expect(markerOptions(event)).toEqual({ radius: 7, fillColor: getEventTypeColor('40'), color: '#fff', weight: 1, opacity: 1, fillOpacity: 0.8 });
  });
});

describe('buildEventPopupHtml', () => {
  it('describes the event and wires the two buttons', () => {
    const html = buildEventPopupHtml(event);
    expect(html).toContain('Event 12');
    expect(html).toContain('Support & Agreements');
    expect(html).toContain('<strong>Location:</strong> Place');
    expect(html).toContain('<strong>Goldstein Scale:</strong> 2.00');
    expect(html).toContain('<strong>Tone:</strong> -1.23');
    expect(html).toContain('<strong>Date:</strong> 2026-01-05');
    expect(html).toContain(`window.filterByCountry('US')`);
    expect(html).toContain('window.showEventMentions(12)');
    expect(html).toContain(`background-color: ${getEventTypeColor('40')}`);
  });

  it('uses fallbacks for missing details', () => {
    const html = buildEventPopupHtml({ id: 1, eventCode: '99', country: 'ZZ' });
    expect(html).toContain('Other');
    expect(html).toContain('Unknown event type');
    expect(html).toContain('<strong>Location:</strong> Unknown');
    expect(html).toContain('<strong>Actor 1:</strong> Unknown');
    expect(html).toContain('<strong>Goldstein Scale:</strong> N/A');
    expect(html).toContain('<strong>Tone:</strong> N/A');
  });
});

describe('Global South countries', () => {
  it('finds a code by exact name', () => {
    expect(getCountryCodeByName('Brazil')).toBe('BR');
    expect(getCountryCodeByName('brazil')).toBe('BR');
  });

  it('finds a code by a partial name and is null for unknown ones', () => {
    expect(getCountryCodeByName('Not A Country 123')).toBeNull();
  });

  it('keeps only the Global South countries that are available', () => {
    expect(GLOBAL_SOUTH_COUNTRIES).toContain('Brazil');
    expect(getGlobalSouthCountryCodes(['BR', 'FR', 'US'])).toEqual(['BR']);
    expect(getGlobalSouthCountryCodes([])).toEqual([]);
  });
});
