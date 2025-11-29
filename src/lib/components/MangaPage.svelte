<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { navigationDirection, currentFrameIndex, currentPageIndex, updateFrameImagePosition } from '$lib/stores/reader';
	import { get } from 'svelte/store';
	import type { Page } from '$lib/types/manga';
	import { onMount, onDestroy } from 'svelte';

	export let page: Page | null = null;
	export let label: string;
	export let position: 'left' | 'center' | 'right';
export let register: (el: HTMLElement | null) => void = () => {};
	export let isAnimating: boolean = false;
	export let pinnedFrameIndexes: number[] = [];

	// Classes locais baseadas na posição (usamos classes próprias para evitar conflito com Tailwind)
	const positionClasses = {
		left: 'pos-left',
		center: 'pos-center',
		right: 'pos-right'
	};

	// Versão sem scale para usar durante a animação (evita "encolher/crescer")
	const noScaleClasses = {
		left: 'pos-left-noscale',
		center: 'pos-center-noscale',
		right: 'pos-right-noscale'
	};

	// Direção da animação baseada na posição e navegação
	$: flyDirection = (() => {
		const direction = $navigationDirection || 'forward';
		return direction === 'forward' ? 800 : -800;
	})();

	// Para saída: mesma distância mas direção oposta
	$: flyOutDirection = -flyDirection;

	// Aplica classes sem scale enquanto houver navegação em andamento
	$: appliedPositionClass = $navigationDirection ? noScaleClasses[position] : positionClasses[position];
	let imgEl: HTMLElement | null = null;
	let wrapperEl: HTMLElement | null = null;

	// Frame support: determine which image/url to display for this page
	let displayImageUrl: string | null = null;
	let frameElements: any[] | null = null;
	let displayFrame: any | null = null;
	let pinnedFramesObjects: any[] | null = null;

	async function detectImageContentCenter(imageUrl: string) {
		return new Promise<{ left: number; top: number }>((resolve) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				const w = img.width;
				const h = img.height;
				// Scale down the image for canvas processing to a max dimension of 800px
				const scale = Math.min(1, 800 / Math.max(w, h));
				const cw = Math.round(w * scale);
				const ch = Math.round(h * scale);
				const canvas = document.createElement('canvas');
				canvas.width = cw;
				canvas.height = ch;
				const ctx = canvas.getContext('2d');
				if (!ctx) return resolve({ left: 50, top: 50 });
				ctx.drawImage(img, 0, 0, cw, ch);
				const data = ctx.getImageData(0, 0, cw, ch).data;
				let minX = cw, minY = ch, maxX = 0, maxY = 0;
				for (let y = 0; y < ch; y++) {
					for (let x = 0; x < cw; x++) {
						const idx = (y * cw + x) * 4;
						const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
						// Heuristic: consider pixel as content if not fully transparent and not near-white
						if (a > 10 && !(r > 245 && g > 245 && b > 245)) {
							if (x < minX) minX = x;
							if (y < minY) minY = y;
							if (x > maxX) maxX = x;
							if (y > maxY) maxY = y;
						}

                        

                        

                        

                        

                        
					}
				}
				if (minX > maxX || minY > maxY) {
					// no content found => center
					return resolve({ left: 50, top: 50 });
				}
				const centerX = (minX + maxX) / 2 / cw * 100;
				const centerY = (minY + maxY) / 2 / ch * 100;
				resolve({ left: Math.round(centerX * 100) / 100, top: Math.round(centerY * 100) / 100 });
			};
			img.onerror = () => resolve({ left: 50, top: 50 });
			img.src = imageUrl;
		});
	}

	import { browser } from '$app/environment';
	// track background image load errors keyed by URL (or frame id)
	let bgErrors: Record<string, boolean> = {};
// dev toggle to inspect how background-size affects framing
let bgSizeOverride: 'cover' | 'contain' = 'cover';

	function clampPercent(v: number | undefined, fallback = 50) {
		if (typeof v !== 'number' || Number.isNaN(v)) return fallback;
		let val = v;
		// Heuristic normalization: if someone supplied px / large numbers (e.g., 7500 or 750),
		// divide repeatedly by 10 until it fits within 0..100 range as a helpful default.
		if (Math.abs(val) > 100) {
			if (browser) console.warn(`imagePosition value ${v} is >100; attempting heuristic normalization (divide by 10 until <= 100)`);
			while (Math.abs(val) > 100) val = val / 10;
			if (browser) console.warn(` -> normalized to ${val}`);
		}

		// handleAutoCenter is implemented below as a top-level function to avoid being
		// nested inside clampPercent() which breaks Svelte bindings and template references.
		// Finally clamp to 0..100
		if (val < 0) {
			if (browser) console.warn(`imagePosition value ${v} < 0; clamped to 0 (0..100 expected)`);
			return 0;
		}
		if (val > 100) {
			if (browser) console.warn(`imagePosition value ${v} > 100; clamped to 100 (0..100 expected)`);
			return 100;
		}
		return Number(val);
	}

