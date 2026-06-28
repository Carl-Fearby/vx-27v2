import { Vector3 } from "@babylonjs/core";

type SoundSource = string | string[];
type SoundKey =
  | "laser_shot"
  | "grenade_whoosh"
  | "grenade_floor_hit"
  | "grenade_explosion"
  | "grenade_countdown"
  | "pickup_cock"
  | "pickup_hp"
  | "oil_barrel_fire"
  | "hole_fall_death"
  | "hack_death"
  | "hack_connect"
  | "shop_denied"
  | "shop_purchase"
  | "rain_thunderstorm_ambient";

type VectorLike = { x: number; y: number; z: number };

type PlayOptions = {
  volume?: number;
  playbackRate?: number;
};

type WorldOptions = PlayOptions & {
  refDistance?: number;
  maxDistance?: number;
  minGain?: number;
};

export type GameSoundManager = {
  preload: () => Promise<void>;
  play: (key: SoundKey, options?: PlayOptions) => void;
  playWorld: (key: SoundKey, position: VectorLike, options?: WorldOptions) => void;
  playShot: (options?: PlayOptions) => void;
  playFootstep: (options?: PlayOptions) => void;
  playGrenadeWhoosh: (options?: PlayOptions) => void;
  playGrenadeFloorHit: (position: VectorLike, options?: WorldOptions & { impact?: number }) => void;
  playGrenadeExplosion: (position: VectorLike, options?: WorldOptions) => void;
  playGrenadeCountdown: (position: VectorLike, options?: WorldOptions) => void;
  playHoleFallDeath: (options?: PlayOptions) => void;
  playHoleFallDeathWorld: (position: VectorLike, options?: WorldOptions) => void;
  playPlayerDeath: (options?: PlayOptions) => void;
  playEnemyDeath: (position: VectorLike, options?: WorldOptions & { headshot?: boolean; blast?: boolean }) => void;
  playEnemyHit: (position: VectorLike, options?: WorldOptions & { headshot?: boolean }) => void;
  playPlayerHurt: (options?: PlayOptions) => void;
  playBodyFloorHit: (position: VectorLike, options?: WorldOptions & { impact?: number }) => void;
  playSupplyPickup: (options?: PlayOptions) => void;
  playHpPickup: (options?: PlayOptions) => void;
  playHackDeath: (options?: PlayOptions) => void;
  playHackConnect: (options?: PlayOptions) => void;
  playShopDenied: (options?: PlayOptions) => void;
  playShopPurchase: (options?: PlayOptions) => void;
  updateRainAmbient: (rainFade: number, nowMs?: number) => void;
  stopRainAmbient: () => void;
  updateOilBarrelFire: (firePositions: VectorLike[] | null | undefined, enabled?: boolean) => void;
  stopOilBarrelFire: () => void;
  dispose: () => void;
};

const CLIP_SOURCES: Record<SoundKey, SoundSource> = {
  laser_shot: ["/sounds/laser_shot.aac", "/sounds/laser_shot.ogg"],
  grenade_whoosh: "/sounds/grenade_whoosh.aac",
  grenade_floor_hit: "/sounds/grenade_floor_hit.aac",
  grenade_explosion: "/sounds/grenade_explosion.aac",
  grenade_countdown: "/sounds/grenade_countdown.aac",
  pickup_cock: ["/sounds/pickup_cock.aac", "/sounds/pickup_cock.ogg"],
  pickup_hp: ["/sounds/pickup_hp.aac", "/sounds/pickup_hp.ogg"],
  oil_barrel_fire: "/sounds/oil_barrel_fire.aac",
  hole_fall_death: "/sounds/hole_fall_death.aac",
  hack_death: "/sounds/hack_death.aac",
  hack_connect: "/sounds/hack_connect.aac",
  shop_denied: "/sounds/shop_denied.aac",
  shop_purchase: "/sounds/shop_purchase.aac",
  rain_thunderstorm_ambient: "/sounds/rain_thunderstorm_ambient.aac",
};

