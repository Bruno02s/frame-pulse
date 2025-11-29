<script lang="ts">
	import { currentPageIndex, currentFrameIndex, pages, pinnedFrames } from '$lib/stores/reader';
	import { onMount, createEventDispatcher } from 'svelte';

	export let position: 'next' | 'prev';
	const dispatch = createEventDispatcher();

	let canGoPrevious = false;
	let canGoNext = false;
	let touchStartX = 0;
	let touchEndX = 0;

	// Atualiza disponibilidade de navegação (considera frames também)
	$: {
		const currentPage = $pages.current;
		const framesTotal = currentPage?.frames?.length ?? 0;
		const pinnedForPage = $pinnedFrames[$currentPageIndex] ?? [];
		const framesShown = pinnedForPage.length + 1;
		
		// Pode ir para trás se: tem página anterior OU tem frames pinados para despinar
		canGoPrevious = $pages.previous !== null || pinnedForPage.length > 0;
		// Pode ir para frente se: tem próxima página OU ainda tem frames para mostrar
		canGoNext = $pages.next !== null || (framesTotal > 0 && framesShown < framesTotal);
	}

	$: showButton = position === 'next' ? canGoNext : canGoPrevious;

	// Atalhos de teclado
	function handleKeydown(event: KeyboardEvent) {
			// Map keys to this navigator's position (left/right button)
			if (event.key === 'ArrowLeft' && position === 'next' && canGoNext) {
				dispatch('navigate', { direction: 'forward' });
			} else if (event.key === 'ArrowRight' && position === 'prev' && canGoPrevious) {
				dispatch('navigate', { direction: 'backward' });
			}
	}

	// Gestos touch
	function handleTouchStart(event: TouchEvent) {
		touchStartX = event.touches[0].clientX;
	}

	function handleTouchEnd(event: TouchEvent) {
		touchEndX = event.changedTouches[0].clientX;
		handleSwipe();
	}

	function handleSwipe() {
		const swipeDistance = touchStartX - touchEndX;
		const minSwipeDistance = 50;

		if (Math.abs(swipeDistance) > minSwipeDistance) {
				// Use this navigator's position to interpret swipe
				if (position === 'next') {
					// left-side navigator wants swipe-left -> forward
					if (swipeDistance > 0 && canGoNext) {
						dispatch('navigate', { direction: 'forward' });
					}
				} else {
					// right-side navigator wants swipe-right -> backward
					if (swipeDistance < 0 && canGoPrevious) {
						dispatch('navigate', { direction: 'backward' });
					}
				}
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('touchstart', handleTouchStart);
		window.addEventListener('touchend', handleTouchEnd);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('touchstart', handleTouchStart);
			window.removeEventListener('touchend', handleTouchEnd);
		};
	});
</script>

{#if showButton}
	<button 
		class="nav-btn" 
		on:click={() => dispatch('navigate', { direction: position === 'next' ? 'forward' : 'backward' })}
		aria-label={position === 'next' ? 'Próxima página' : 'Página anterior'}
	>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
			{#if position === 'next'}
				<!-- left pointing arrow for next (inverted) -->
				<path d="M15 18l-6-6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
			{:else}
				<!-- right pointing arrow for prev (inverted) -->
				<path d="M9 18l6-6-6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
			{/if}
		</svg>
	</button>
{/if}

<style>
	.nav-btn {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(0, 0, 0, 0.12);
		color: #2a2a2a;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition-property: all;
		transition-duration: 0.2s;
		transition-timing-function: ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06);
		opacity: 0.7;
		flex-shrink: 0;
	}

	.nav-btn:hover {
		opacity: 1;
		transform: scale(1.08);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08);
	}

	.nav-btn:active {
		transform: scale(0.92);
	}

	@media (max-width: 768px) {
		.nav-btn {
			width: 36px;
			height: 36px;
			opacity: 0.5;
		}
	}

	@media (max-width: 480px) {
		.nav-btn {
			position: fixed;
			width: 32px;
			height: 32px;
			top: 50%;
			transform: translateY(-50%);
			z-index: 100;
		}

		.nav-btn:hover {
			transform: translateY(-50%) scale(1.08);
		}

		.nav-btn:active {
			transform: translateY(-50%) scale(0.92);
		}
	}
</style>
