'use client';

import { forwardRef } from 'react';
import type { MeshProps } from '@react-three/fiber';
import type { Mesh } from 'three';

/** Mesh backed by module-level shared geometry/material — skip R3F auto-dispose on unmount. */
export const SharedMesh = forwardRef<Mesh | null, MeshProps>(function SharedMesh(props, ref) {
  return <mesh ref={ref} dispose={null} {...props} />;
});
