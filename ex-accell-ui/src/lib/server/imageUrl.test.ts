import { describe, expect, it } from 'vitest';
import { imageUrlProblem } from './imageUrl';

describe('imageUrlProblem', () => {
  it('accepts web addresses', () => {
    expect(imageUrlProblem('https://example.com/cat.jpg')).toBeNull();
    expect(imageUrlProblem('http://example.com/a.png?x=1')).toBeNull();
  });

  it('says what is wrong, in words, for each kind of mistake', () => {
    expect(imageUrlProblem(undefined)).toBe('Paste the address of an image.');
    expect(imageUrlProblem('   ')).toBe('Paste the address of an image.');
    expect(imageUrlProblem('cat.jpg')).toBe('That is not a web address. It must start with http:// or https://.');
    expect(imageUrlProblem('ftp://example.com/cat.jpg')).toBe('Only http:// and https:// addresses can be analysed.');
    expect(imageUrlProblem('file:///etc/passwd')).toBe('Only http:// and https:// addresses can be analysed.');
  });
});