const DEATH_VOCAL_URLS = [
  "/sounds/player_death.aac",
  "/sounds/player_death_02.aac",
  "/sounds/player_death_03.aac",
];
const ENEMY_HIT_URLS = [
  "/sounds/enemy_hit_01.aac",
  "/sounds/enemy_hit_02.aac",
  "/sounds/enemy_hit_03.aac",
  "/sounds/enemy_hit_04.aac",
];
const FOOTSTEP_COUNT = 39;
const FOOTSTEP_URLS = Array.from(
  { length: FOOTSTEP_COUNT },
  (_, i) => `/sounds/footsteps/footstep_gravel_${String(i + 1).padStart(2, "0")}.wav`,
);
const BODY_HIT_URLS = Array.from(
  { length: 4 },
  (_, i) => `/sounds/body_hits/body_hit_concrete_${String(i + 1).padStart(2, "0")}.wav`,
);

const ONE_SHOT_POOL_SIZE = 8;
const FOOTSTEP_POOL_SIZE = 8;
const RAIN_AMBIENT_MAX_VOLUME = 0.52;
const RAIN_AMBIENT_FADE_ATTACK = 2.8;
const RAIN_AMBIENT_FADE_RELEASE = 2.2;
const RAIN_AMBIENT_STOP_THRESHOLD = 0.004;
const OIL_BARREL_FIRE_FULL_DISTANCE = 3;
const OIL_BARREL_FIRE_MAX_DISTANCE = 7;
const OIL_BARREL_FIRE_BASE_VOLUME = 1.05;
const OIL_BARREL_FIRE_FADE_ATTACK = 8;
const OIL_BARREL_FIRE_FADE_RELEASE = 2.2;
const OIL_BARREL_FIRE_STOP_THRESHOLD = 0.004;

const scratchListener = new Vector3();

