<script lang="ts">
	import { currentPageIndex, pages, nextPage, previousPage } from '$lib/stores/reader';

	let canGoPrevious = false;
	let canGoNext = false;

	// Reage às mudanças das páginas
	$: {
		canGoPrevious = $pages.previous !== null;
		canGoNext = $pages.next !== null;
	}

	// Atalhos de teclado
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft' && canGoPrevious) {
			previousPage();
		} else if (event.key === 'ArrowRight' && canGoNext) {
			nextPage();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="controls">
	<button
		class="control-btn prev"
		on:click={previousPage}
		disabled={!canGoPrevious}
		aria-label="Página anterior"
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
			<path d="M15 18l-6-6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>

	<div class="page-indicator">
		<span class="current">{$currentPageIndex + 1}</span>
		<span class="separator">/</span>
		<span class="total">{$pages.current ? '∞' : '0'}</span>
	</div>

	<button
		class="control-btn next"
		on:click={nextPage}
		disabled={!canGoNext}
		aria-label="Próxima página"
	>
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
			<path d="M9 18l6-6-6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>
</div>

<style>
	.controls {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 2rem;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(10px);
		padding: 1rem 2rem;
		border-radius: 50px;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.1);
		z-index: 100;
	}

	.control-btn {
		width: 50px;
		height: 50px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.2);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.control-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.4);
		transform: scale(1.1);
	}

	.control-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.control-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.page-indicator {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-family: monospace;
		color: white;
		font-size: 1.2rem;
		font-weight: 600;
		min-width: 80px;
		justify-content: center;
	}

	.current {
		font-size: 1.5rem;
		color: #00ff88;
	}

	.separator {
		opacity: 0.5;
	}

	.total {
		opacity: 0.7;
	}

	@media (max-width: 768px) {
		.controls {
			bottom: 1rem;
			padding: 0.75rem 1.5rem;
			gap: 1rem;
		}

		.control-btn {
			width: 40px;
			height: 40px;
		}

		.page-indicator {
			font-size: 1rem;
		}

		.current {
			font-size: 1.2rem;
		}
	}
</style>
