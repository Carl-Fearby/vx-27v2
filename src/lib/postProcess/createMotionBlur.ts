import {
  PostProcess,
  ShaderStore,
  type Camera,
  type Scene,
} from "@babylonjs/core";
import {
  DEFAULT_MOTION_BLUR_TUNING,
  type MotionBlurTuning,
} from "@/lib/postProcess/motionBlurTuning";

const SHADER_NAME = "fpsCameraMotionBlur";
const BLUR_VELOCITY_SCALE = 14;
const MAX_BLUR_UV = 0.12;

if (!ShaderStore.ShadersStore[`${SHADER_NAME}PixelShader`]) {
  ShaderStore.ShadersStore[`${SHADER_NAME}PixelShader`] = `
    varying vec2 vUV;
    uniform sampler2D textureSampler;
    uniform vec2 blurVector;
    uniform float sampleCount;

    void main(void) {
      vec4 color = texture2D(textureSampler, vUV);
      float count = clamp(sampleCount, 1.0, 32.0);
      vec2 step = blurVector / count;
      float accum = 1.0;
      for (float i = 1.0; i < 32.0; i += 1.0) {
        if (i >= count) {
          break;
        }
        float t = (i / count) - 0.5;
        color += texture2D(textureSampler, vUV + step * t * count);
        accum += 1.0;
      }
      gl_FragColor = color / accum;
      gl_FragColor.a = 1.0;
    }
  `;
}

export type SceneMotionBlur = {
  applyTuning(tuning: MotionBlurTuning): void;
  setCameraMotion(yawDelta: number, pitchDelta: number): void;
  dispose(): void;
};

export function createMotionBlur(
  scene: Scene,
  camera: Camera,
  initialTuning: MotionBlurTuning = DEFAULT_MOTION_BLUR_TUNING,
): SceneMotionBlur {
  let tuning: MotionBlurTuning = { ...initialTuning };
  let blurVectorX = 0;
  let blurVectorY = 0;
  let attached = false;

  const postProcess = new PostProcess(SHADER_NAME, SHADER_NAME, {
    uniforms: ["blurVector", "sampleCount"],
    samplers: ["textureSampler"],
    size: 1,
    engine: scene.getEngine(),
    reusable: true,
  });

  postProcess.onApply = (effect) => {
    effect.setFloat2("blurVector", blurVectorX, blurVectorY);
    effect.setFloat("sampleCount", tuning.motionBlurSamples);
  };

  const syncAttached = () => {
    if (tuning.enabled && !attached) {
      camera.attachPostProcess(postProcess);
      attached = true;
      return;
    }

    if (!tuning.enabled && attached) {
      camera.detachPostProcess(postProcess);
      attached = false;
    }
  };

  const applyTuning = (next: MotionBlurTuning) => {
    tuning = next;
    syncAttached();
  };

  const setCameraMotion = (yawDelta: number, pitchDelta: number) => {
    if (!tuning.enabled) {
      blurVectorX = 0;
      blurVectorY = 0;
      return;
    }

    let blurX = yawDelta * BLUR_VELOCITY_SCALE * tuning.motionStrength;
    let blurY = pitchDelta * BLUR_VELOCITY_SCALE * tuning.motionStrength;
    const maxBlur = MAX_BLUR_UV * tuning.motionStrength;
    const length = Math.hypot(blurX, blurY);
    if (length > maxBlur) {
      const scale = maxBlur / length;
      blurX *= scale;
      blurY *= scale;
    }

    blurVectorX = blurX;
    blurVectorY = blurY;
  };

  applyTuning(initialTuning);

  return {
    applyTuning,
    setCameraMotion,
    dispose() {
      if (attached) {
        camera.detachPostProcess(postProcess);
        attached = false;
      }
      postProcess.dispose(camera);
    },
  };
}