async function handleAutoCenter() {
	if (!displayFrame || !displayImageUrl || !page) return;
	const center = await detectImageContentCenter(displayImageUrl);
	const pageIndex: number = Number(get(currentPageIndex));
	const frameIndex: number = page.frames ? page.frames.findIndex((f) => f.id === displayFrame.id) : 0;
	if (frameIndex < 0) return;
	if (browser) console.log(`auto-center: page=${pageIndex} frame=${frameIndex} -> ${center.left},${center.top}`);
	updateFrameImagePosition(pageIndex, frameIndex, { left: center.left, top: center.top });
}

	function elementStyle(el: any) {
		const leftVal = clampPercent(el.left, 50);
		const topVal = clampPercent(el.top, 50);
		const left = `${leftVal}%`;
		const top = `${topVal}%`;
		const width = typeof el.width === 'number' ? `${el.width}%` : 'auto';
		const height = typeof el.height === 'number' ? `${el.height}%` : 'auto';
		const anchor = el?.anchor ?? 'topleft';
		const transform = anchor === 'center' ? 'translate(-50%, -50%)' : '';
		
		// Animação com parâmetros customizáveis
		let animClass = '';
		let animVars = '';
		if (el.animation) {
			const anim = typeof el.animation === 'string' 
				? { type: el.animation, intensity: 0.5, duration: 4 } 
				: el.animation;
			animClass = `anim-${anim.type}`;
			const intensity = anim.intensity ?? 0.5;
			const duration = anim.duration ?? 4;
			animVars = `--anim-intensity: ${intensity}; --anim-duration: ${duration}s;`;
		}
		
		return { 
			style: `position:absolute; left:${left}; top:${top}; width:${width}; height:${height}; transform: ${transform}; pointer-events:none; ${animVars}`,
			animClass 
		};
	}

	// Compute display image and elements whenever the page or current frame changes
	$: {
		if (!page) {
			displayImageUrl = null;
			frameElements = null;
			displayFrame = null;
		} else if (position === 'center' && page.frames && page.frames.length) {
			const idx = $currentFrameIndex;
			const frame = page.frames[idx] ?? page.frames[0];
			displayFrame = frame;
			displayImageUrl = frame?.imageUrl ?? page.imageUrl ?? null;
			frameElements = frame?.elements ?? null;
			console.log('[MangaPage CENTER] frameIdx:', idx, 'frame:', frame?.id, 'imageUrl:', displayImageUrl);
		} else {
			const frame0 = page.frames && page.frames.length ? page.frames[0] : null;
			displayFrame = frame0 ?? null;
			displayImageUrl = frame0?.imageUrl ?? page.imageUrl ?? null;
			frameElements = frame0?.elements ?? null;
		}
	}

	// Calcular pinnedFramesObjects separadamente para reagir a mudanças em pinnedFrameIndexes
	$: pinnedFramesObjects = (pinnedFrameIndexes && pinnedFrameIndexes.length && page?.frames) 
		? pinnedFrameIndexes.map(i => page?.frames?.[i]).filter(Boolean) 
		: [];

	// Debug temporário
	$: if (position === 'center') {
		console.log('[MangaPage CENTER] pinnedFrameIndexes:', pinnedFrameIndexes, 'pinnedFramesObjects:', pinnedFramesObjects?.map(f => f?.id));
	}

	// Re-register always when imgEl or page change.
	$: {
		register(page && wrapperEl ? wrapperEl : null);
	}

	onDestroy(() => {
		register(null);
	});
</script>

