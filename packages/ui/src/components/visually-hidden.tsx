import { ReactNode } from 'react';

export const VisuallyHidden = ({ children }: { children: ReactNode }) => (
  <span className="sr-only">{children}</span>
);
