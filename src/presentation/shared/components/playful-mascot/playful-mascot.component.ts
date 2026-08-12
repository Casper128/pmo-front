import { Component, ElementRef, OnDestroy, ViewChild, effect, inject, signal } from '@angular/core';
import type {
  BufferGeometry,
  Group,
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { PlayfulMascotService } from './playful-mascot.service';

@Component({
  selector: 'app-playful-mascot',
  standalone: true,
  templateUrl: './playful-mascot.component.html',
  styleUrl: './playful-mascot.component.css',
})
export class PlayfulMascotComponent implements OnDestroy {
  readonly mascot = inject(PlayfulMascotService);
  readonly rendererReady = signal(false);

  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private character: Group | null = null;
  private leftWing: Group | null = null;
  private rightWing: Group | null = null;
  private animationFrame: number | null = null;
  private startedAt = 0;
  private readonly threeModulePromise = import('three');
  private canvasElement: HTMLCanvasElement | null = null;

  constructor() {
    effect(() => {
      const cueId = this.mascot.cue()?.id;
      if (!cueId || !this.canvasElement) return;
      queueMicrotask(() => {
        if (this.canvasElement && this.mascot.cue()?.id === cueId) {
          void this.createScene(this.canvasElement);
        }
      });
    });
  }

  @ViewChild('pigCanvas')
  set pigCanvas(element: ElementRef<HTMLCanvasElement> | undefined) {
    this.canvasElement = element?.nativeElement || null;
    if (!element) {
      this.destroyScene();
      return;
    }
    void this.createScene(element.nativeElement);
  }

  ngOnDestroy(): void {
    this.destroyScene();
  }

  private async createScene(canvas: HTMLCanvasElement): Promise<void> {
    this.destroyScene();
    try {
      const THREE = await this.threeModulePromise;
      if (!canvas.isConnected || !this.mascot.cue()) return;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(280, 235, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 280 / 235, 0.1, 100);
      camera.position.set(0, 0.25, 6.4);
      camera.lookAt(0, 0.15, 0);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x7c3aed, 2.3));
      const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
      keyLight.position.set(3.5, 5, 5);
      keyLight.castShadow = true;
      scene.add(keyLight);
      const rimLight = new THREE.PointLight(0x60a5fa, 18, 12);
      rimLight.position.set(-3, 1.5, 3);
      scene.add(rimLight);

      const model = this.buildMascot(THREE);
      scene.add(model.character);

      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(1.45, 40),
        new THREE.ShadowMaterial({ color: 0x172554, opacity: 0.24 }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(0, -1.45, 0.15);
      shadow.receiveShadow = true;
      scene.add(shadow);

      this.renderer = renderer;
      this.scene = scene;
      this.camera = camera;
      this.character = model.character;
      this.leftWing = model.leftWing;
      this.rightWing = model.rightWing;
      this.startedAt = performance.now();
      this.rendererReady.set(true);
      this.animate();
    } catch (error: unknown) {
      console.warn('La mascota 3D usó el respaldo SVG:', error);
      this.rendererReady.set(false);
      this.destroyScene();
    }
  }

  private buildMascot(THREE: typeof import('three')): {
    character: Group;
    leftWing: Group;
    rightWing: Group;
  } {
    const mascot = this.mascot.cue()?.mascot || 'dog';
    if (mascot === 'penguin') return this.buildPenguin(THREE);
    if (mascot === 'dragon') return this.buildDragon(THREE);
    return this.buildDog(THREE);
  }

  private buildDog(THREE: typeof import('three')): {
    character: Group;
    leftWing: Group;
    rightWing: Group;
  } {
    const character = new THREE.Group();
    const brown = new THREE.MeshStandardMaterial({ color: 0xb76538, roughness: 0.38 });
    const darkBrown = new THREE.MeshStandardMaterial({ color: 0x71351f, roughness: 0.42 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xffdfb4, roughness: 0.4 });
    const navy = new THREE.MeshStandardMaterial({ color: 0x111b3f, roughness: 0.2 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.32 });

    const body = this.mesh(THREE, new THREE.SphereGeometry(1, 42, 30), brown);
    body.scale.set(0.92, 1.04, 0.82);
    body.position.y = -0.25;
    character.add(body);

    const head = this.mesh(THREE, new THREE.SphereGeometry(0.78, 42, 30), brown);
    head.position.set(0, 0.65, 0.38);
    character.add(head);
    const muzzle = this.mesh(THREE, new THREE.SphereGeometry(0.43, 32, 22), cream);
    muzzle.scale.set(1, 0.68, 0.78);
    muzzle.position.set(0, 0.38, 1.02);
    character.add(muzzle);
    const nose = this.mesh(THREE, new THREE.SphereGeometry(0.14, 24, 18), navy);
    nose.scale.set(1.15, 0.8, 0.75);
    nose.position.set(0, 0.48, 1.32);
    character.add(nose);

    this.addEyes(THREE, character, 0.31, 0.77, 0.99, white, navy);

    const leftWing = new THREE.Group();
    const leftEar = this.mesh(THREE, new THREE.CapsuleGeometry(0.2, 0.52, 8, 18), darkBrown);
    leftEar.rotation.z = 0.48;
    leftWing.add(leftEar);
    leftWing.position.set(-0.61, 0.77, 0.24);
    character.add(leftWing);
    const rightWing = new THREE.Group();
    const rightEar = this.mesh(THREE, new THREE.CapsuleGeometry(0.2, 0.52, 8, 18), darkBrown);
    rightEar.rotation.z = -0.48;
    rightWing.add(rightEar);
    rightWing.position.set(0.61, 0.77, 0.24);
    character.add(rightWing);

    [-0.47, 0.47].forEach((x) => {
      const leg = this.mesh(THREE, new THREE.CapsuleGeometry(0.15, 0.34, 7, 14), brown);
      leg.position.set(x, -1.12, 0.12);
      character.add(leg);
      const paw = this.mesh(THREE, new THREE.SphereGeometry(0.2, 20, 14), cream);
      paw.scale.set(1.12, 0.55, 1.15);
      paw.position.set(x, -1.34, 0.27);
      character.add(paw);
    });

    const bag = this.mesh(THREE, new THREE.BoxGeometry(0.72, 0.65, 0.3), blue);
    bag.position.set(0.72, -0.35, 0.68);
    bag.rotation.z = -0.08;
    character.add(bag);
    const envelope = this.mesh(THREE, new THREE.BoxGeometry(0.46, 0.29, 0.035), white);
    envelope.position.set(0.72, -0.33, 0.85);
    envelope.rotation.z = -0.08;
    character.add(envelope);
    const strap = this.mesh(THREE, new THREE.TorusGeometry(0.71, 0.045, 10, 32, Math.PI), blue);
    strap.position.set(0.1, 0.05, 0.3);
    strap.rotation.set(0.2, 0.05, -0.85);
    character.add(strap);
    const tail = this.mesh(
      THREE,
      new THREE.TorusGeometry(0.34, 0.09, 12, 28, Math.PI * 1.25),
      brown,
    );
    tail.position.set(-0.8, -0.36, -0.45);
    tail.rotation.set(0.4, 0.8, -0.3);
    character.add(tail);
    return { character, leftWing, rightWing };
  }

  private buildPenguin(THREE: typeof import('three')): {
    character: Group;
    leftWing: Group;
    rightWing: Group;
  } {
    const character = new THREE.Group();
    const black = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.27 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.24 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.25 });
    const brown = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.38 });

    const body = this.mesh(THREE, new THREE.SphereGeometry(1, 44, 30), black);
    body.scale.set(0.85, 1.18, 0.72);
    body.position.y = -0.18;
    character.add(body);
    const belly = this.mesh(THREE, new THREE.SphereGeometry(0.76, 36, 24), white);
    belly.scale.set(0.78, 1.08, 0.28);
    belly.position.set(0, -0.2, 0.69);
    character.add(belly);
    const head = this.mesh(THREE, new THREE.SphereGeometry(0.69, 40, 28), black);
    head.position.set(0, 0.86, 0.24);
    character.add(head);
    this.addEyes(THREE, character, 0.27, 0.96, 0.83, white, black);

    const beak = this.mesh(THREE, new THREE.ConeGeometry(0.22, 0.5, 4), orange);
    beak.rotation.x = Math.PI / 2;
    beak.rotation.z = Math.PI / 4;
    beak.position.set(0, 0.73, 1.04);
    character.add(beak);

    const leftWing = new THREE.Group();
    const leftFlipper = this.mesh(THREE, new THREE.CapsuleGeometry(0.18, 0.65, 8, 16), black);
    leftFlipper.rotation.z = 0.55;
    leftWing.add(leftFlipper);
    leftWing.position.set(-0.83, 0, 0);
    character.add(leftWing);
    const rightWing = new THREE.Group();
    const rightFlipper = this.mesh(THREE, new THREE.CapsuleGeometry(0.18, 0.65, 8, 16), black);
    rightFlipper.rotation.z = -0.55;
    rightWing.add(rightFlipper);
    rightWing.position.set(0.83, 0, 0);
    character.add(rightWing);

    [-0.42, 0.42].forEach((x) => {
      const foot = this.mesh(THREE, new THREE.SphereGeometry(0.25, 20, 14), orange);
      foot.scale.set(1.25, 0.35, 1.3);
      foot.position.set(x, -1.35, 0.35);
      character.add(foot);
      const lens = this.mesh(THREE, new THREE.TorusGeometry(0.18, 0.035, 10, 28), blue);
      lens.position.set(x * 0.64, 0.96, 0.92);
      character.add(lens);
    });
    const bridge = this.mesh(THREE, new THREE.CapsuleGeometry(0.025, 0.13, 5, 10), blue);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.96, 0.92);
    character.add(bridge);

    const briefcase = this.mesh(THREE, new THREE.BoxGeometry(0.72, 0.56, 0.26), brown);
    briefcase.position.set(0.86, -0.75, 0.58);
    character.add(briefcase);
    const handle = this.mesh(THREE, new THREE.TorusGeometry(0.19, 0.04, 10, 24, Math.PI), brown);
    handle.position.set(0.86, -0.4, 0.58);
    handle.rotation.z = Math.PI;
    character.add(handle);
    return { character, leftWing, rightWing };
  }

  private buildDragon(THREE: typeof import('three')): {
    character: Group;
    leftWing: Group;
    rightWing: Group;
  } {
    const character = new THREE.Group();
    const teal = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.28 });
    const darkTeal = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.34 });
    const lime = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.36 });
    const purple = new THREE.MeshPhysicalMaterial({ color: 0x8b5cf6, roughness: 0.22 });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const navy = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.2 });

    const body = this.mesh(THREE, new THREE.SphereGeometry(1, 44, 30), teal);
    body.scale.set(0.9, 1.02, 0.82);
    body.position.y = -0.28;
    character.add(body);
    const belly = this.mesh(THREE, new THREE.SphereGeometry(0.72, 34, 24), lime);
    belly.scale.set(0.72, 0.92, 0.25);
    belly.position.set(0, -0.33, 0.78);
    character.add(belly);
    const head = this.mesh(THREE, new THREE.SphereGeometry(0.72, 40, 28), teal);
    head.position.set(0, 0.7, 0.4);
    character.add(head);
    const muzzle = this.mesh(THREE, new THREE.SphereGeometry(0.38, 30, 20), darkTeal);
    muzzle.scale.set(1, 0.6, 0.8);
    muzzle.position.set(0, 0.48, 1.05);
    character.add(muzzle);
    this.addEyes(THREE, character, 0.29, 0.82, 0.98, white, navy);

    [-0.34, 0.34].forEach((x) => {
      const horn = this.mesh(THREE, new THREE.ConeGeometry(0.13, 0.45, 18), white);
      horn.position.set(x, 1.35, 0.23);
      horn.rotation.z = x < 0 ? -0.12 : 0.12;
      character.add(horn);
      const foot = this.mesh(THREE, new THREE.CapsuleGeometry(0.15, 0.28, 7, 14), darkTeal);
      foot.position.set(x * 1.45, -1.17, 0.18);
      character.add(foot);
    });

    const leftWing = new THREE.Group();
    const leftMembrane = this.mesh(THREE, new THREE.ConeGeometry(0.75, 1.3, 3), purple);
    leftMembrane.scale.set(0.38, 1, 0.72);
    leftMembrane.rotation.z = -0.65;
    leftWing.add(leftMembrane);
    leftWing.position.set(-1.08, 0.1, -0.2);
    character.add(leftWing);
    const rightWing = new THREE.Group();
    const rightMembrane = this.mesh(THREE, new THREE.ConeGeometry(0.75, 1.3, 3), purple);
    rightMembrane.scale.set(0.38, 1, 0.72);
    rightMembrane.rotation.z = 0.65;
    rightWing.add(rightMembrane);
    rightWing.position.set(1.08, 0.1, -0.2);
    character.add(rightWing);

    const tail = this.mesh(
      THREE,
      new THREE.TorusGeometry(0.58, 0.11, 14, 36, Math.PI * 1.25),
      teal,
    );
    tail.position.set(-0.72, -0.52, -0.48);
    tail.rotation.set(0.35, 0.6, -0.55);
    character.add(tail);
    return { character, leftWing, rightWing };
  }

  private addEyes(
    THREE: typeof import('three'),
    character: Group,
    xOffset: number,
    y: number,
    z: number,
    white: Material,
    pupilMaterial: Material,
  ): void {
    [-xOffset, xOffset].forEach((x) => {
      const eye = this.mesh(THREE, new THREE.SphereGeometry(0.12, 22, 16), white);
      eye.position.set(x, y, z);
      character.add(eye);
      const pupil = this.mesh(THREE, new THREE.SphereGeometry(0.058, 18, 12), pupilMaterial);
      pupil.position.set(x, y - 0.01, z + 0.105);
      character.add(pupil);
    });
  }

  private mesh(THREE: typeof import('three'), geometry: BufferGeometry, material: Material): Mesh {
    const value = new THREE.Mesh(geometry, material);
    value.castShadow = true;
    value.receiveShadow = true;
    return value;
  }

  private animate = (): void => {
    if (!this.renderer || !this.scene || !this.camera || !this.character) return;
    const elapsed = (performance.now() - this.startedAt) / 1000;
    const trick = this.mascot.cue()?.trick || 'dance';

    this.character.rotation.x = Math.sin(elapsed * 1.8) * 0.04;
    this.character.rotation.z = Math.sin(elapsed * 2.4) * 0.05;
    this.character.rotation.y = Math.sin(elapsed * 0.9) * 0.22;
    this.character.position.y = -0.05 + Math.sin(elapsed * 2.2) * 0.09;

    if (trick === 'dance') {
      this.character.rotation.y = Math.sin(elapsed * 6) * 0.62;
      this.character.rotation.z = Math.sin(elapsed * 8) * 0.12;
    } else if (trick === 'fly') {
      this.character.rotation.z = Math.sin(elapsed * 3) * 0.2;
      this.character.position.y += Math.sin(elapsed * 4) * 0.18;
    } else if (trick === 'peek') {
      this.character.rotation.y = -0.35 + Math.sin(elapsed * 2.5) * 0.18;
    } else {
      this.character.position.y += Math.abs(Math.sin(elapsed * 5.5)) * 0.42;
      this.character.rotation.y = elapsed * 1.8;
    }

    const flap = Math.sin(elapsed * 13) * 0.5;
    if (this.leftWing) this.leftWing.rotation.z = -0.35 + flap;
    if (this.rightWing) this.rightWing.rotation.z = 0.35 - flap;

    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private destroyScene(): void {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.scene?.traverse((object: Object3D) => {
      const candidate = object as Mesh;
      candidate.geometry?.dispose();
      if (Array.isArray(candidate.material)) candidate.material.forEach((item) => item.dispose());
      else candidate.material?.dispose();
    });
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.character = null;
    this.leftWing = null;
    this.rightWing = null;
    if (!this.mascot.cue()) this.canvasElement = null;
    this.rendererReady.set(false);
  }
}
