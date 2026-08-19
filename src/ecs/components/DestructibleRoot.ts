import { Component } from '../Entity';

export class DestructibleRoot extends Component {
  public static readonly componentType = 'DestructibleRoot';
  public readonly componentType = 'DestructibleRoot';
  public rootIndex: number;

  constructor(rootIndex: number = 0) {
    super();
    this.rootIndex = rootIndex;
  }

  reset(): void {
    this.rootIndex = 0;
  }
}
