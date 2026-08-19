import { Component } from '../Entity';

export class DestructibleRock extends Component {
  public static readonly componentType = 'DestructibleRock';
  public readonly componentType = 'DestructibleRock';
  public rockIndex: number;

  constructor(rockIndex: number = 0) {
    super();
    this.rockIndex = rockIndex;
  }

  reset(): void {
    this.rockIndex = 0;
  }
}
