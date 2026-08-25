import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

type PanelProps<T extends ElementType = 'section'> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

export function Panel<T extends ElementType = 'section'>({
  as,
  children,
  className = '',
  ...props
}: PanelProps<T>) {
  const Tag = as ?? 'section';
  return (
    <Tag className={('panel ' + className).trim()} {...props}>
      {children}
    </Tag>
  );
}
