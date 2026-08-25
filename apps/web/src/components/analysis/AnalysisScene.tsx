'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type AnalysisScenePhase = 'idle' | 'running';

interface AnalysisSceneProps {
  phase: AnalysisScenePhase;
  target?: string;
}

const palette = {
  cyan: 0x48e9ff,
  white: 0xe9fcff,
  orange: 0xff6b3d,
};

function phaseCopy(phase: AnalysisScenePhase): {
  eyebrow: string;
  title: string;
  detail: string;
} {
  if (phase === 'running') {
    return {
      eyebrow: 'Live / signal sweep',
      title: 'Mapeando sinais',
      detail: 'As fontes estão respondendo em paralelo.',
    };
  }

  return {
    eyebrow: 'PierSec / signal map',
    title: 'Pronto para investigar',
    detail: 'Digite um alvo para abrir o mapa de sinais.',
  };
}

export function AnalysisScene({ phase, target }: AnalysisSceneProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  const [fallback, setFallback] = useState(false);
  const copy = phaseCopy(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.replaceChildren(canvas);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        powerPreference: 'low-power',
      });
    } catch {
      setFallback(true);
      return;
    }

    setFallback(false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
    camera.position.set(0, 0.08, 6.2);

    const system = new THREE.Group();
    scene.add(system);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.9, 1),
      new THREE.MeshBasicMaterial({
        color: palette.cyan,
        transparent: true,
        opacity: 0.82,
        wireframe: true,
      }),
    );
    system.add(core);

    const coreGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.66, 24, 16),
      new THREE.MeshBasicMaterial({
        color: palette.cyan,
        transparent: true,
        opacity: 0.06,
      }),
    );
    system.add(coreGlow);

    const ringMaterials = [
      new THREE.MeshBasicMaterial({
        color: palette.cyan,
        transparent: true,
        opacity: 0.42,
      }),
      new THREE.MeshBasicMaterial({
        color: palette.orange,
        transparent: true,
        opacity: 0.4,
      }),
    ];
    const rings = [
      new THREE.Mesh(
        new THREE.TorusGeometry(1.26, 0.012, 8, 96),
        ringMaterials[0],
      ),
      new THREE.Mesh(
        new THREE.TorusGeometry(1.63, 0.008, 8, 96),
        ringMaterials[1],
      ),
    ];
    const innerRing = rings[0]!;
    const outerRing = rings[1]!;
    innerRing.rotation.set(0.4, 0.16, 0.12);
    outerRing.rotation.set(-0.28, 0.64, -0.1);
    rings.forEach((ring) => system.add(ring));

    const starPositions: number[] = [];
    for (let index = 0; index < 180; index += 1) {
      const angle = index * 2.399963;
      const radius = 1.95 + (((index * 37) % 100) / 100) * 1.55;
      const height = (((index * 19) % 100) / 100 - 0.5) * 2.1;
      starPositions.push(
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius - 0.15,
      );
    }
    const starField = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute(starPositions, 3),
      ),
      new THREE.PointsMaterial({
        color: palette.white,
        size: 0.018,
        transparent: true,
        opacity: 0.38,
        sizeAttenuation: true,
      }),
    );
    scene.add(starField);

    const nodes = Array.from({ length: 9 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 4 === 0 ? palette.orange : palette.cyan,
        transparent: true,
        opacity: 0.92,
      });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 10, 8),
        material,
      );
      system.add(mesh);
      return {
        mesh,
        angle: index * 0.71,
        radius: 1.38 + (index % 3) * 0.18,
        speed: 0.24 + (index % 4) * 0.04,
        height: ((index % 3) - 1) * 0.22,
      };
    });

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    resizeObserver?.observe(host);
    resize();

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let active = document.visibilityState === 'visible';

    const render = (time: number) => {
      if (!active) return;
      const running = phaseRef.current === 'running';
      const speed = running ? 1.65 : 0.55;
      const pulse = running ? 1 + Math.sin(time * 0.006) * 0.06 : 1;

      if (!reducedMotion) {
        system.rotation.y = time * 0.00018 * speed;
        system.rotation.x = Math.sin(time * 0.00023 * speed) * 0.08;
        core.rotation.z = time * 0.00026 * speed;
        core.scale.setScalar(pulse);
        coreGlow.scale.setScalar(1 + (pulse - 1) * 2.4);
        innerRing.rotation.z += 0.0012 * speed;
        outerRing.rotation.x -= 0.0009 * speed;
        starField.rotation.y = time * 0.000025 * speed;
        nodes.forEach((node) => {
          const angle = node.angle + time * 0.0005 * node.speed * speed;
          node.mesh.position.set(
            Math.cos(angle) * node.radius,
            node.height + Math.sin(angle * 1.7) * 0.12,
            Math.sin(angle) * node.radius * 0.56,
          );
        });
      }

      renderer.render(scene, camera);
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };

    const handleVisibility = () => {
      active = document.visibilityState === 'visible';
      if (active && !reducedMotion && !frame) {
        frame = requestAnimationFrame(render);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    if (!reducedMotion) frame = requestAnimationFrame(render);

    return () => {
      active = false;
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', handleVisibility);
      resizeObserver?.disconnect();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) {
          return;
        }
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      });
      renderer.dispose();
      host.replaceChildren();
    };
  }, []);

  return (
    <section
      className={`analysis-scene analysis-scene--${phase}`}
      aria-label={`${copy.title}. ${target ? `Alvo ${target}.` : copy.detail}`}
    >
      <div className="analysis-scene__hud">
        <span className="analysis-scene__eyebrow">{copy.eyebrow}</span>
        <strong>{copy.title}</strong>
        <span>{copy.detail}</span>
      </div>
      <div className="analysis-scene__canvas" ref={canvasHostRef}>
        {fallback && (
          <span className="analysis-scene__fallback">
            Visualização 3D indisponível neste dispositivo
          </span>
        )}
      </div>
      <div className="analysis-scene__readout" aria-live="polite">
        <span className="analysis-scene__pulse" aria-hidden="true" />
        <code>{target || 'aguardando alvo'}</code>
        <span>{phase === 'running' ? 'coletando sinais' : 'canal pronto'}</span>
      </div>
    </section>
  );
}
