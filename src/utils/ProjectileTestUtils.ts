// Utility functions for testing projectile system
import { WeaponSubclass } from '@/components/dragon/weapons';
import { ControlSystem } from '@/systems/ControlSystem';

export class ProjectileTestUtils {
  private controlSystem: ControlSystem;

  constructor(controlSystem: ControlSystem) {
    this.controlSystem = controlSystem;
  }

  // Test different weapon subclasses
  public testWeaponSubclasses(): void {
    console.log('🧪 Testing different weapon subclasses...');
    
    // Test Venom arrows (green)
    this.controlSystem.setWeaponSubclass(WeaponSubclass.VENOM);
    this.controlSystem.setWeaponLevel(1);
    console.log('✅ Venom arrows ready (green)');
    
    setTimeout(() => {
      // Test Elemental arrows level 1 (bone color)
      this.controlSystem.setWeaponSubclass(WeaponSubclass.ELEMENTAL);
      this.controlSystem.setWeaponLevel(1);
      console.log('✅ Elemental arrows level 1 ready (bone color)');
      
      setTimeout(() => {
        // Test Elemental arrows level 3+ (icy blue)
        this.controlSystem.setWeaponSubclass(WeaponSubclass.ELEMENTAL);
        this.controlSystem.setWeaponLevel(3);
        console.log('✅ Elemental arrows level 3+ ready (icy blue)');
        
        setTimeout(() => {
          // Reset to default
          this.controlSystem.setWeaponSubclass(WeaponSubclass.VENOM);
          this.controlSystem.setWeaponLevel(1);
          console.log('✅ Reset to Venom level 1');
        }, 3000);
      }, 3000);
    }, 3000);
  }

  // Cycle through weapon types for visual testing
  public startWeaponCycling(): void {
    const subclasses = [WeaponSubclass.VENOM, WeaponSubclass.ELEMENTAL];
    const levels = [1, 2, 3, 4];
    let currentSubclassIndex = 0;
    let currentLevelIndex = 0;

    const cycle = () => {
      const subclass = subclasses[currentSubclassIndex];
      const level = levels[currentLevelIndex];
      
      this.controlSystem.setWeaponSubclass(subclass);
      this.controlSystem.setWeaponLevel(level);
      
      // Move to next combination
      currentLevelIndex++;
      if (currentLevelIndex >= levels.length) {
        currentLevelIndex = 0;
        currentSubclassIndex++;
        if (currentSubclassIndex >= subclasses.length) {
          currentSubclassIndex = 0;
        }
      }
    };

    // Initial setup
    cycle();
    
    // Cycle every 5 seconds
    setInterval(cycle, 5000);
    console.log('🔄 Started weapon cycling (changes every 5 seconds)');
  }

  // Get current weapon info
  public getCurrentWeaponInfo(): string {
    const config = this.controlSystem.getCurrentWeaponConfig();
    const colorInfo = this.getArrowColorInfo(config.subclass, config.level);
    return `Current: ${config.subclass} Level ${config.level} (${colorInfo})`;
  }

  private getArrowColorInfo(subclass: WeaponSubclass, level: number): string {
    if (subclass === WeaponSubclass.VENOM) return 'Green';
    if (subclass === WeaponSubclass.ELEMENTAL && level >= 3) return 'Icy Blue';
    return 'Bone Color';
  }

  // Performance monitoring
  public startPerformanceMonitoring(): void {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const monitor = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) { // Every second
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        console.log(`📊 FPS: ${fps} | ${this.getCurrentWeaponInfo()}`);
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(monitor);
    };
    
    monitor();
    console.log('📈 Started performance monitoring');
  }
}

// Global test functions for console access
declare global {
  interface Window {
    testProjectiles?: {
      testWeaponSubclasses: () => void;
      startWeaponCycling: () => void;
      startPerformanceMonitoring: () => void;
      getCurrentWeaponInfo: () => string;
    };
  }
}

export function setupProjectileTests(controlSystem: ControlSystem): void {
  const testUtils = new ProjectileTestUtils(controlSystem);
  
  // Make test functions available globally for console access
  if (typeof window !== 'undefined') {
    window.testProjectiles = {
      testWeaponSubclasses: () => testUtils.testWeaponSubclasses(),
      startWeaponCycling: () => testUtils.startWeaponCycling(),
      startPerformanceMonitoring: () => testUtils.startPerformanceMonitoring(),
      getCurrentWeaponInfo: () => testUtils.getCurrentWeaponInfo()
    };
    
    console.log('🧪 Projectile test functions available:');
    console.log('  window.testProjectiles.testWeaponSubclasses() - Test different arrow types');
    console.log('  window.testProjectiles.startWeaponCycling() - Auto-cycle weapon types');
    console.log('  window.testProjectiles.startPerformanceMonitoring() - Monitor FPS');
    console.log('  window.testProjectiles.getCurrentWeaponInfo() - Get current weapon info');
  }
}
