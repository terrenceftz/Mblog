<script setup lang="ts">
// 电台播放器：网易云歌单（播放源由后端 weapi 代理获取，cookie 只在后端）
// 功能：播放/暂停、上一首/下一首、进度条、音量；播放中行高亮琥珀。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

interface Track {
  id: number;
  name: string;
  artists: string;
  album: string;
  cover: string;
  duration: number;
}
interface PlaylistData {
  name: string;
  cover: string;
  tracks: Track[];
}

const props = defineProps<{
  playlistId?: string;
  /** 媒体/API 公共根（本地直跑设 http://localhost:3000；生产空 = 同域 /api） */
  apiBase?: string;
}>();

const api = (path: string) => `${props.apiBase || ''}/api/netease${path}`;

const playlist = ref<PlaylistData | null>(null);
const loading = ref(true);
const error = ref('');
const tracks = computed(() => playlist.value?.tracks ?? []);
const current = ref(0);
const playing = ref(false);
const audioRef = ref<HTMLAudioElement | null>(null);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(0.8);
const playErr = ref('');

const fmt = (ms: number) => {
  if (!ms || ms <= 0) return '--:--';
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

async function loadPlaylist() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(api(`/playlist?id=${encodeURIComponent(props.playlistId || '')}`));
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.message || '加载歌单失败');
    }
    const body = await res.json();
    playlist.value = body.data;
  } catch (e: any) {
    error.value = e.message || '加载失败';
    playlist.value = null;
  } finally {
    loading.value = false;
  }
}

async function playTrack(index: number) {
  if (index < 0 || index >= tracks.value.length) return;
  current.value = index;
  playErr.value = '';
  const track = tracks.value[index];
  // 每次播放实时拉取播放源（URL 有时效）
  try {
    const res = await fetch(api(`/song/url?id=${track.id}`));
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.message || '获取播放源失败');
    }
    const body = await res.json();
    const url: string = body.data?.url;
    if (!url) throw new Error('无播放源');
    const audio = audioRef.value!;
    audio.src = url;
    audio.volume = volume.value;
    await audio.play();
    playing.value = true;
  } catch (e: any) {
    playErr.value = e.message || '播放失败';
    playing.value = false;
  }
}

function togglePlay() {
  const audio = audioRef.value!;
  if (playing.value) {
    audio.pause();
    playing.value = false;
  } else if (audio.src) {
    audio.play();
    playing.value = true;
  } else if (tracks.value.length) {
    playTrack(current.value);
  }
}
const prev = () => playTrack((current.value - 1 + tracks.value.length) % tracks.value.length);
const next = () => playTrack((current.value + 1) % tracks.value.length);
const seek = (e: Event) => {
  const audio = audioRef.value!;
  const t = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(t)) audio.currentTime = t;
};
const setVolume = (e: Event) => {
  const v = Number((e.target as HTMLInputElement).value);
  volume.value = v;
  if (audioRef.value) audioRef.value.volume = v;
};

function onTime() {
  currentTime.value = audioRef.value!.currentTime;
  duration.value = audioRef.value!.duration || 0;
}
function onEnded() {
  // 自动下一首；无下一首时停在末尾
  if (current.value < tracks.value.length - 1) playTrack(current.value + 1);
  else playing.value = false;
}
function onError() {
  playErr.value = '播放失败（可能无版权或链接过期），点击下一首继续';
  playing.value = false;
}

onMounted(() => {
  loadPlaylist();
});
onBeforeUnmount(() => {
  if (audioRef.value) audioRef.value.pause();
});
</script>

<template>
  <div class="radio-wrap">
    <!-- 未配置歌单 -->
    <p v-if="error && !playlist" class="post-empty radio-error">{{ error }}<template v-if="error.includes('未配置')">，请到后台「站点设置 → 电台」配置网易云 Cookie</template></p>

    <!-- 播放器主体 -->
    <template v-else>
      <div class="radio-player">
        <div class="radio-cover">
          <img v-if="playlist?.cover" :src="playlist.cover" alt="" />
          <span v-else class="radio-cover-fallback">♪</span>
          <span class="radio-eq" aria-hidden="true" :class="{ on: playing }">
            <span /><span /><span />
          </span>
        </div>
        <div class="radio-body">
          <p class="radio-kicker">NOW PLAYING</p>
          <h2 class="radio-title">{{ playlist ? tracks[current]?.name || '—' : '…' }}</h2>
          <p class="radio-artist">{{ tracks[current]?.artists || '' }}</p>
          <div class="radio-controls">
            <button type="button" class="radio-btn" aria-label="上一首" @click="prev">⏮</button>
            <button type="button" class="radio-btn radio-btn-main" :aria-label="playing ? '暂停' : '播放'" @click="togglePlay">
              {{ playing ? '⏸' : '▶' }}
            </button>
            <button type="button" class="radio-btn" aria-label="下一首" @click="next">⏭</button>
          </div>
          <div class="radio-progress">
            <span class="radio-time">{{ fmt(currentTime * 1000) }}</span>
            <input
              type="range" class="radio-range" min="0" :max="duration || 0" step="0.5"
              :value="currentTime" @input="seek"
            />
            <span class="radio-time">{{ fmt(tracks[current]?.duration || duration * 1000) }}</span>
          </div>
          <div class="radio-vol">
            <span class="radio-vol-icon" aria-hidden="true">🔊</span>
            <input type="range" class="radio-range radio-vol-range" min="0" max="1" step="0.01" :value="volume" @input="setVolume" />
          </div>
          <p v-if="playErr" class="radio-play-err">{{ playErr }}</p>
        </div>
      </div>

      <audio ref="audioRef" @timeupdate="onTime" @ended="onEnded" @error="onError" />

      <!-- 歌单列表 -->
      <div v-if="tracks.length" class="radio-list">
        <p class="radio-list-title">{{ playlist?.name }}</p>
        <ol class="radio-tracks">
          <li
            v-for="(t, i) in tracks" :key="t.id"
            class="radio-track" :class="{ active: i === current }"
            @click="playTrack(i)"
          >
            <span class="radio-track-idx">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="radio-track-main">
              <span class="radio-track-name">{{ t.name }}</span>
              <span class="radio-track-meta">{{ t.artists }}<template v-if="t.album"> · {{ t.album }}</template></span>
            </span>
            <span class="radio-track-dur">{{ fmt(t.duration) }}</span>
          </li>
        </ol>
      </div>
    </template>
  </div>
</template>
