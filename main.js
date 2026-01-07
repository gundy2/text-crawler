import * as THREE from 'three';
import { TextRenderer } from './text-renderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/* --- CONFIGURATION --- */
const CANVAS_WIDTH = 2048;

let scrollSpeed = 2;
const tiltAngle = -80.0;
const titleSize = 140;
const subSize = 145;
const bodySize = 110;
/* --- RECORDING STATE --- */
let isRecording = false;
let mediaRecorder = null;
let chunks = [];
// Locked column width to 60% of canvas width
let columnWidth = CANVAS_WIDTH * 0.50; 
const startY = -7;
const startZ = 86;

/* --- FONT LOADING --- */
let opentypeFont = null;
let fontLoaded = false;
let appInitialized = false;

// Define the path once so it stays consistent
const FONT_FILE_PATH = './star-wars-crawl/Pathway_Gothic_One/PathwayGothicOne-Regular.ttf';

opentype.load(FONT_FILE_PATH, (err, font) => {
  if (err) {
    console.error("Opentype failed to load font:", err);
    fontLoaded = false;
    if (!appInitialized) initializeApp();
  } else {
    opentypeFont = font;
    fontLoaded = true;

    // Use the same path constant for the CSS FontFace
    const fontFace = new FontFace('PathwayGothic', `url(${FONT_FILE_PATH})`);
    
    fontFace.load().then((loadedFace) => {
        document.fonts.add(loadedFace);
        console.log("Font injected into CSS registry");
        return document.fonts.ready;
    }).then(() => {
        console.log('Font engine fully ready');
        if (!appInitialized) {
            initializeApp();
        } else if (textRenderer) {
            textRenderer.setFont(opentypeFont);
            renderTextToCanvas();
        }
    }).catch(e => {
        console.error("Font injection error:", e);
        // Fallback to initializing anyway so the app doesn't hang on a black screen
        if (!appInitialized) initializeApp();
    });
  }
});

// Initialize after a timeout if font doesn't load
setTimeout(() => {
  if (!appInitialized) {
    console.log('Initializing without custom font');
    initializeApp();
  }
}, 2000);

/* --- SCENE SETUP --- */
const scene = new THREE.Scene();

const textureLoader = new THREE.TextureLoader();
textureLoader.load('./textures/galaxy.jpg', (texture) => {
  scene.background = texture;
}, undefined, () => {
  scene.background = new THREE.Color(0x000000);
});

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 100);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ 
  antialias: true, 
  preserveDrawingBuffer: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

/* --- CANVAS TEXTURE --- */
const canvas = document.createElement('canvas');
canvas.width = CANVAS_WIDTH;

const texture = new THREE.CanvasTexture(canvas);
texture.minFilter = THREE.LinearFilter;
texture.magFilter = THREE.LinearFilter;

const geometry = new THREE.PlaneGeometry(50, 1, 1, 1);