<div class="manga-page {position}" class:has-content={!!page}>
	<div class="page-wrapper">
		<div class="page-container {appliedPositionClass}">
			{#if page}
				<div class="page-image">
					{#if displayImageUrl}
						{#key page.id}
							{#if position === 'center'}
								<div class="img-wrapper {isAnimating ? 'hidden-during-overlay' : ''}" bind:this={wrapperEl}
									in:fly|local={{ x: flyDirection, duration: 800, easing: cubicOut, opacity: 1 }}
									out:fly|local={{ x: flyOutDirection, duration: 600, easing: cubicOut, opacity: 1 }}>
									
									<!-- CAMADA 1: Pinned frames (frames anteriores que ficam "por baixo") -->
									{#if pinnedFramesObjects && pinnedFramesObjects.length}
										{#each pinnedFramesObjects as pframe, pi (pframe.id)}
											{#if pframe}
												{#if pframe?.imagePosition?.size}
													<!-- Pinned frame com posição left/top -->
													<div 
														class="frame-position-container" 
														style={`position:absolute; inset:0; z-index:${200 + pi}; pointer-events:none;`}
													>
														<div 
															class="frame-box pinned"
															style={`
																position: absolute;
																left: ${clampPercent(pframe?.imagePosition?.left ?? 50)}%;
																top: ${clampPercent(pframe?.imagePosition?.top ?? 50)}%;
																transform: translate(-50%, -50%);
																width: ${pframe.imagePosition.size}%;
																aspect-ratio: 2 / 3;
																overflow: hidden;
															`}
														>
															<img 
																src={pframe.imageUrl} 
																alt={`Página ${page.id} frame ${pframe.id}`}
																style="width:100%; height:100%; object-fit:contain;"
															/>
															{#if pframe.elements}
																{#each pframe.elements as el (el.id)}
																	{@const elStyle = elementStyle(el)}
																	<img src={el.imageUrl} class="frame-element {elStyle.animClass}" style={elStyle.style} alt="elemento" />
																{/each}
															{/if}
														</div>
													</div>
												{:else}
													<!-- Pinned frame sem size: ocupa toda a box -->
													<img 
														src={pframe.imageUrl} 
														alt="Página {page.id} frame pinned" 
														class="manga-img" 
														style={`position:absolute; inset:0; width:100%; height:100%; object-fit:contain; z-index:${200 + pi};`} 
													/>
												{/if}
											{/if}
										{/each}
									{/if}

									<!-- CAMADA 2: Frame atual (displayFrame) - sempre por cima dos pinned -->
									{#if displayImageUrl}
										{#if displayFrame?.imagePosition?.size}
											<!-- Frame atual com size: posiciona usando left/top -->
											<div class="frame-position-container" style={`position:absolute; inset:0; z-index:${300 + (pinnedFramesObjects?.length ?? 0)};`}>
												<div 
													class="frame-box current"
													bind:this={imgEl}
													style={`
														position: absolute;
														left: ${clampPercent(displayFrame?.imagePosition?.left ?? 50)}%;
														top: ${clampPercent(displayFrame?.imagePosition?.top ?? 50)}%;
														transform: translate(-50%, -50%);
														width: ${displayFrame.imagePosition.size}%;
														aspect-ratio: 2 / 3;
														overflow: hidden;
													`}
												>
													<img 
														src={displayImageUrl} 
														alt={`Página ${page.id}`}
														style="width:100%; height:100%; object-fit:contain;"
													/>
													{#if frameElements}
														{#each frameElements as el (el.id)}
															{@const elStyle = elementStyle(el)}
															<img src={el.imageUrl} class="frame-element {elStyle.animClass}" style={elStyle.style} alt="elemento" />
														{/each}
													{/if}
												</div>
											</div>
										{:else}
											<!-- Sem size: imagem ocupa toda a box -->
											<img 
												src={displayImageUrl} 
												alt="Página {page.id}" 
												class="manga-img" 
												bind:this={imgEl}
												style={`z-index:${300 + (pinnedFramesObjects?.length ?? 0)};`}
											/>
										{/if}
									{/if}
								</div>
							{:else}
								<!-- Páginas laterais (left/right): mostrar TODOS os frames empilhados SEM animações -->
								<div class="img-wrapper" bind:this={wrapperEl}>
									{#if page.frames && page.frames.length}
										<!-- Renderizar todos os frames da página empilhados -->
										{#each page.frames as frame, fi (frame.id)}
											{#if frame?.imagePosition?.size}
												<div 
													class="frame-position-container" 
													style={`position:absolute; inset:0; z-index:${200 + fi}; pointer-events:none;`}
												>
													<div 
														class="frame-box"
														style={`
															position: absolute;
															left: ${clampPercent(frame?.imagePosition?.left ?? 50)}%;
															top: ${clampPercent(frame?.imagePosition?.top ?? 50)}%;
															transform: translate(-50%, -50%);
															width: ${frame.imagePosition.size}%;
															aspect-ratio: 2 / 3;
															overflow: hidden;
														`}
													>
														<img 
															src={frame.imageUrl} 
															alt={`Página ${page.id} frame ${frame.id}`}
															style="width:100%; height:100%; object-fit:contain;"
														/>
														{#if frame.elements}
															{#each frame.elements as el (el.id)}
																{@const elStyle = elementStyle(el)}
																<!-- Sem animação nas páginas laterais -->
																<img src={el.imageUrl} class="frame-element" style={elStyle.style} alt="elemento" />
															{/each}
														{/if}
													</div>
												</div>
											{:else}
												<!-- Frame sem size: ocupa toda a box -->
												<img 
													src={frame.imageUrl} 
													alt="Página {page.id} frame {frame.id}" 
													class="manga-img" 
													style={`position:absolute; inset:0; width:100%; height:100%; object-fit:contain; z-index:${200 + fi};`} 
												/>
											{/if}
										{/each}
									{:else if displayImageUrl}
										<!-- Página sem frames: mostrar imagem única -->
										<img src={displayImageUrl} alt="Página {page.id}" class="manga-img" bind:this={imgEl} />
									{/if}
								</div>
							{/if}
						{/key}
					{:else}
						<div class="placeholder">
							<span class="page-number">#{page.id}</span>
						</div>
					{/if}
				</div>
			{:else}
				<div class="empty-page">
					<span class="label">{label}</span>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.manga-page {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.page-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}

	/* Proporção de página de mangá (aproximadamente 2:3 como folha A4) */
	.page-container {
		position: relative;
		height: 95vh;
		aspect-ratio: 2 / 3;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Não animar transform/scale — evita efeito de encolher/crescer durante transições */
		transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1);
		perspective: 1000px;
		overflow: hidden;
	}
	
	/* Página central: altura completa com borda preta grossa */
	.center .page-container {
		height: 95vh;
		z-index: 100;
		opacity: 1;
		transform: none;
		overflow: visible;
	}

	.page-wrapper {
		overflow: visible;
	}

	.manga-page {
		overflow: visible;
	}

	/* Páginas laterais: mesma altura mas com menos opacidade */
	.left .page-container,
	.right .page-container {
		height: 95vh;
		opacity: 1;
		transform: none;
	}

	/* Aplicar opacidade só quando não está em transição */
	.left .page-container .img-wrapper,
	.right .page-container .img-wrapper {
		opacity: 0.07;
		transition: opacity 0.3s ease;
	}

	/* Página da direita (próxima): efeito de censura pixelizada */
	.right .page-container {
		filter: none;
		opacity: 1;
	}

	/* Efeito de pixelização tipo mosaico de censura */
	.right .manga-img {
		filter: blur(1px);
		image-rendering: pixelated;
		image-rendering: -moz-crisp-edges;
		image-rendering: crisp-edges;
	}

	/* Criar o efeito de pixelização reduzindo muito e ampliando */
	.right .page-image {
		position: relative;
		overflow: hidden;
	}

	.right .page-image::before {
		content: '';
		position: absolute;
		inset: 0;
		background: 
			repeating-conic-gradient(
				from 0deg at 10px 10px,
				rgba(0, 0, 0, 0.03) 0deg 90deg,
				rgba(255, 255, 255, 0.03) 90deg 180deg,
				rgba(0, 0, 0, 0.03) 180deg 270deg,
				rgba(255, 255, 255, 0.03) 270deg 360deg
			);
		background-size: 20px 20px;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		pointer-events: none;
		z-index: 1;
	}

	.page-image,
	.empty-page {
		width: 100%;
		height: 100%;
		background: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: visible;
		position: relative;
		/* Borda cinza por padrão */
		border: 1px solid #999999;
		box-shadow: none;
	}

	.empty-page {
		overflow: hidden;
	}

	/* Página central: borda preta fina */
	.center .page-image,
	.center .empty-page {
		border: 2px solid #000000;
	}

	/* Páginas laterais: borda cinza visível */
	.left .page-image,
	.right .page-image,
	.left .empty-page,
	.right .empty-page {
		border: 1px solid #999999;
	}

	.img-wrapper {
		width: 100%;
		height: 100%;
		position: relative;
		z-index: 200;
		will-change: transform;
		backface-visibility: hidden;
	}

	/* Classes locais de posição para controlar escala sem depender do Tailwind */
	.pos-left { opacity: 0.5; transform: scale(0.9); }
	.pos-center { opacity: 1; transform: scale(1); z-index: 10; }
	.pos-right { opacity: 0.5; transform: scale(0.9); }

	/* Versões sem scale para usar durante animação */
	.pos-left-noscale { opacity: 0.5; transform: none; }
	.pos-center-noscale { opacity: 1; transform: none; z-index: 10; }
	.pos-right-noscale { opacity: 0.5; transform: none; }

	.hidden-during-overlay {
		visibility: hidden;
		opacity: 0;
		pointer-events: none;
	}

	.manga-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center;
		transition: opacity 0.4s ease-out;
	}
	.frame-bg {
		background-repeat: no-repeat;
		background-position: center center;
		background-size: cover;
		width: 100%;
		height: 100%;
	}

	/* Frame box positioning */
	.frame-position-container {
		pointer-events: none;
	}
	.frame-box {
		pointer-events: auto;
	}

	.frame-element {
		position: absolute;
		z-index: 210;
		object-fit: contain;
		pointer-events: none;
	}

	.debug-pin-count {
		position: absolute;
		top: 10px;
		right: 10px;
		background: rgba(0,0,0,0.6);
		color: #fff;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 0.75rem;
		z-index: 9999;
	}

	.page-number {
		font-size: 2.5rem;
		font-weight: 200;
		color: rgba(0, 0, 0, 0.08);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		letter-spacing: 2px;
	}

	.empty-page {
		background: #fcfcfc;
		border: 1px solid #e8e8e8;
		border-style: solid;
	}

	.label {
		font-size: 0.75rem;
		font-weight: 400;
		color: rgba(0, 0, 0, 0.18);
		text-transform: lowercase;
		letter-spacing: 2px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	/* Efeitos de posição */
	.left {
		transform-origin: right center;
	}

	.center {
		transform-origin: center center;
	}

	.right {
		transform-origin: left center;
	}

	/* Responsividade Mobile */
	@media (max-width: 768px) {
		.page-container {
			height: 90vh;
		}

		.center .page-container {
			height: 90vh;
		}

		.left .page-container,
		.right .page-container {
			height: 90vh;
			transform: scale(0.88);
			opacity: 0.05;
		}

		.label {
			font-size: 0.7rem;
		}

		.page-number {
			font-size: 2rem;
		}
	}

	/* Mobile muito pequeno - esconde páginas laterais */
	@media (max-width: 480px) {
		.left,
		.right {
			display: none;
		}

		.center .page-container {
			height: 95vh;
		}
	}

	/* Animações para elementos - usa CSS variables para controle de intensidade */
	@keyframes float {
		0%, 100% {
			transform: translateY(0) rotate(0deg);
		}
		25% {
			transform: translateY(calc(-6px * var(--anim-intensity, 0.5))) rotate(calc(1deg * var(--anim-intensity, 0.5)));
		}
		50% {
			transform: translateY(calc(-2px * var(--anim-intensity, 0.5))) rotate(calc(-0.6deg * var(--anim-intensity, 0.5)));
		}
		75% {
			transform: translateY(calc(-8px * var(--anim-intensity, 0.5))) rotate(calc(0.6deg * var(--anim-intensity, 0.5)));
		}
	}

	@keyframes float-alt {
		0%, 100% {
			transform: translateY(0) rotate(0deg);
		}
		25% {
			transform: translateY(calc(-4px * var(--anim-intensity, 0.5))) rotate(calc(-0.8deg * var(--anim-intensity, 0.5)));
		}
		50% {
			transform: translateY(calc(-10px * var(--anim-intensity, 0.5))) rotate(calc(1deg * var(--anim-intensity, 0.5)));
		}
		75% {
			transform: translateY(calc(-4px * var(--anim-intensity, 0.5))) rotate(calc(-0.4deg * var(--anim-intensity, 0.5)));
		}
	}

	:global(.anim-float) {
		--anim-intensity: 0.5;
		--anim-duration: 4s;
		animation: float var(--anim-duration) ease-in-out infinite;
	}

	:global(.anim-float:nth-child(2n)) {
		animation-name: float-alt;
		animation-duration: calc(var(--anim-duration) * 1.25);
		animation-delay: 0.5s;
	}

	:global(.anim-float:nth-child(3n)) {
		animation-duration: calc(var(--anim-duration) * 1.5);
		animation-delay: 1s;
	}
</style>