function asArray(source: SoundSource): string[] {
  return Array.isArray(source) ? source : [source];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function smoothGain(
  current: number,
  target: number,
  dt: number,
  attack: number,
  release: number,
): number {
  const rate = target > current ? attack : release;
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

function distanceVolumeScale(
  dist: number,
  { refDistance = 5, maxDistance = 42, minGain = 0.03 }: WorldOptions = {},
): number {
  if (dist >= maxDistance) return 0;
  if (dist <= refDistance) return 1;
  const t = (dist - refDistance) / (maxDistance - refDistance);
  return minGain + (1 - minGain) * (1 - t * t);
}

function oilBarrelFireDistanceGain(dist: number): number {
  if (dist >= OIL_BARREL_FIRE_MAX_DISTANCE) return 0;
  if (dist <= OIL_BARREL_FIRE_FULL_DISTANCE) return 1;
  const t =
    (dist - OIL_BARREL_FIRE_FULL_DISTANCE) /
    (OIL_BARREL_FIRE_MAX_DISTANCE - OIL_BARREL_FIRE_FULL_DISTANCE);
  return (1 - t) * (1 - t);
}

function createAudio(url: string, loop = false): HTMLAudioElement {
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.loop = loop;
  audio.load();
  return audio;
}

function setPlaybackRate(audio: HTMLAudioElement, rate = 1): void {
  audio.playbackRate = clamp(rate, 0.5, 2.5);
}

function playAudio(audio: HTMLAudioElement, volume: number, playbackRate = 1): void {
  audio.pause();
  audio.currentTime = 0;
  audio.volume = clamp(volume, 0, 1.5);
  setPlaybackRate(audio, playbackRate);
  const playPromise = audio.play();
  if (playPromise) {
    playPromise.catch(() => {
      // Browser audio can stay locked until a user gesture; later calls retry.
    });
  }
}

export function createGameSoundManager(
  getListenerPosition: () => VectorLike | null | undefined,
): GameSoundManager {
  const clipUrls = new Map<SoundKey, string>();
  const oneShotPools = new Map<string, HTMLAudioElement[]>();
  const footstepUrls = [...FOOTSTEP_URLS];
  const bodyHitUrls = [...BODY_HIT_URLS];
  const deathVocalUrls = [...DEATH_VOCAL_URLS];
  const enemyHitUrls = [...ENEMY_HIT_URLS];
  let preloadPromise: Promise<void> | null = null;
  let lastFootstepIndex = -1;
  let lastBodyHitIndex = -1;
  let lastPlayerDeathIndex = -1;
  let lastEnemyDeathIndex = -1;
  let lastEnemyHitIndex = -1;
  let rainAmbientAudio: HTMLAudioElement | null = null;
  let rainAmbientGainSmooth = 0;
  let rainAmbientLastUpdate = 0;
  let oilBarrelFireAudio: HTMLAudioElement | null = null;
  let oilBarrelFireGainSmooth = 0;
  let oilBarrelFireLastUpdate = 0;

  const resolveClipUrl = (key: SoundKey): string | null => {
    const cached = clipUrls.get(key);
    if (cached) return cached;
    const first = asArray(CLIP_SOURCES[key])[0] ?? null;
    if (first) clipUrls.set(key, first);
    return first;
  };

  const getPooledAudio = (poolKey: string, url: string, poolSize: number): HTMLAudioElement => {
    let pool = oneShotPools.get(poolKey);
    if (!pool) {
      pool = [];
      oneShotPools.set(poolKey, pool);
    }
    const idle = pool.find((audio) => audio.paused || audio.ended);
    if (idle) return idle;
    if (pool.length < poolSize) {
      const audio = createAudio(url);
      pool.push(audio);
      return audio;
    }
    return pool[0];
  };

  const pickVariant = (urls: string[], last: number, setLast: (index: number) => void): string | null => {
    if (urls.length === 0) return null;
    let next = Math.floor(Math.random() * urls.length);
    if (urls.length > 1) {
      let guard = 0;
      while (next === last && guard < 8) {
        next = Math.floor(Math.random() * urls.length);
        guard += 1;
      }
    }
    setLast(next);
    return urls[next];
  };

  const listenerDistanceTo = (position: VectorLike): number => {
    const listener = getListenerPosition();
    if (!listener) return 0;
    scratchListener.set(listener.x, listener.y, listener.z);
    return Vector3.Distance(scratchListener, new Vector3(position.x, position.y, position.z));
  };

  const play = (key: SoundKey, { volume = 1, playbackRate = 1 }: PlayOptions = {}) => {
    const url = resolveClipUrl(key);
    if (!url) return;
    const audio = getPooledAudio(key, url, key === "laser_shot" ? ONE_SHOT_POOL_SIZE : 4);
    playAudio(audio, volume, playbackRate);
  };

  const playWorld = (
    key: SoundKey,
    position: VectorLike,
    options: WorldOptions = {},
  ) => {
    const gain = distanceVolumeScale(listenerDistanceTo(position), options);
    if (gain < 0.02) return;
    play(key, {
      volume: (options.volume ?? 1) * gain,
      playbackRate: options.playbackRate,
    });
  };

  const playVariant = (
    poolKey: string,
    urls: string[],
    last: number,
    setLast: (index: number) => void,
    options: PlayOptions = {},
  ) => {
    const url = pickVariant(urls, last, setLast);
    if (!url) return;
    const audio = getPooledAudio(poolKey, url, poolKey === "footstep" ? FOOTSTEP_POOL_SIZE : 4);
    playAudio(audio, options.volume ?? 1, options.playbackRate ?? 1);
  };

  const playWorldVariant = (
    poolKey: string,
    urls: string[],
    last: number,
    setLast: (index: number) => void,
    position: VectorLike,
    options: WorldOptions = {},
  ) => {
    const gain = distanceVolumeScale(listenerDistanceTo(position), options);
    if (gain < 0.02) return;
    playVariant(poolKey, urls, last, setLast, {
      volume: (options.volume ?? 1) * gain,
      playbackRate: options.playbackRate,
    });
  };

  const stopRainAmbient = () => {
    rainAmbientAudio?.pause();
    rainAmbientAudio = null;
    rainAmbientGainSmooth = 0;
    rainAmbientLastUpdate = 0;
  };

  const stopOilBarrelFire = () => {
    oilBarrelFireAudio?.pause();
    oilBarrelFireAudio = null;
    oilBarrelFireGainSmooth = 0;
    oilBarrelFireLastUpdate = 0;
  };

  return {
    async preload() {
      if (preloadPromise) return preloadPromise;
      preloadPromise = Promise.resolve().then(() => {
        for (const [key, source] of Object.entries(CLIP_SOURCES) as Array<[SoundKey, SoundSource]>) {
          const url = asArray(source)[0];
          if (!url) continue;
          clipUrls.set(key, url);
          createAudio(url);
        }
        for (const url of [
          ...footstepUrls,
          ...bodyHitUrls,
          ...deathVocalUrls,
          ...enemyHitUrls,
        ]) {
          createAudio(url);
        }
      });
      return preloadPromise;
    },
    play,
    playWorld,
    playShot(options = {}) {
      play("laser_shot", { volume: 0.65, ...options });
    },
    playFootstep(options = {}) {
      playVariant(
        "footstep",
        footstepUrls,
        lastFootstepIndex,
        (index) => {
          lastFootstepIndex = index;
        },
        { volume: 0.52, ...options },
      );
    },
    playGrenadeWhoosh(options = {}) {
      play("grenade_whoosh", { volume: 0.78, ...options });
    },
    playGrenadeFloorHit(position, options = {}) {
      const impact = options.impact ?? 1;
      playWorld("grenade_floor_hit", position, {
        volume: (options.volume ?? 0.62) * clamp(0.45 + impact * 0.55, 0.35, 1),
        refDistance: 4.5,
        maxDistance: 40,
        ...options,
      });
    },
    playGrenadeExplosion(position, options = {}) {
      playWorld("grenade_explosion", position, {
        volume: 0.88,
        refDistance: 7,
        maxDistance: 55,
        ...options,
      });
    },
    playGrenadeCountdown(position, options = {}) {
      playWorld("grenade_countdown", position, {
        volume: 0.72,
        refDistance: 5,
        maxDistance: 48,
        ...options,
      });
    },
    playHoleFallDeath(options = {}) {
      play("hole_fall_death", { volume: 0.92, ...options });
    },
    playHoleFallDeathWorld(position, options = {}) {
      playWorld("hole_fall_death", position, {
        volume: 0.82,
        refDistance: 3.5,
        maxDistance: 40,
        playbackRate: 0.94 + Math.random() * 0.12,
        ...options,
      });
    },
    playPlayerDeath(options = {}) {
      playVariant(
        "playerDeath",
        deathVocalUrls,
        lastPlayerDeathIndex,
        (index) => {
          lastPlayerDeathIndex = index;
        },
        { volume: 0.9, ...options },
      );
    },
    playEnemyDeath(position, options = {}) {
      playWorldVariant(
        "enemyDeath",
        deathVocalUrls,
        lastEnemyDeathIndex,
        (index) => {
          lastEnemyDeathIndex = index;
        },
        position,
        {
          volume: (options.volume ?? 0.76) * (options.headshot ? 1.08 : options.blast ? 0.92 : 1),
          playbackRate: (options.headshot ? 1.04 : 1) * (0.94 + Math.random() * 0.14),
          refDistance: 3.5,
          maxDistance: 42,
          ...options,
        },
      );
    },
    playEnemyHit(position, options = {}) {
      playWorldVariant(
        "enemyHit",
        enemyHitUrls,
        lastEnemyHitIndex,
        (index) => {
          lastEnemyHitIndex = index;
        },
        position,
        {
          volume: (options.volume ?? 0.88) * (options.headshot ? 1.05 : 1),
          playbackRate: 0.92 + Math.random() * 0.16,
          refDistance: 3.5,
          maxDistance: 42,
          ...options,
        },
      );
    },
    playPlayerHurt(options = {}) {
      playVariant(
        "playerHurt",
        enemyHitUrls,
        lastEnemyHitIndex,
        (index) => {
          lastEnemyHitIndex = index;
        },
        { volume: 0.82, playbackRate: 0.9 + Math.random() * 0.14, ...options },
      );
    },
    playBodyFloorHit(position, options = {}) {
      const impact = options.impact ?? 1;
      playWorldVariant(
        "bodyHit",
        bodyHitUrls,
        lastBodyHitIndex,
        (index) => {
          lastBodyHitIndex = index;
        },
        position,
        {
          volume: (options.volume ?? 0.82) * clamp(0.45 + impact * 0.55, 0.35, 1),
          refDistance: 4,
          maxDistance: 38,
          ...options,
        },
      );
    },
    playSupplyPickup(options = {}) {
      play("pickup_cock", { volume: 0.65, ...options });
    },
    playHpPickup(options = {}) {
      play("pickup_hp", { volume: 0.6, ...options });
    },
    playHackDeath(options = {}) {
      play("hack_death", { volume: 0.85, ...options });
    },
    playHackConnect(options = {}) {
      play("hack_connect", { volume: 0.72, ...options });
    },
    playShopDenied(options = {}) {
      play("shop_denied", { volume: 0.78, ...options });
    },
    playShopPurchase(options = {}) {
      play("shop_purchase", { volume: 0.82, ...options });
    },
    updateRainAmbient(rainFade, nowMs = performance.now()) {
      const dt = rainAmbientLastUpdate
        ? Math.min((nowMs - rainAmbientLastUpdate) / 1000, 0.05)
        : 1 / 60;
      rainAmbientLastUpdate = nowMs;
      const target = clamp(rainFade, 0, 1) * RAIN_AMBIENT_MAX_VOLUME;
      rainAmbientGainSmooth = smoothGain(
        rainAmbientGainSmooth,
        target,
        dt,
        RAIN_AMBIENT_FADE_ATTACK,
        RAIN_AMBIENT_FADE_RELEASE,
      );
      if (
        rainAmbientGainSmooth <= RAIN_AMBIENT_STOP_THRESHOLD &&
        target <= RAIN_AMBIENT_STOP_THRESHOLD
      ) {
        stopRainAmbient();
        return;
      }
      const url = resolveClipUrl("rain_thunderstorm_ambient");
      if (!url) return;
      if (!rainAmbientAudio) {
        rainAmbientAudio = createAudio(url, true);
      }
      if (rainAmbientAudio.paused) {
        rainAmbientAudio.play().catch(() => {});
      }
      rainAmbientAudio.volume = clamp(rainAmbientGainSmooth, 0, 1);
    },
    stopRainAmbient,
    updateOilBarrelFire(firePositions, enabled = true) {
      if (!enabled || !firePositions?.length) {
        stopOilBarrelFire();
        return;
      }
      const now = performance.now();
      const dt = oilBarrelFireLastUpdate
        ? Math.min((now - oilBarrelFireLastUpdate) / 1000, 0.05)
        : 1 / 60;
      oilBarrelFireLastUpdate = now;
      let bestGain = 0;
      for (const position of firePositions) {
        bestGain = Math.max(bestGain, oilBarrelFireDistanceGain(listenerDistanceTo(position)));
      }
      oilBarrelFireGainSmooth = smoothGain(
        oilBarrelFireGainSmooth,
        bestGain,
        dt,
        OIL_BARREL_FIRE_FADE_ATTACK,
        OIL_BARREL_FIRE_FADE_RELEASE,
      );
      if (oilBarrelFireGainSmooth <= OIL_BARREL_FIRE_STOP_THRESHOLD && bestGain <= 0) {
        stopOilBarrelFire();
        return;
      }
      const url = resolveClipUrl("oil_barrel_fire");
      if (!url) return;
      if (!oilBarrelFireAudio) {
        oilBarrelFireAudio = createAudio(url, true);
      }
      if (oilBarrelFireAudio.paused) {
        oilBarrelFireAudio.play().catch(() => {});
      }
      oilBarrelFireAudio.volume = clamp(
        OIL_BARREL_FIRE_BASE_VOLUME * oilBarrelFireGainSmooth,
        0,
        1,
      );
    },
    stopOilBarrelFire,
    dispose() {
      for (const pool of oneShotPools.values()) {
        for (const audio of pool) {
          audio.pause();
        }
      }
      oneShotPools.clear();
      stopRainAmbient();
      stopOilBarrelFire();
    },
  };
}
