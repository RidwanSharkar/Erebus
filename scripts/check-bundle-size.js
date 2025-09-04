#!/usr/bin/env node

/**
 * Bundle size checker script
 * Runs the build and reports bundle size improvements
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building optimized bundle...\n');

try {
  // Run the build
  const buildOutput = execSync('npm run build', { encoding: 'utf8' });
  
  // Extract bundle size information
  const lines = buildOutput.split('\n');
  const routeLines = lines.filter(line => line.includes('○') || line.includes('├') || line.includes('└'));
  
  console.log('📊 Bundle Size Results:');
  console.log('========================\n');
  
  routeLines.forEach(line => {
    if (line.includes('kB')) {
      console.log(line);
    }
  });
  
  // Look for the main route size
  const mainRoute = lines.find(line => line.includes('┌ ○ /') || line.includes('○ /'));
  if (mainRoute) {
    const sizeMatch = mainRoute.match(/(\d+(?:\.\d+)?)\s*kB/g);
    if (sizeMatch && sizeMatch.length >= 2) {
      const bundleSize = parseFloat(sizeMatch[0]);
      const firstLoadSize = parseFloat(sizeMatch[1]);
      
      console.log('\n🎯 Performance Analysis:');
      console.log('========================');
      console.log(`Bundle Size: ${bundleSize} kB`);
      console.log(`First Load JS: ${firstLoadSize} kB`);
      
      if (firstLoadSize < 250) {
        console.log('✅ EXCELLENT: Bundle size is optimized!');
      } else if (firstLoadSize < 300) {
        console.log('🟡 GOOD: Bundle size is acceptable');
      } else {
        console.log('🔴 NEEDS WORK: Bundle size is still large');
      }
      
      console.log('\n💡 Improvements Made:');
      console.log('- ✅ Replaced wildcard Three.js imports with specific imports');
      console.log('- ✅ Added dynamic imports for game components');
      console.log('- ✅ Optimized webpack configuration');
      console.log('- ✅ Created Three.js barrel export for tree shaking');
    }
  }
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
