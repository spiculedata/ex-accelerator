import { describe, expect, it } from 'vitest';
import { createFailureMessage, isEmail, nameProblem, typeLabel } from './projectForm';

describe('isEmail', () => {
  it.each(['a@b.co', 'first.last+tag@example.org'])('accepts %s', (value) => expect(isEmail(value)).toBe(true));
  it.each(['notanemail', 'a@b', '@b.co', 'a b@c.co', 'a@b..co', ''])('rejects "%s"', (value) => expect(isEmail(value)).toBe(false));
});

describe('nameProblem', () => {
  it('asks for a name when it is blank or only spaces', () => {
    expect(nameProblem('')).toBe('Enter a project name');
    expect(nameProblem('   ')).toBe('Enter a project name');
    expect(nameProblem('Marlow Bay')).toBeNull();
  });
});

describe('createFailureMessage', () => {
  it('turns a duplicate-name failure into a plain sentence about the name', () => {
    expect(createFailureMessage('Project "Marlow" already exists')).toEqual({ field: 'name', message: 'A project with this name already exists. Choose another name.' });
  });

  it('keeps other failures general and never repeats server detail', () => {
    expect(createFailureMessage('connect ECONNREFUSED 10.0.0.1:5432')).toEqual({ field: 'form', message: 'The project could not be created. Try again in a moment.' });
    expect(createFailureMessage(undefined).field).toBe('form');
  });
});

describe('typeLabel', () => {
  it('uses the names the new project form offers', () => {
    expect(typeLabel('social-media')).toBe('Social Media Analysis');
    expect(typeLabel('market-research')).toBe('Market Research');
  });

  it('turns any other slug into words instead of showing it raw', () => {
    expect(typeLabel('social_media')).toBe('Social media');
    expect(typeLabel('general')).toBe('General');
    expect(typeLabel('')).toBe('');
    expect(typeLabel(undefined)).toBe('');
  });
});
