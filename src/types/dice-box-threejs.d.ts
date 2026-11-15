declare module "@3d-dice/dice-box-threejs" {
  export default class DiceBox {
    constructor(
      selector: string,
      options?: {
        sounds?: boolean;
        shadows?: boolean;
        theme_colorset?: string;
        theme_texture?: string;
        theme_material?: string;
        theme_surface?: string;
      },
    );
    desk?: { visible: boolean };
    renderer?: {
      render: (scene: unknown, camera: unknown) => void;
      dispose: () => void;
      forceContextLoss: () => void;
      domElement: HTMLCanvasElement;
    };
    initialize(): Promise<void>;
    roll(notation: string): Promise<unknown>;
    clearDice(): void;
    setDimensions: (size: { x: number; y: number }) => void;
  }
}
