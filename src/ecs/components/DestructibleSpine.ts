import { Component } from '../Entity';

export class DestructibleSpine extends Component {
  public static readonly componentType = 'DestructibleSpine';
  public readonly componentType = 'DestructibleSpine';
  public spineIndex: number;

  constructor(spineIndex: number = 0) {
    super();
    this.spineIndex = spineIndex;
  }

  reset(): void {
    this.spineIndex = 0;
  }
}
