import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { MangaChapter } from '$lib/types/manga';

// Estado do leitor
export const currentChapter = writable<MangaChapter | null>(null);
export const currentPageIndex = writable<number>(0);
export const currentFrameIndex = writable<number>(0);
export const navigationDirection = writable<'forward' | 'backward' | null>(null);
// Reading direction: left-to-right or right-to-left; default 'ltr'
const initialDirection = browser && localStorage.getItem('readingDirection') ? (localStorage.getItem('readingDirection') as 'ltr' | 'rtl') : 'ltr';
export const readingDirection = writable<'ltr' | 'rtl'>(initialDirection);

// Toggle helper and persistence
export function toggleReadingDirection() {
	readingDirection.update((d) => {
		const next = d === 'ltr' ? 'rtl' : 'ltr';
		if (browser) localStorage.setItem('readingDirection', next);
		return next;
	});
}

// Persist any change to readingDirection to localStorage when in browser
if (browser) {
	readingDirection.subscribe((dir) => localStorage.setItem('readingDirection', dir));
}

// Páginas derivadas (anterior, atual, próxima)
export const pages = derived(
	[currentChapter, currentPageIndex],
	([$currentChapter, $currentPageIndex]) => {
		if (!$currentChapter) {
			return {
				previous: null,
				current: null,
				next: null
			};
		}

		const pages = $currentChapter.pages;
		return {
			previous: $currentPageIndex > 0 ? pages[$currentPageIndex - 1] : null,
			current: pages[$currentPageIndex] || null,
			next: $currentPageIndex < pages.length - 1 ? pages[$currentPageIndex + 1] : null
		};
	}
);

// Funções para navegar
export function nextPage() {
	navigationDirection.set('forward');
	const ANIMATION_MS = 800;
	const currentIdx = get(currentPageIndex);
	setTimeout(() => {
		// Limpa os pinned frames da página atual antes de mudar
		clearPinnedFramesForPage(currentIdx);
		currentPageIndex.update((index) => index + 1);
		currentFrameIndex.set(0);
		setTimeout(() => navigationDirection.set(null), 80);
	}, ANIMATION_MS);
}

export function previousPage() {
	navigationDirection.set('backward');
	const ANIMATION_MS = 800;
	const currentIdx = get(currentPageIndex);
	setTimeout(() => {
		// Limpa os pinned frames da página atual antes de mudar
		clearPinnedFramesForPage(currentIdx);
		currentPageIndex.update((index) => {
			const nextIndex = Math.max(0, index - 1);
			return nextIndex;
		});
		currentFrameIndex.set(0);
		setTimeout(() => navigationDirection.set(null), 80);
	}, ANIMATION_MS);
}

export function nextOrFrame(chapter: MangaChapter | null) {
	const idx = get(currentPageIndex);
	const frameIdx = get(currentFrameIndex);
	const page = chapter?.pages?.[idx];
	if (page && page.frames && frameIdx < page.frames.length - 1) {
		// advance frame
		currentFrameIndex.update((f) => f + 1);
		return { type: 'frame' };
	}
	// else advance page
	nextPage();
	return { type: 'page' };
}

export function previousOrFrame(chapter: MangaChapter | null) {
	const idx = get(currentPageIndex);
	const frameIdx = get(currentFrameIndex);
	const page = chapter?.pages?.[idx];
	if (page && page.frames && frameIdx > 0) {
		// previous frame
		currentFrameIndex.update((f) => Math.max(0, f - 1));
		return { type: 'frame' };
	}
	// else previous page
	previousPage();
	return { type: 'page' };
}

// Pinned frames (frames that have been "pushed" into the center and remain visible)
// keyed by page index (number), each value is an array with pinned frame indexes in order
export const pinnedFrames = writable<Record<number, number[]>>({});

// Deriva os índices dos frames restantes (não lidos) da página atual
// IMPORTANTE: Deve ser declarado DEPOIS de pinnedFrames
export const remainingFrameIndexes = derived(
	[currentChapter, currentPageIndex, currentFrameIndex, pinnedFrames],
	([$currentChapter, $currentPageIndex, $currentFrameIndex, $pinnedFrames]) => {
		if (!$currentChapter) return [];
		const page = $currentChapter.pages[$currentPageIndex];
		if (!page?.frames?.length) return [];
		
		const pinned = $pinnedFrames[$currentPageIndex] ?? [];
		const currentAndPinned = new Set([...pinned, $currentFrameIndex]);
		
		// Retorna índices dos frames que NÃO são pinned e NÃO são o atual
		return page.frames
			.map((_, idx) => idx)
			.filter(idx => !currentAndPinned.has(idx));
	}
);

// Deriva os índices dos frames já lidos (pinned) da página atual
export const readFrameIndexes = derived(
	[currentPageIndex, pinnedFrames],
	([$currentPageIndex, $pinnedFrames]) => {
		return $pinnedFrames[$currentPageIndex] ?? [];
	}
);

export function pinFrameForPage(pageIndex: number, frameIndex: number) {
	pinnedFrames.update((map) => {
		// clone map and array to ensure reactivity
		const newMap = { ...(map || {}) } as Record<number, number[]>;
		const arr = (newMap[pageIndex] ?? []).slice();
		if (!arr.includes(frameIndex)) arr.push(frameIndex);
		newMap[pageIndex] = arr;
		console.log('[PIN] page:', pageIndex, 'frameIndex:', frameIndex, 'pinnedArr:', arr, 'newMap:', newMap);
		return newMap;
	});
}

export function unpinLastFrameForPage(pageIndex: number) {
	pinnedFrames.update((map) => {
		const newMap = { ...(map || {}) } as Record<number, number[]>;
		const arr = (newMap[pageIndex] ?? []).slice();
		if (arr.length > 0) arr.pop();
		newMap[pageIndex] = arr;
		// debug removed in production
		return newMap;
	});
}

export function clearPinnedFramesForPage(pageIndex: number) {
	pinnedFrames.update((map) => {
		const newMap = { ...(map || {}) } as Record<number, number[]>;
		if (newMap[pageIndex]) delete newMap[pageIndex];
		return newMap;
	});
}

// Update frame image position or element properties
export function updateFrameImagePosition(pageIndex: number, frameIndex: number, imagePosition: { left?: number; top?: number; size?: number }) {
	currentChapter.update((c) => {
		if (!c) return c;
		const chapter = JSON.parse(JSON.stringify(c));
		const page = chapter.pages[pageIndex];
		if (!page || !page.frames || !page.frames[frameIndex]) return c;
		page.frames[frameIndex].imagePosition = { ...(page.frames[frameIndex].imagePosition || {}), ...(imagePosition || {}) };
		return chapter;
	});
}

export function updateFrameElement(pageIndex: number, frameIndex: number, elementId: string, data: { left?: number; top?: number; width?: number; height?: number }) {
	currentChapter.update((c) => {
		if (!c) return c;
		const chapter = JSON.parse(JSON.stringify(c));
		const page = chapter.pages[pageIndex];
		if (!page || !page.frames || !page.frames[frameIndex]) return c;
		const el = page.frames[frameIndex].elements?.find((x: any) => x.id === elementId);
		if (!el) return c;
		el.left = typeof data.left === 'number' ? data.left : el.left;
		el.top = typeof data.top === 'number' ? data.top : el.top;
		el.width = typeof data.width === 'number' ? data.width : el.width;
		el.height = typeof data.height === 'number' ? data.height : el.height;
		return chapter;
	});
}

export function goToPage(index: number) {
	currentPageIndex.set(index);
	// when navigating directly to a new page, reset the current frame index
	currentFrameIndex.set(0);
}