// Shader material with improved screen-space fog
const material = new THREE.ShaderMaterial({
  uniforms: {
    map: { value: texture },
    fadeBottomStart: { value: 0.0 },
    fadeBottomEnd: { value: 0.3 },
    fadeTopStart: { value: 0.3 },
    fadeTopEnd: { value: 0.5}
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec4 vScreenPos;
    
    void main() {
      vUv = uv;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      vScreenPos = gl_Position;
    }
  `,
  fragmentShader: `
    uniform sampler2D map;
    uniform float fadeBottomStart;
    uniform float fadeBottomEnd;
    uniform float fadeTopStart;
    uniform float fadeTopEnd;
    
    varying vec2 vUv;
    varying vec4 vScreenPos;
    
    void main() {
      vec4 texColor = texture2D(map, vUv);
      
      // Calculate screen-space Y position (0 = bottom, 1 = top)
      float screenY = (vScreenPos.y / vScreenPos.w) * 0.5 + 0.5;
      
      // Bottom fade: emerges from bottom (0 = bottom)
      // Text invisible at screenY=0, fully visible at screenY=0.3
      float bottomFade = smoothstep(fadeBottomStart, fadeBottomEnd, screenY);
      
      // Top fade: disappears at top (1 = top)
      // Text fully visible at screenY=0.7, invisible at screenY=1.0
      // Using 1.0 - screenY converts to: 1=bottom, 0=top
      float invertedY = 1.0 - screenY;
      float topFade = smoothstep(fadeTopStart, fadeTopEnd, invertedY);
      
      // Combine both fades
      float totalFade = bottomFade * topFade;
      
      gl_FragColor = vec4(texColor.rgb, texColor.a * totalFade);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide
});

const crawlPlane = new THREE.Mesh(geometry, material);
scene.add(crawlPlane);

let crawlHeight = 0;
let currentZ = startZ;

/* --- TEXT RENDERER --- */
let textRenderer = null;

function initializeApp() {
  appInitialized = true;
  
  textRenderer = new TextRenderer(canvas, { canvasWidth: CANVAS_WIDTH });

  if (fontLoaded && opentypeFont) {
    textRenderer.setFont(opentypeFont);
  }
  
  textRenderer.initJustifier({
    tolerance: 2,
    hyphenPenalty: 50
  });

  initPostProcessing(); 
  
  renderTextToCanvas();
  updatePlaneTransform();
  animate();
  
  document.getElementById('btnRecord').disabled = false;
}

/* --- TEXT RENDERING --- */
let firstRun = true;

function renderTextToCanvas() {
  if (!textRenderer) return;

// If it's the very first time the app opens, give it a tiny breath
  if (firstRun) {
    firstRun = false;
    setTimeout(renderTextToCanvas, 300);
    return;
  }
  
  const title = document.getElementById('inTitle').value;
  const subtitle = document.getElementById('inSub').value;
  const body = document.getElementById('inBody').value;

  // 1. IMPROVED ESTIMATION: Make the initial guess safer
  // Changing divisor from 6 to 3 assumes fewer words per line (safer for narrow columns)
  const paragraphs = body.split('\n\n');
  const lineHeight = bodySize * 1.4;
  let estimatedLines = 0;

  for (let para of paragraphs) {
    const words = para.trim().split(/\s+/);
    estimatedLines += Math.ceil(words.length / 3); 
  }

  const titleHeight = title ? titleSize * 2 : 0;
  const subHeight = subtitle ? subSize * 2.5 : 0;
  const bodyHeight = estimatedLines * lineHeight;

  // Set initial height with a buffer
  crawlHeight = titleHeight + subHeight + bodyHeight + 1000;
  canvas.height = Math.max(crawlHeight, 2000);

  const renderConfig = {
    titleSize,
    subSize,
    bodySize,
    columnWidth,
    useJustification: true,
    justificationQuality: 2
  };

  try {
  // 2. FIRST RENDER PASS
    let finalHeight = textRenderer.renderCrawl(title, subtitle, body, renderConfig);

  // 3. AUTO-RESIZE CHECK (The "Dynamic" Fix)
    // If the actual text went past the canvas bottom, resize and render again.
    if (finalHeight > canvas.height) {
      console.log('Text exceeded canvas. Resizing to ' + finalHeight + ' and re-rendering.');
      canvas.height = finalHeight + 100; // Resize to fit exactly + small buffer
      finalHeight = textRenderer.renderCrawl(title, subtitle, body, renderConfig);
    }

    crawlHeight = finalHeight;
  } catch (error) {
    console.error('Error rendering text:', error);
  }

  // 4. Dispose and Recreate Texture (Standard procedure now)
  if (material.uniforms.map.value) {
    material.uniforms.map.value.dispose();
  }

  const newTexture = new THREE.CanvasTexture(canvas);
  newTexture.minFilter = THREE.LinearFilter;
  newTexture.magFilter = THREE.LinearFilter;
  
  material.uniforms.map.value = newTexture;
  material.needsUpdate = true;

  // 5. Update Geometry
  const aspectRatio = crawlHeight / CANVAS_WIDTH;
  geometry.dispose();
  const newGeometry = new THREE.PlaneGeometry(50, 50 * aspectRatio, 1, 1);
  crawlPlane.geometry = newGeometry;
  
  updatePlaneTransform();
}

let composer;

function initPostProcessing() {
  const renderScene = new RenderPass(scene, camera);

  // Parameters: Resolution, Strength, Radius, Threshold
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,  // Strength: How bright the glow is
    0.4,  // Radius: How far the glow spreads
    0.85  // Threshold: Only things brighter than this will glow (Yellow text is bright)
  );

  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);
}

function updatePlaneTransform() {
  const tiltRad = THREE.MathUtils.degToRad(tiltAngle);
  crawlPlane.rotation.x = tiltRad;
  
  const distanceTraveled = startZ - currentZ;
  
  // Get the current height of the plane
  const planeHeight = crawlPlane.geometry.parameters.height;
  
  // CALCULATE TOP-ALIGNMENT OFFSET:
  // Instead of the center being at the position, we shift the center down 
  // by half the height so the TOP edge sits at the target coordinate.
  const yOffset = (planeHeight / 2) * Math.cos(Math.abs(tiltRad));
  const zOffset = (planeHeight / 2) * Math.sin(Math.abs(tiltRad));

  crawlPlane.position.z = currentZ + zOffset;
  crawlPlane.position.y = (startY - yOffset) + (distanceTraveled / Math.tan(Math.abs(tiltRad)));
}

