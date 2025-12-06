<script lang="ts">
import { onMount } from 'svelte';
import MangaReader from '$lib/components/MangaReader.svelte';
import { currentChapter } from '$lib/stores/reader';
import type { MangaChapter } from '$lib/types/manga';

const mockChapter: MangaChapter = {
id: 'chapter-1',
title: 'Mil Tsurus - Capítulo 1',
pages: [
{ id: 0, imageUrl: '/images/manga/mil-tsurus-capa.png' },
{ 
id: 1, 
  sounds: [
  { url: '/sounds/peace.ogg', volume: 0.5, loop: true }
  ],
  frames: [
    { id: 'tl_1', imageUrl: '/images/manga/pg1_tl1.png', imagePosition: { left: 50, top: 5, size: 43 } },
    { id: 'qd_1', imageUrl: '/images/manga/pg_1_qd_1.png', imagePosition: { left: 25, top: 27, size: 43 } },
    { id: 'qd_2', imageUrl: '/images/manga/pg_1_qd_2.png', imagePosition: { left: 72, top: 28.70, size: 50 } },
    { id: 'qd_3', imageUrl: '/images/manga/pg_1_qd_3.png', imagePosition: { left: 25, top: 60, size: 44 }, sounds: [{ url: '/sounds/childs.wav', volume: 0.7 }] },
    { id: 'qd_4', imageUrl: '/images/manga/pg_1_qd_4.png', imagePosition: { left: 74, top: 62.50, size: 51 } },
    { id: 'qd_5', imageUrl: '/images/manga/pg_1_qd_5.png', imagePosition: { left: 50, top: 85, size: 94.70 }, elements: [
      { id: 'el_1', imageUrl: '/images/manga/pg_1_qd_5_el1.png', left: 12, top: 38.50, width: 14, height: 18, animation: { type: 'float', intensity: 4.0, duration: 5 } },
      { id: 'el_2', imageUrl: '/images/manga/pg_1_qd_5_el2.png', left: 30, top: 52, width: 12, height: 12, animation: { type: 'float', intensity: 2.7, duration: 6 } }
  ] }
] 
},
{ 
id: 2, 
sounds: [
{ url: '/sounds/destroyed.wav', volume: 0.5, loop: true }
],
frames: [
{ id: 'tl_1', imageUrl: '/images/manga/pg_2_tl_1.png', imagePosition: { left: 50, top: 5, size: 43 } },
{ id: 'qd_1', imageUrl: '/images/manga/pg_2_qd_1.png', imagePosition: { left: 25, top: 27.9, size: 43 }},
{ id: 'qd_2', imageUrl: '/images/manga/pg_2_qd_2.png', imagePosition: { left: 72, top: 28, size: 50.50 }, sounds: [{ url: '/sounds/atomic-bomb.wav', volume: 0.7 }], elements: [
  { id: 'el_1', imageUrl: '/images/manga/pg_2_qd_2_el1.png', left: 18, top: 5, width: 67, height: 67, animation: { type: 'shake', intensity: 0.4, duration:3.0 } }
]},
{ id: 'qd_3', imageUrl: '/images/manga/pg_2_qd_3.png', imagePosition: { left: 35.70, top: 57.10, size: 65.3 } },
{ id: 'qd_4', imageUrl: '/images/manga/pg_2_qd_4.png', imagePosition: { left: 83, top: 57.10, size: 28 } },
{ id: 'qd_5', imageUrl: '/images/manga/pg_2_qd_5.png', imagePosition: { left: 35.40, top: 83, size: 65 } },
{ id: 'qd_6', imageUrl: '/images/manga/pg_2_qd_6.png', imagePosition: { left: 81, top: 83, size: 30 } }
] 
}
]
};
// { id: 2, 
//   sounds: [
//     { url: '/sounds/destroyed.wav', volume: 0.4, loop: true }
//   ],
//   imageUrl: '/images/manga/mil-tsurus-pagina2.png' }
// ]
// };

onMount(() => {
currentChapter.set(mockChapter);
});
</script>

<svelte:head>
<title>Frame Pulse - Leitor Imersivo de Mangá</title>
<meta name="description" content="Experiência imersiva de leitura de mangá" />
</svelte:head>

<MangaReader />

<style>
:global(body) {
margin: 0;
padding: 0;
overflow: hidden;
}
</style>
