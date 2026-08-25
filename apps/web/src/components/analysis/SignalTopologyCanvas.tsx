'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

export type SignalTopologyStatus = 'idle' | 'loading' | 'success' | 'attention';

export interface SignalTopologyItem {
  id: string;
  label: string;
  status: SignalTopologyStatus;
}

const colors: Record<SignalTopologyStatus | 'center', number> = {
  idle: 0x788486,
  loading: 0xff6b3d,
  success: 0x5ed9d5,
  attention: 0xf05d67,
  center: 0xf1eee6,
};

function statusLabel(status: SignalTopologyStatus): string {
  return {
    idle: 'aguardando',
    loading: 'em execução',
    success: 'sucesso',
    attention: 'atenção',
  }[status];
}

export function SignalTopologyCanvas({
  items,
  target,
}: {
  items: SignalTopologyItem[];
  target?: string | null;
}) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const topologyKey = useMemo(
    () => items.map((item) => item.id + ':' + item.status).join('|'),
    [items],
  );

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
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5, 5, 3, -3, 0.1, 20);
    camera.position.z = 10;
    const network = new THREE.Group();
    scene.add(network);

    const centerMaterial = new THREE.MeshBasicMaterial({
      color: colors.center,
      transparent: true,
      opacity: 0.92,
    });
    const center = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 20),
      centerMaterial,
    );
    network.add(center);

    const nodeObjects: Array<{
      mesh: THREE.Mesh;
      material: THREE.MeshBasicMaterial;
      item: SignalTopologyItem;
    }> = [];
    const nodeCount = Math.max(items.length, 1);
    const columns = Math.min(
      8,
      Math.max(3, Math.ceil(Math.sqrt(nodeCount * 1.65))),
    );
    const rows = Math.ceil(nodeCount / columns);
    const xStep = columns === 1 ? 0 : Math.min(1.15, 7.8 / (columns - 1));
    const yStep = rows === 1 ? 0 : Math.min(0.8, 4.5 / (rows - 1));

    items.forEach((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = (column - (columns - 1) / 2) * xStep;
      const y = ((rows - 1) / 2 - row) * yStep;
      const material = new THREE.MeshBasicMaterial({
        color: colors[item.status],
        transparent: true,
        opacity: item.status === 'idle' ? 0.54 : 0.92,
      });
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(0.075, 12),
        material,
      );
      mesh.position.set(x, y, 0.1);
      network.add(mesh);
      nodeObjects.push({ item, material, mesh });

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(x, y, 0),
        ]),
        new THREE.LineBasicMaterial({
          color: colors[item.status],
          transparent: true,
          opacity: item.status === 'idle' ? 0.16 : 0.42,
        }),
      );
      network.add(line);
    });

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const viewHeight = 6;
      camera.left = (-viewHeight * aspect) / 2;
      camera.right = (viewHeight * aspect) / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    let active = document.visibilityState === 'visible';
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const render = (time: number) => {
      if (!active) return;
      nodeObjects.forEach(({ item, mesh, material }) => {
        if (item.status === 'loading' && !reducedMotion) {
          const pulse = 1 + Math.sin(time * 0.004 + mesh.position.x) * 0.24;
          mesh.scale.setScalar(pulse);
          material.opacity = 0.68 + (pulse - 0.76) * 0.8;
        }
      });
      renderer.render(scene, camera);
      if (!reducedMotion) frame = requestAnimationFrame(render);
    };
    const handleVisibility = () => {
      active = document.visibilityState === 'visible';
      if (active && !reducedMotion && !frame)
        frame = requestAnimationFrame(render);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    if (!reducedMotion) frame = requestAnimationFrame(render);

    return () => {
      active = false;
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', handleVisibility);
      observer.disconnect();
      network.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line))
          return;
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
  }, [topologyKey, items]);

  const accessibleSummary =
    items.length === 0
      ? 'Nenhum check disponível.'
      : items
          .map((item) => item.label + ': ' + statusLabel(item.status))
          .join('. ');
  const topologyLabel =
    'Topologia de sinais' +
    (target ? ' para ' + target : '') +
    '. ' +
    accessibleSummary;

  return (
    <div className="signal-topology" role="img" aria-label={topologyLabel}>
      <div className="signal-topology__header">
        <span className="eyebrow">Signal topology</span>
        <span className="signal-topology__count">
          {items.filter((item) => item.status === 'success').length}/
          {items.length} OK
        </span>
      </div>
      <div className="signal-topology__canvas" ref={canvasHostRef}>
        {fallback && (
          <span className="signal-topology__fallback">
            Visualização indisponível neste dispositivo
          </span>
        )}
      </div>
      <div className="signal-topology__legend" aria-hidden="true">
        <span>
          <i className="signal-topology__dot signal-topology__dot--success" />{' '}
          sucesso
        </span>
        <span>
          <i className="signal-topology__dot signal-topology__dot--loading" />{' '}
          em execução
        </span>
        <span>
          <i className="signal-topology__dot signal-topology__dot--attention" />{' '}
          atenção
        </span>
      </div>
    </div>
  );
}
