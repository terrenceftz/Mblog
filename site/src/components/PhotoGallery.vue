<script setup lang="ts">
// 相册瀑布流（reactbits Masonry 轻量移植）：
// CSS columns 瀑布流 + GSAP stagger 入场 + hover 缩放 + 点击 lightbox。
// prefers-reduced-motion 时跳过入场动画（图片直接可见）。
import { ref, onMounted, onBeforeUnmount } from 'vue';
import gsap from 'gsap/dist/gsap.js';

interface Photo {
  id: number; url: string; title: string; description: string; album: string;
  /** SSR 预生成的响应式图片（webp 多尺寸 srcset）；空则回退原图 */
  img?: { src: string; srcset: string; sizes: string };
}

const props = defineProps<{ photos: Photo[] }>();
const gridEl = ref<HTMLElement | null>(null);
const lightbox = ref<Photo | null>(null);

function openLightbox(p: Photo) { lightbox.value = p; }
function closeLightbox() { lightbox.value = null; }
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && lightbox.value) closeLightbox();
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  const els = gridEl.value?.querySelectorAll<HTMLElement>('.gallery-item');
  if (!els?.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.fromTo(
    els,
    { opacity: 0, y: 28 },
    { opacity: 1, y: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out', delay: 0.05 },
  );
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div ref="gridEl" class="gallery-grid">
    <button v-for="p in photos" :key="p.id" type="button" class="gallery-item" @click="openLightbox(p)">
      <img :src="p.img?.src || p.url" :srcset="p.img?.srcset || undefined" :sizes="p.img?.sizes || undefined" :alt="p.title || '相册图片'" loading="lazy" decoding="async" />
      <span v-if="p.title" class="gallery-item-title">{{ p.title }}</span>
    </button>
  </div>

  <Transition name="lb-fade">
    <div v-if="lightbox" class="gallery-lightbox" role="dialog" aria-modal="true" aria-label="图片查看" @click="closeLightbox">
      <div class="gallery-lightbox-inner" @click.stop>
        <img :src="lightbox.url" :alt="lightbox.title || ''" />
        <div v-if="lightbox.title || lightbox.description" class="gallery-lightbox-meta">
          <h3 v-if="lightbox.title" class="gallery-lightbox-title">{{ lightbox.title }}</h3>
          <p v-if="lightbox.description" class="gallery-lightbox-desc">{{ lightbox.description }}</p>
        </div>
        <button type="button" class="gallery-lightbox-close" aria-label="关闭" @click="closeLightbox">✕</button>
      </div>
    </div>
  </Transition>
</template>
