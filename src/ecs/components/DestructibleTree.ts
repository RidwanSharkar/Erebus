import { Component } from '../Entity';

export class DestructibleTree extends Component {
  public static readonly componentType = 'DestructibleTree';
  public readonly componentType = 'DestructibleTree';
  public treeIndex: number;

  constructor(treeIndex: number = 0) {
    super();
    this.treeIndex = treeIndex;
  }

  reset(): void {
    this.treeIndex = 0;
  }
}
