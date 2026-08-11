<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

// 风趣自我介绍（打字机循环切换，可自行增改）
const phrases = [
  '一个喜欢折腾代码和生活的博主',
  '把想法写成文章，把折腾变成项目',
  '记录思考、旅行与创作',
  '偶尔文艺，偶尔极客',
];
const text = ref('');

let timer: ReturnType<typeof setTimeout> | null = null;
let phraseIdx = 0;
let charIdx = 0;
let deleting = false;

function tick() {
  const current = phrases[phraseIdx];
  if (!deleting) {
    charIdx++;
    text.value = current.slice(0, charIdx);
    if (charIdx === current.length) {
      deleting = true;
      timer = setTimeout(tick, 1800); // 完整展示后停留
      return;
    }
    timer = setTimeout(tick, 85);
    return;
  }
  charIdx--;
  text.value = current.slice(0, charIdx);
  if (charIdx === 0) {
    deleting = false;
    phraseIdx = (phraseIdx + 1) % phrases.length;
    timer = setTimeout(tick, 350);
    return;
  }
  timer = setTimeout(tick, 35);
}

onMounted(() => {
  tick();
});
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <p class="nh-witty" aria-live="polite">{{ text }}<span class="nh-cursor" aria-hidden="true">|</span></p>
</template>
