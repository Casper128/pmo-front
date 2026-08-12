import { Injectable, signal } from '@angular/core';
import { environment } from '@env/environment';

export type MascotMoment = 'page' | 'edit' | 'send' | 'success';
export type MascotTrick = 'fly' | 'dance' | 'peek' | 'celebrate';
export type MascotKind = 'dog' | 'penguin' | 'dragon';

export interface MascotCue {
  id: number;
  moment: MascotMoment;
  mascot: MascotKind;
  trick: MascotTrick;
  message: string;
}

const messages: Record<MascotMoment, readonly string[]> = {
  page: ['¡Ruta lista! Guau.', 'Yo te acompaño por aquí.', 'Página entregada sin novedades.'],
  edit: [
    'Modo consultor activado.',
    'Revisemos ese dato con elegancia.',
    'Gafas listas. Puedes editar.',
  ],
  send: ['¡Llevo tus reportes!', 'Mensajería PMO en camino.', 'Entrega especial de registros.'],
  success: ['¡Misión cumplida!', '¡Confeti, no fuego!', 'Registros aterrizados. ¡A celebrar!'],
};

const mascotForMoment: Record<MascotMoment, MascotKind> = {
  page: 'dog',
  edit: 'penguin',
  send: 'dog',
  success: 'dragon',
};

const tricks: Record<MascotMoment, readonly MascotTrick[]> = {
  page: ['peek', 'dance', 'fly'],
  edit: ['peek', 'dance'],
  send: ['fly', 'dance'],
  success: ['celebrate', 'fly', 'dance'],
};

@Injectable({ providedIn: 'root' })
export class PlayfulMascotService {
  readonly cue = signal<MascotCue | null>(null);
  private clearTimer: number | null = null;
  private sequence = 0;
  private lastPageMoment = 0;

  play(moment: MascotMoment): void {
    if (!environment.playfulMascotEnabled) return;
    const now = Date.now();
    if (moment === 'page' && now - this.lastPageMoment < 1200) return;
    if (moment === 'page') this.lastPageMoment = now;

    const momentMessages = messages[moment];
    const momentTricks = tricks[moment];
    this.cue.set({
      id: ++this.sequence,
      moment,
      mascot: mascotForMoment[moment],
      trick: momentTricks[Math.floor(Math.random() * momentTricks.length)],
      message: momentMessages[Math.floor(Math.random() * momentMessages.length)],
    });

    if (this.clearTimer !== null) window.clearTimeout(this.clearTimer);
    this.clearTimer = window.setTimeout(
      () => {
        this.cue.set(null);
        this.clearTimer = null;
      },
      moment === 'send' ? 7200 : 6400,
    );
  }
}
