<script lang="ts">
	import { pages, navigationDirection, goToPage, currentPageIndex, readingDirection, currentFrameIndex, nextOrFrame, previousOrFrame, currentChapter, pinnedFrames, pinFrameForPage, unpinLastFrameForPage, clearPinnedFramesForPage, toggleReadingDirection } from '$lib/stores/reader';
	import MangaPage from './MangaPage.svelte';
	import PageNavigator from './PageNavigator.svelte';
	import { get } from 'svelte/store';
	import { tick } from 'svelte';
	import { onDestroy } from 'svelte';

	// Refs para os elementos de imagem das três boxes
	let leftImg: HTMLElement | null = null;
	let centerImg: HTMLElement | null = null;
	let rightImg: HTMLElement | null = null;
	let containerEl: HTMLElement | null = null;
	let isPageAnimating: boolean = false;
	let isFrameAnimating: boolean = false;
	// Note: This project intentionally does not include an in-app editor UI;
	// allow editing programmatically via mock data or store helpers.

	// Audio management - separado por hierarquia
	let pageAudios: HTMLAudioElement[] = [];   // sons da página (loop, ambiente)
	let frameAudios: HTMLAudioElement[] = [];  // sons do frame atual (sobrepostos)

	function stopPageAudios() {
		pageAudios.forEach(audio => {
			audio.pause();
			audio.currentTime = 0;
		});
		pageAudios = [];
	}

	function stopFrameAudios() {
		frameAudios.forEach(audio => {
			audio.pause();
			audio.currentTime = 0;
		});
		frameAudios = [];
	}

	function stopAllAudios() {
		stopPageAudios();
		stopFrameAudios();
	}

	function playPageSounds(pageSounds: { url: string; volume: number; loop: boolean }[] | undefined) {
		stopPageAudios(); // só para sons de página, mantém sons de frame
		if (!pageSounds || pageSounds.length === 0) return;
		
		pageSounds.forEach(sound => {
			const audio = new Audio(sound.url);
			audio.volume = sound.volume;
			audio.loop = sound.loop;
			audio.play().catch(err => console.warn('Page audio play failed:', err));
			pageAudios.push(audio);
		});
	}

	function playFrameSounds(frameSounds: { url: string; volume?: number; loop?: boolean }[] | undefined) {
		stopFrameAudios(); // só para sons de frame, mantém sons de página
		if (!frameSounds || frameSounds.length === 0) return;
		
		frameSounds.forEach(sound => {
			const audio = new Audio(sound.url);
			audio.volume = sound.volume ?? 1.0;
			audio.loop = sound.loop ?? false;
			audio.play().catch(err => console.warn('Frame audio play failed:', err));
			frameAudios.push(audio);
		});
	}

	// Reagir a mudanças de página e tocar sons
	$: if ($pages.current?.sounds) {
		playPageSounds($pages.current.sounds);
	} else if ($pages.current && !$pages.current.sounds) {
		stopPageAudios();
	}

	// Reagir a mudanças de frame e tocar sons (sobrepostos aos da página)
	$: {
		const page = $pages.current;
		const frameIdx = $currentFrameIndex;
		if (page?.frames && page.frames.length > 0) {
			const frame = page.frames[frameIdx];
			if (frame?.sounds) {
				playFrameSounds(frame.sounds);
			} else {
				stopFrameAudios();
			}
		} else {
			stopFrameAudios();
		}
	}

	function registerLeft(el: HTMLElement | null) { leftImg = el; }
	function registerCenter(el: HTMLElement | null) { centerImg = el; }
	function registerRight(el: HTMLElement | null) { rightImg = el; }

	// compute pinned frames indices for left/center/right - usando $ para reatividade
	$: prevPinned = $pinnedFrames[$currentPageIndex - 1] ?? [];
	$: centerPinned = $pinnedFrames[$currentPageIndex] ?? [];
	$: nextPinned = $pinnedFrames[$currentPageIndex + 1] ?? [];

	// animate frame change: pin/unpin frames within the current page
	// Forward: pin o frame ATUAL (que estava sendo visualizado) antes de avançar
	// Backward: unpin o último pinned e volta para ele
	async function animateFrameChange(direction: 'forward' | 'backward') {
		if (isFrameAnimating || isPageAnimating) return;
		isFrameAnimating = true;
		const pageIdx = get(currentPageIndex);
		const frameIdx = get(currentFrameIndex);
		const chapter = get(currentChapter);
		const page = chapter?.pages?.[pageIdx];
		if (!page || !page.frames || page.frames.length === 0) {
			isFrameAnimating = false;
			return;
		}

		if (direction === 'forward') {
			// Verifica se tem mais frames para avançar
			if (frameIdx >= page.frames.length - 1) {
				isFrameAnimating = false;
				return;
			}
			const targetIdx = frameIdx + 1;

			// Cria overlay para transição suave do novo frame
			const overlay = document.createElement('div');
			overlay.className = 'fly-overlay';
			overlay.style.cssText = 'position:absolute; inset:0; pointer-events:none; z-index:9999; display:flex; align-items:center; justify-content:center;';

			const frame = page.frames[targetIdx];
			const img = new Image();
			img.src = frame.imageUrl || page.imageUrl || '';
			img.style.cssText = 'width:100%; height:100%; object-fit:contain; display:block;';
			overlay.appendChild(img);
			containerEl?.appendChild(overlay);
			if (!img.complete) {
				await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
			}
			overlay.style.transition = 'opacity 240ms ease';
			overlay.style.opacity = '0';
			requestAnimationFrame(() => (overlay.style.opacity = '1'));
			await new Promise<void>((resolve) => {
				const h = (e: TransitionEvent) => { if (e.target === overlay && e.propertyName === 'opacity' && overlay.style.opacity === '1') { overlay.removeEventListener('transitionend', h as any); resolve(); } };
				overlay.addEventListener('transitionend', h as any);
				setTimeout(resolve, 300);
			});

			// PRIMEIRO: pina o frame atual (que vai ficar "por baixo")
			pinFrameForPage(pageIdx, frameIdx);
			// DEPOIS: avança para o próximo frame
			currentFrameIndex.set(targetIdx);
			await tick();

			requestAnimationFrame(() => (overlay.style.opacity = '0'));
			await new Promise<void>((resolve) => {
				const h = (e: TransitionEvent) => { if (e.target === overlay && e.propertyName === 'opacity' && overlay.style.opacity === '0') { overlay.removeEventListener('transitionend', h as any); resolve(); } };
				overlay.addEventListener('transitionend', h as any);
				setTimeout(resolve, 300);
			});
			overlay.remove();
		} else {
			// Backward: verifica se tem frames pinados para despinar
			const pinnedMap = get(pinnedFrames);
			const pinnedForPage = pinnedMap[pageIdx] ?? [];
			if (pinnedForPage.length === 0) {
				isFrameAnimating = false;
				return;
			}
			
			// O último pinned será o novo frame atual
			const lastPinnedIdx = pinnedForPage[pinnedForPage.length - 1];

			// Cria overlay para transição suave
			const overlay = document.createElement('div');
			overlay.className = 'fly-overlay';
			overlay.style.cssText = 'position:absolute; inset:0; pointer-events:none; z-index:9999; display:flex; align-items:center; justify-content:center;';

			const frame = page.frames[lastPinnedIdx];
			const img = new Image();
			img.src = frame?.imageUrl || page.imageUrl || '';
			img.style.cssText = 'width:100%; height:100%; object-fit:contain; display:block;';
			overlay.appendChild(img);
			containerEl?.appendChild(overlay);
			if (!img.complete) {
				await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
			}
			overlay.style.transition = 'opacity 240ms ease';
			overlay.style.opacity = '0';
			requestAnimationFrame(() => (overlay.style.opacity = '1'));
			await new Promise<void>((resolve) => {
				const h = (e: TransitionEvent) => { if (e.target === overlay && e.propertyName === 'opacity' && overlay.style.opacity === '1') { overlay.removeEventListener('transitionend', h as any); resolve(); } };
				overlay.addEventListener('transitionend', h as any);
				setTimeout(resolve, 300);
			});

			// PRIMEIRO: despina o último frame
			unpinLastFrameForPage(pageIdx);
			// DEPOIS: volta para esse frame
			currentFrameIndex.set(lastPinnedIdx);
			await tick();

			requestAnimationFrame(() => (overlay.style.opacity = '0'));
			await new Promise<void>((resolve) => {
				const h = (e: TransitionEvent) => { if (e.target === overlay && e.propertyName === 'opacity' && overlay.style.opacity === '0') { overlay.removeEventListener('transitionend', h as any); resolve(); } };
				overlay.addEventListener('transitionend', h as any);
				setTimeout(resolve, 300);
			});
			overlay.remove();
		}

		isFrameAnimating = false;
	}

	// Debug string for pinned indexes
	$: pinnedDebug = centerPinned && centerPinned.length ? centerPinned.join(',') : 'none';

	// Função que cria o overlay, anima e atualiza o índice no fim
	async function animateFly(direction: 'forward' | 'backward') {
		// incoming wrapper is the source of the flying-in image
		// Decide incoming wrapper according to reading direction
		const dir = $readingDirection || 'ltr';
		const incomingWrapper = direction === 'forward' ? (dir === 'ltr' ? rightImg : leftImg) : (dir === 'ltr' ? leftImg : rightImg);
		const centerWrapper = centerImg;
		// Snapshot pages/current index for debugging if needed
		if (!incomingWrapper || !centerWrapper || !containerEl) {
			// Re-run without animation if refs missing
			// Fallback: atualiza a página imediatamente sem animação
			const idx = get(currentPageIndex);
			const nextIdx = direction === 'forward' ? idx + 1 : Math.max(0, idx - 1);
			goToPage(nextIdx);
			// limpa direção por segurança
			navigationDirection.set(null);
			return;
		}

		// removed nested animateFrameChange block (handled by top-level animateFrameChange now)

		// NÃO marcar navegação aqui — se marcarmos, as páginas laterais podem desaparecer
		// antes de capturarmos seus bounding rects. O overlay elimina a necessidade de
		// esconder laterais durante a animação.

		// Desabilita transições no container enquanto animamos/alteramos o DOM
		containerEl.classList.add('no-transitions');
		// Marcar animacao de pagina ativa (esconde o centro estático durante a animação)
		isPageAnimating = true;
		const containerRect = containerEl.getBoundingClientRect();
		const srcRect = incomingWrapper.getBoundingClientRect();
		const destRect = centerWrapper.getBoundingClientRect();

		// calcular posições relativas ao container
		const src = {
			left: srcRect.left - containerRect.left,
			top: srcRect.top - containerRect.top,
			width: srcRect.width,
			height: srcRect.height
		};
		const dest = {
			left: destRect.left - containerRect.left,
			top: destRect.top - containerRect.top,
			width: destRect.width,
			height: destRect.height
		};

		const overlay = document.createElement('div');
		overlay.className = 'fly-overlay';
		overlay.style.position = 'absolute';
		overlay.style.left = `${src.left}px`;
		overlay.style.top = `${src.top}px`;
		overlay.style.width = `${src.width}px`;
		overlay.style.height = `${src.height}px`;
		overlay.style.pointerEvents = 'none';
		overlay.style.zIndex = '9999';
		overlay.style.transformOrigin = 'top left';

		// criar clone mais previsível via new Image() (evita estilos herdados)
		const srcAttr = (incomingWrapper.querySelector && (incomingWrapper.querySelector('img') as HTMLImageElement)?.src) || '';
		const imgElement = new Image();
		imgElement.src = srcAttr;
		imgElement.style.width = '100%';
		imgElement.style.height = '100%';
		imgElement.style.objectFit = 'contain';
		imgElement.style.display = 'block';

		overlay.appendChild(imgElement);
		containerEl.appendChild(overlay);

		// aguardar load da imagem do overlay para evitar render jump
		if (!imgElement.complete) {
			await new Promise<void>((resolve) => {
				imgElement.onload = () => resolve();
				imgElement.onerror = () => resolve();
			});
		}

		// logs de depuração — ajuda a diagnosticar shrink
		// Debug logs removed to keep runtime clean

		// forçar reflow antes de animar
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		overlay.getBoundingClientRect();

		const duration = 800;

		// animar left/top/width/height diretamente (evita efeitos com object-fit+transform)
		overlay.style.transition = `left ${duration}ms cubic-bezier(0.22, 0.9, 0.3, 1), top ${duration}ms cubic-bezier(0.22, 0.9, 0.3, 1), width ${duration}ms cubic-bezier(0.22, 0.9, 0.3, 1), height ${duration}ms cubic-bezier(0.22, 0.9, 0.3, 1)`;

		// iniciar animação para destino
		requestAnimationFrame(() => {
			overlay.style.left = `${dest.left}px`;
			overlay.style.top = `${dest.top}px`;
			overlay.style.width = `${dest.width}px`;
			overlay.style.height = `${dest.height}px`;
		});

		await new Promise<void>((resolve) => {
			const onEnd = (e: TransitionEvent) => {
				// transição de largura ou esquerda indica fim
				if (e.target === overlay && (e.propertyName === 'left' || e.propertyName === 'width')) {
					overlay.removeEventListener('transitionend', onEnd as any);
					resolve();
				}
			};
			overlay.addEventListener('transitionend', onEnd as any);
		});

		// Preload destination image to ensure it renders at full size when we switch
		const pagesSnapshot = get(pages);
		const destPage = direction === 'forward' ? pagesSnapshot.next : pagesSnapshot.previous;
		let destLoadPromise: Promise<void> | null = null;
		if (destPage && destPage.imageUrl) {
			destLoadPromise = new Promise<void>((resolve) => {
				const di = new Image();
				di.onload = () => resolve();
				di.onerror = () => resolve();
				di.src = destPage.imageUrl ?? '';
			});
		}

		// Não remover o overlay ainda — vamos mantê-lo até a nova imagem estar pronta e então fazer um fade-out
		if (destLoadPromise) {
			await destLoadPromise;
		}
		const idx = get(currentPageIndex);
		const nextIdx = direction === 'forward' ? idx + 1 : Math.max(0, idx - 1);
		// trocar a página (vai causar re-render)
		goToPage(nextIdx);
		// Debug: inspeção do computed style do novo centro
		// Snap pagesAfter if needed

		// Garantir que a nova imagem do centro esteja dimensionada corretamente antes de mostrar
		await tick();
		// centerImg agora deve referenciar o novo centro — aplicar inline sizing temporária
		{ // block (was try) - ensure layout adjustments don't interrupt runtime
			if (centerImg && dest.width && dest.height) {
				const centerWrapper = centerImg as HTMLElement;
				// Guardar estilos previos para restaurar
				const prevWidth = centerWrapper.style.width;
				const prevHeight = centerWrapper.style.height;
				centerWrapper.style.width = `${dest.width}px`;
				centerWrapper.style.height = `${dest.height}px`;
				// Ajustar a imagem interna também
				const innerImg = centerWrapper.querySelector('img') as HTMLImageElement | null;
				let prevImgWidth: string | null = null;
				let prevImgHeight: string | null = null;
				if (innerImg) {
					prevImgWidth = innerImg.style.width;
					prevImgHeight = innerImg.style.height;
					innerImg.style.width = '100%';
					innerImg.style.height = '100%';
				}
				// Forçar reflow
				// eslint-disable-next-line @typescript-eslint/no-unused-expressions
				centerWrapper.getBoundingClientRect();
				// Deixar o tempo suficiente para o navegador realizar o layout
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				// Restaurar estilos (deixar o layout responsivo)
				centerWrapper.style.width = prevWidth;
				centerWrapper.style.height = prevHeight;
				if (innerImg) {
					innerImg.style.width = prevImgWidth || '';
					innerImg.style.height = prevImgHeight || '';
				}
					// Re-ativar transições no container
					containerEl.classList.remove('no-transitions');
					// Fade out overlay now that center static should be ready
					{ // block (was try) - overlay fade/append section
						overlay.style.transition = `opacity 180ms ease`;
						overlay.style.opacity = '0';
						await new Promise<void>((resolve) => {
							const onEnd = (e: TransitionEvent) => {
								if (e.target === overlay && e.propertyName === 'opacity') {
									overlay.removeEventListener('transitionend', onEnd as any);
									resolve();
								}
							};
							overlay.addEventListener('transitionend', onEnd as any);
							// safety fallback
							setTimeout(resolve, 300);
						});
						// fade out overlay and cleanup
						overlay.remove();
						containerEl.classList.remove('no-transitions');
						isPageAnimating = false;
						navigationDirection.set(null);
					}
				}
			    }
	}

	async function onNavigate(event: CustomEvent) {
		if (isPageAnimating || isFrameAnimating) return;
		const dir = event.detail.direction as 'forward' | 'backward';
		const chapter = get(currentChapter);
		const pageIdx = get(currentPageIndex);
		const frameIdx = get(currentFrameIndex);
		const page = chapter?.pages?.[pageIdx] ?? null;
		const pinnedMap = get(pinnedFrames);
		const pinnedForPage = pinnedMap?.[pageIdx] ?? [];
		const framesTotal = page?.frames?.length ?? 0;
		const framesShown = (pinnedForPage?.length ?? 0) + 1; // initial frame counts
		
		console.log('[onNavigate]', { dir, pageIdx, frameIdx, framesTotal, framesShown, pinnedForPage });

		if (dir === 'forward') {
			if (page && page.frames && framesShown < framesTotal) {
				// still have unpinned frames to show -> pin next frame
				console.log('[onNavigate] -> animateFrameChange forward');
				await animateFrameChange('forward');
			} else {
				// all frames of this page already pushed/pinned -> transition page
				console.log('[onNavigate] -> animateFly forward');
				await animateFly('forward');
			}
		} else {
			if (page && page.frames && pinnedForPage.length > 0) {
				// if we have pinned frames, unpin last on backward
				console.log('[onNavigate] -> animateFrameChange backward');
				await animateFrameChange('backward');
			} else {
				console.log('[onNavigate] -> animateFly backward');
				await animateFly('backward');
			}
		}
	}

	onDestroy(() => {
		navigationDirection.set(null);
		stopAllAudios();
	});
