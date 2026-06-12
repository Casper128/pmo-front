import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'fechaEsp', standalone: true })
export class FechaEspPipe implements PipeTransform {
  private dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  private meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  transform(fechaISO: string): string {
    const d = new Date(fechaISO + 'T12:00:00');
    return `${this.dias[d.getDay()]} ${d.getDate()} ${this.meses[d.getMonth()]} ${d.getFullYear()}`;
  }
}
