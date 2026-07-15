import { Component } from '../Entity';

export class Energy extends Component {
  public static readonly componentType = 'Energy';
  public readonly componentType = 'Energy';
  public maxEnergy: number;
  public currentEnergy: number;
  public drainRate: number;
  public regenRate: number;
  public regenDelay: number;
  public lastSpendTime: number;
  public isRegenerating: boolean;

  constructor(
    maxEnergy: number = 100,
    drainRate: number = 25,
    regenRate: number = 40,
    regenDelay: number = 2,
  ) {
    super();
    this.maxEnergy = maxEnergy;
    this.currentEnergy = maxEnergy;
    this.drainRate = drainRate;
    this.regenRate = regenRate;
    this.regenDelay = regenDelay;
    this.lastSpendTime = 0;
    this.isRegenerating = false;
  }

  public canSprint(): boolean {
    return this.currentEnergy > 0;
  }

  public spend(amount: number): void {
    if (amount <= 0) return;

    this.currentEnergy = Math.max(0, this.currentEnergy - amount);
    this.lastSpendTime = Date.now();
    this.isRegenerating = false;
  }

  public update(deltaTime: number): void {
    if (this.currentEnergy >= this.maxEnergy) {
      this.isRegenerating = false;
      return;
    }

    const timeSinceLastSpend = (Date.now() - this.lastSpendTime) / 1000;

    if (timeSinceLastSpend >= this.regenDelay) {
      if (!this.isRegenerating) {
        this.isRegenerating = true;
      }

      const regenAmount = this.regenRate * deltaTime;
      this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + regenAmount);
    }
  }

  public getEnergyPercentage(): number {
    return this.maxEnergy > 0 ? this.currentEnergy / this.maxEnergy : 0;
  }

  public isFullEnergy(): boolean {
    return this.currentEnergy >= this.maxEnergy;
  }

  public isEnergyDepleted(): boolean {
    return this.currentEnergy <= 0;
  }

  public restoreEnergy(): void {
    this.currentEnergy = this.maxEnergy;
    this.isRegenerating = false;
  }

  public setEnergy(current: number, max: number): void {
    this.currentEnergy = Math.max(0, Math.min(max, current));
    this.maxEnergy = max;
  }

  public reset(): void {
    this.currentEnergy = this.maxEnergy;
    this.lastSpendTime = 0;
    this.isRegenerating = false;
    this.enabled = true;
  }
}
