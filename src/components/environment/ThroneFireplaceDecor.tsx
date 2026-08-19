'use client';

import React from 'react';
import FireplaceVisual, { preloadFireplaceVisual } from './FireplaceVisual';

export function preloadThroneFireplaceDecor(): void {
  preloadFireplaceVisual();
}

function ThroneFireplaceDecor() {
  return (
    <group name="throne-fireplace-decor">
      <FireplaceVisual />
    </group>
  );
}

const MemoThroneFireplaceDecor = React.memo(ThroneFireplaceDecor);
MemoThroneFireplaceDecor.displayName = 'ThroneFireplaceDecor';

export default MemoThroneFireplaceDecor;
