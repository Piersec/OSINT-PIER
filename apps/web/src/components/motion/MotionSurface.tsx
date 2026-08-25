'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';

export function MotionSurface({
  children,
  className = '',
  ...props
}: HTMLMotionProps<'div'> & { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={('motion-surface ' + className).trim()}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.28, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
