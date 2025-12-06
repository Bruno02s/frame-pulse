// Types para o leitor de mangá
export interface Page {
	id: number;
	imageUrl?: string; // fallback single image per page
	frames?: Frame[]; // sequences of frames (quadros) within the page
	effects?: PageEffect[];
	sounds?: PageSound[];
}

export interface Frame {
	id: string; // e.g. qd_1
	imageUrl: string; // frame base image
	elements?: FrameElement[]; // possible overlaid elements per frame
	/**
	 * Sons que tocam ao entrar neste frame.
	 * Sons de frames se sobrepõem aos sons da página (não os substituem).
	 */
	sounds?: FrameSound[];
	/**
	 * Posicionamento do frame dentro da box de leitura:
	 * - `left`: posição horizontal do centro do frame (0% = esquerda, 100% = direita)
	 * - `top`: posição vertical do centro do frame (0% = topo, 100% = fundo)
	 * - `size`: largura do frame como % da largura da box de leitura
	 * 
	 * Exemplo: { left: 25, top: 30, size: 40 } posiciona um frame de 40% de largura
	 * no canto superior esquerdo (centrado em 25%, 30%).
	 * 
	 * Sem `size`, o frame ocupa toda a box de leitura.
	 */
	imagePosition?: { left?: number; top?: number; size?: number };
}

export interface FrameElement {
	id: string; // e.g. el_1
	imageUrl: string;
	// optional position and size metadata - top/left in percentages (0-100)
	top?: number;
	left?: number;
	width?: number;
	height?: number;
	// anchor controls whether left/top refer to the element's center or top-left
	// - 'center' (default): left/top are the coordinate for element center
	// - 'topleft': left/top refer to element top-left corner
	anchor?: 'center' | 'topleft';
	// optional animation
	animation?: {
		type: 'fade' | 'slide' | 'scale' | 'float' | 'shake';
		intensity?: number; // 0-1, default 0.5
		duration?: number;  // seconds, default 4
	};
}

export interface PageEffect {
	type: 'shake' | 'rotate' | 'zoom' | 'fade';
	duration: number;
	intensity: number;
}

export interface PageSound {
	url: string;
	volume: number;
	loop: boolean;
}

export interface FrameSound {
	url: string;
	volume?: number; // default 1.0
	loop?: boolean;  // default false
}

export interface MangaChapter {
	id: string;
	title: string;
	pages: Page[];
}
