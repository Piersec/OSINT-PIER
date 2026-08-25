'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { type RefObject } from 'react';

gsap.registerPlugin(useGSAP);

export function useGsapReveal(
  scope: RefObject<HTMLElement | null>,
  dependency: string,
) {
  useGSAP(
    () => {
      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      if (reducedMotion) return;
      gsap.fromTo(
        '[data-reveal]',
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.36,
          ease: 'power2.out',
          stagger: 0.045,
          clearProps: 'all',
        },
      );
    },
    { dependencies: [dependency], scope, revertOnUpdate: true },
  );
}