/* --- AUDIO --- */
let audioCtx, audioDest, audioTag, audioSource, gainNode;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioDest = audioCtx.createMediaStreamDestination();
    audioTag = new Audio();
    audioTag.crossOrigin = "anonymous";
    audioSource = audioCtx.createMediaElementSource(audioTag);
    gainNode = audioCtx.createGain();
    
    audioSource.connect(gainNode);
    gainNode.connect(audioDest);
    gainNode.connect(audioCtx.destination);
  }
}

/* --- CONTROLS --- */
let isPaused = false;
const clock = new THREE.Clock();

document.getElementById('btnUpdate').onclick = () => {
  renderTextToCanvas(); // Generates new texture
  currentZ = startZ;    // Resets position to start
  updatePlaneTransform();
};

document.getElementById('btnPause').onclick = () => {
  isPaused = !isPaused;
  document.getElementById('btnPause').innerText = isPaused ? 
    'RESUME ANIMATION' : 'PAUSE ANIMATION';
  if (audioTag && audioTag.src) {
    isPaused ? audioTag.pause() : audioTag.play();
  }
};

document.getElementById('btnReset').onclick = () => {
  currentZ = startZ;
  updatePlaneTransform();
  if (audioTag && audioTag.src) {
    audioTag.currentTime = 0;
    if (!isPaused) audioTag.play();
  }
};

document.getElementById('inSpeed').oninput = (e) => {
  scrollSpeed = parseFloat(e.target.value);
  document.getElementById('speedVal').innerText = scrollSpeed;
};

document.getElementById('inVolume').oninput = (e) => {
  const vol = parseInt(e.target.value);
  document.getElementById('volVal').innerText = vol + '%';
  if (gainNode) gainNode.gain.value = vol / 100;
  if (audioTag) audioTag.volume = vol / 100;
};

document.getElementById('inLoop').onchange = (e) => {
  if (audioTag) audioTag.loop = e.target.checked;
};

document.getElementById('inAudio').onchange = (e) => {
  const file = e.target.files[0];
  if (file) {
    initAudio();
    audioTag.src = URL.createObjectURL(file);
    audioTag.onloadeddata = () => {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      audioTag.play();
    };
  }
};

document.getElementById('btnToggleUI').onclick = () => {
  const ui = document.getElementById('ui-layer');
  if (ui.style.opacity === "0") {
    ui.style.opacity = "1";
    ui.style.pointerEvents = "auto";
  } else {
    ui.style.opacity = "0";
    ui.style.pointerEvents = "none";
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.log(e));
    }
  }
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('ui-layer').style.opacity = "1";
    document.getElementById('ui-layer').style.pointerEvents = "auto";
  }
});

/* --- RECORDING LOGIC --- */
document.getElementById('btnRecord').onclick = async () => {
  const btn = document.getElementById('btnRecord');

  if (isRecording) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording = false;
    btn.innerText = "START RECORDING";
    btn.classList.remove('recording');
  } else {
    // 1. Fullscreen
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen blocked or failed:", err);
    }

    // 2. Restart Crawl Position
    currentZ = startZ;
    updatePlaneTransform();
    
    // PREPARE Audio (but do not play yet)
    if (audioTag && audioTag.src) {
      audioTag.currentTime = 0; 
      audioTag.pause(); // Ensure it is paused during the 1s transition
    }

    // 3. Small delay for Fullscreen transition
    setTimeout(() => {
      isRecording = true;
      chunks = [];
      
      const canvasStream = renderer.domElement.captureStream(60); 
      if (!audioCtx) initAudio(); 

      const tracks = [...canvasStream.getVideoTracks()];
      if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
        tracks.push(...audioDest.stream.getAudioTracks());
      }

      const combinedStream = new MediaStream(tracks);

      mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm; codecs=vp9',
        videoBitsPerSecond: 8000000 
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `crawl_recording_${Date.now()}.webm`;
        link.click();
      };

      // --- CRITICAL SYNC POINT ---
      mediaRecorder.start(); // Start recording the stream
      
      if (audioTag && audioTag.src) {
        audioTag.play(); // Start the music at the exact same moment
      }
      // ---------------------------

      btn.innerText = "STOP RECORDING";
      btn.classList.add('recording');
    }, 1000); 
  }
};

/* --- ANIMATION LOOP --- */
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  
  if (!isPaused) {
    currentZ -= scrollSpeed * delta;
    
    const planeHeight = crawlPlane.geometry.parameters.height;
    const endZ = -planeHeight * 2;
    
    if (document.getElementById('inContinuous').checked && currentZ < endZ) {
      currentZ = startZ;
    }
    updatePlaneTransform();
  }

    if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight);
  }
});
