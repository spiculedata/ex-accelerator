/**
 * Word cloud placement on top of d3-cloud 2.x.
 *
 * d3-cloud 2 replaced the event-driven factory (`cloud().words().on('end').start()`)
 * with an explicit `getSprite()` / `place()` loop. This module owns that loop so the
 * chart component only renders the results, and so the loop can be tested with a
 * stub layout (jsdom has no canvas to rasterise sprites with).
 */

import CloudLayout, { type PlacedSprite, type SpriteOptions } from 'd3-cloud';

export interface WordCloudWord {
	text: string;
	/** Font size in pixels. */
	size: number;
	/** The underlying count, shown in tooltips and passed to click handlers. */
	rawSize: number;
}

export interface WordCloudPlacement extends WordCloudWord {
	x: number;
	y: number;
	rotate: number;
}

export interface WordCloudLayoutOptions {
	width: number;
	height: number;
	font: string;
	padding: number;
	rotate: (word: WordCloudWord) => number;
}

/** The subset of `CloudLayout` the loop needs; tests supply a stub. */
export interface WordCloudLayoutLike {
	getSprite(
		text: string,
		options: SpriteOptions<WordCloudWord> & { datum: WordCloudWord }
	): object | null;
	place(sprite: never): Pick<PlacedSprite<WordCloudWord>, 'x' | 'y' | 'rotate'> | null;
}

export function createCloudLayout(options: WordCloudLayoutOptions): WordCloudLayoutLike {
	return new CloudLayout()
		.size([options.width, options.height])
		.overflow(false)
		.strategy('archimedean') as unknown as WordCloudLayoutLike;
}

/**
 * Places words largest first and returns the ones that fit. Words whose sprite cannot
 * be rasterised or that find no free space are left out, as in d3-cloud 1.x.
 */
export function layoutWordCloud(
	words: readonly WordCloudWord[],
	options: WordCloudLayoutOptions,
	layout: WordCloudLayoutLike = createCloudLayout(options)
): WordCloudPlacement[] {
	const largestFirst = [...words].sort((a, b) => b.size - a.size);

	return largestFirst.flatMap((word) => {
		const sprite = layout.getSprite(word.text, {
			datum: word,
			font: options.font,
			padding: options.padding,
			size: word.size,
			rotate: options.rotate(word)
		});
		if (!sprite) return [];

		const placed = layout.place(sprite as never);
		if (!placed) return [];

		return [{ ...word, x: placed.x, y: placed.y, rotate: placed.rotate }];
	});
}
