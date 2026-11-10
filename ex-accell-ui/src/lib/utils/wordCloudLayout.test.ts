import { describe, expect, test, vi } from 'vitest';
import {
	layoutWordCloud,
	type WordCloudLayoutLike,
	type WordCloudLayoutOptions,
	type WordCloudWord
} from './wordCloudLayout';

const OPTIONS: WordCloudLayoutOptions = {
	width: 400,
	height: 200,
	font: 'Inter, sans-serif',
	padding: 4,
	rotate: () => 0
};

function createStubLayout(overrides: Partial<WordCloudLayoutLike> = {}): WordCloudLayoutLike {
	return {
		getSprite: vi.fn((text, options) => ({ text, ...options })),
		place: vi.fn((sprite) => ({ ...sprite, x: 10, y: 20 })),
		...overrides
	};
}

describe('layoutWordCloud', () => {
	test('prepares sprites largest first without mutating the input', () => {
		// Arrange
		const words: WordCloudWord[] = [
			{ text: 'small', size: 12, rawSize: 1 },
			{ text: 'large', size: 48, rawSize: 9 },
			{ text: 'medium', size: 24, rawSize: 4 }
		];
		const layout = createStubLayout();

		// Act
		const placed = layoutWordCloud(words, OPTIONS, layout);

		// Assert
		expect(placed.map((w) => w.text)).toEqual(['large', 'medium', 'small']);
		expect(words.map((w) => w.text)).toEqual(['small', 'large', 'medium']);
	});

	test('passes font, padding, size and rotation to each sprite', () => {
		// Arrange
		const words: WordCloudWord[] = [{ text: 'hello', size: 30, rawSize: 7 }];
		const layout = createStubLayout();
		const rotate = vi.fn(() => 90);

		// Act
		layoutWordCloud(words, { ...OPTIONS, rotate }, layout);

		// Assert
		expect(rotate).toHaveBeenCalledWith(words[0]);
		expect(layout.getSprite).toHaveBeenCalledWith('hello', {
			datum: words[0],
			font: OPTIONS.font,
			padding: OPTIONS.padding,
			size: 30,
			rotate: 90
		});
	});

	test('returns placement coordinates together with the original counts', () => {
		// Arrange
		const words: WordCloudWord[] = [{ text: 'hello', size: 30, rawSize: 7 }];
		const layout = createStubLayout({
			place: vi.fn((sprite) => ({ ...sprite, x: -15, y: 8, rotate: 90 }))
		});

		// Act
		const placed = layoutWordCloud(words, OPTIONS, layout);

		// Assert
		expect(placed).toEqual([{ text: 'hello', size: 30, rawSize: 7, x: -15, y: 8, rotate: 90 }]);
	});

	test('skips words whose sprite cannot be built or placed', () => {
		// Arrange
		const words: WordCloudWord[] = [
			{ text: 'kept', size: 40, rawSize: 5 },
			{ text: 'nosprite', size: 30, rawSize: 4 },
			{ text: 'noroom', size: 20, rawSize: 3 }
		];
		const layout = createStubLayout({
			getSprite: vi.fn((text, options) => (text === 'nosprite' ? null : { text, ...options })),
			place: vi.fn((sprite) => (sprite.text === 'noroom' ? null : { ...sprite, x: 0, y: 0 }))
		});

		// Act
		const placed = layoutWordCloud(words, OPTIONS, layout);

		// Assert
		expect(placed.map((w) => w.text)).toEqual(['kept']);
	});

	test('returns an empty list for no words', () => {
		// Arrange
		const layout = createStubLayout();

		// Act
		const placed = layoutWordCloud([], OPTIONS, layout);

		// Assert
		expect(placed).toEqual([]);
		expect(layout.getSprite).not.toHaveBeenCalled();
	});
});
