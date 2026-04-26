import { Component } from '../Entity';

export class DestructibleMushroom extends Component {
  public static readonly componentType = 'DestructibleMushroom';
  public readonly componentType = 'DestructibleMushroom';
  public mushroomIndex: number;

  constructor(mushroomIndex: number = 0) {
    super();
    this.mushroomIndex = mushroomIndex;
  }

  reset(): void {
    this.mushroomIndex = 0;
  }
}