</script>

<div class="reader-container" bind:this={containerEl}>
	<!-- Reading direction toggle (small UI control) -->
	<button class="reading-direction-toggle" title="Toggle reading direction" aria-label="Toggle reading direction" on:click={() => toggleReadingDirection()} type="button">
		{#if $readingDirection === 'ltr'}
			<span>LTR</span>
		{:else}
			<span>RTL</span>
		{/if}
	</button>
	<!-- Editor UI removed: use store helpers or edit mocks in +page.svelte to configure frame positions and elements -->
	<div class="pages-wrapper">
		<!-- Página Anterior (Esquerda) -->
		<MangaPage page={$pages.previous} label="Página Lida" position="left" register={registerLeft} isAnimating={isPageAnimating} pinnedFrameIndexes={prevPinned} />

		<!-- Espaço para botão de voltar (esquerda) -->
		<div class="nav-space left">
				<PageNavigator position={'next'} on:navigate={onNavigate} />
			</div>

		<!-- Página Atual (Centro) -->
			<MangaPage page={$pages.current} label="Página Atual" position="center" register={registerCenter} isAnimating={isPageAnimating} pinnedFrameIndexes={centerPinned} />
			<!-- debug pin overlay removed -->
			<!-- Editor UI removed. Use store helpers or edit the mock (+page.svelte) to change frame positions and element sizes. -->

		<!-- Espaço para botão de avançar (direita) -->
		<div class="nav-space right">
			<PageNavigator position={'prev'} on:navigate={onNavigate} />
		</div>

		<!-- Próxima Página (Direita) -->
			<MangaPage page={$pages.next} label="Próxima Página" position="right" register={registerRight} isAnimating={isPageAnimating} pinnedFrameIndexes={nextPinned} />
	</div>
</div>

<style>
	.reader-container {
		width: 100%;
		height: 100vh;
		background: #ffffff;
		overflow: hidden;
		position: relative;
	}

	.pages-wrapper {
		display: flex;
		width: 100%;
		height: 100vh;
		align-items: center;
		justify-content: center;
		gap: 0;
		position: relative;
	}

	/* .debug-pins-overlay removed */

    /* Editor panel removed - editing must be done via code */

	.nav-space {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 100vh;
		flex-shrink: 0;
		position: relative;
	}

	@media (max-width: 768px) {
		.nav-space {
			width: 2.5rem;
		}
	}

	@media (max-width: 480px) {
		.nav-space {
			display: none;
		}
	}

	/* Animação de entrada */
	:global(.reader-container) {
		animation: fadeIn 0.8s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Overlay usado para animação de voo entre boxes */
	:global(.fly-overlay) {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		overflow: hidden;
		border-radius: 2px;
	}

	/* Desabilita todas transições internas temporariamente para evitar jumps */
	:global(.no-transitions) * {
		transition: none !important;
	}

	/* Small reading direction toggle */
	.reading-direction-toggle {
		position: absolute;
		right: 10px;
		top: 10px;
		z-index: 1200;
		background: rgba(255,255,255,0.95);
		border: 1px solid rgba(0,0,0,0.08);
		padding: 6px 8px;
		border-radius: 6px;
		font-size: 0.75rem;
		cursor: pointer;
		box-shadow: 0 6px 20px rgba(0,0,0,0.06);
		user-select: none;
	}
</style>
