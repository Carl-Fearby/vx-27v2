const START_MUSIC_SRC = "/music/galactic-drifter.mp3";
const LEVEL_MUSIC_SRC = "/music/galactic-drifter-2.mp3";
const MUSIC_VOLUME = 0.65;

let musicAudio: HTMLAudioElement | null = null;
let currentSrc = "";

function getMusicAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!musicAudio) {
    musicAudio = new Audio();
    musicAudio.loop = true;
    musicAudio.preload = "auto";
    musicAudio.volume = MUSIC_VOLUME;
  }

  return musicAudio;
}

function playMusic(src: string): void {
  const audio = getMusicAudio();
  if (!audio) {
    return;
  }

  if (currentSrc !== src) {
    currentSrc = src;
    audio.src = src;
    audio.load();
  }

  audio.volume = MUSIC_VOLUME;
  const playPromise = audio.play();
  if (playPromise) {
    playPromise.catch(() => {
      // Browsers can reject autoplay until a user gesture; the next toggle/start click retries.
    });
  }
}

export function playStartMusic(): void {
  playMusic(START_MUSIC_SRC);
}

export function playLevelMusic(): void {
  playMusic(LEVEL_MUSIC_SRC);
}

export function stopMusic(): void {
  if (!musicAudio) {
    return;
  }

  musicAudio.pause();
}

export function setMusicEnabled(enabled: boolean, mode: "start" | "level"): void {
  if (!enabled) {
    stopMusic();
    return;
  }

  if (mode === "level") {
    playLevelMusic();
    return;
  }

  playStartMusic();
}
