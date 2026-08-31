// A trimmed, non-animated port of rack.js's renderBack()/landscapeBackDataUrl() —
// draws the back of a postcard already fully "sent" (stamp and address complete,
// no caret/selection) so a previously-sent compliment can be redisplayed without
// loading the 3D rack module.
const CANVAS_W = 960;
const CANVAS_H = 1360;
const TEXT_X = 60;
const TEXT_Y = 70;
const TEXT_LINE_H = 54;
const TEXT_FONT = '400 42px Montserrat, sans-serif';

function layoutText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  text.split('\n').forEach((para) => {
    const words = para.split(' ');
    let line = '';
    words.forEach((word) => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    lines.push(line);
  });
  return lines;
}

export function renderFinishedPostcardBack(text: string, recipientName: string): string {
  const backCanvas = document.createElement('canvas');
  backCanvas.width = CANVAS_W;
  backCanvas.height = CANVAS_H;
  const ctx = backCanvas.getContext('2d')!;

  ctx.save();
  ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
  ctx.rotate(Math.PI / 2);
  ctx.translate(-CANVAS_H / 2, -CANVAS_W / 2);
  const lw = CANVAS_H, lh = CANVAS_W; // logical landscape canvas size once rotated

  ctx.fillStyle = '#f4f7fa'; ctx.fillRect(0, 0, lw, lh);
  ctx.strokeStyle = '#224F82'; ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, lw - 48, lh - 48);
  ctx.beginPath(); ctx.moveTo(lw * 0.55, 40); ctx.lineTo(lw * 0.55, lh - 40); ctx.stroke();
  ctx.setLineDash([10, 10]);
  for (let i = 0; i < 4; i++) {
    const y = lh * 0.42 + i * 70;
    ctx.beginPath(); ctx.moveTo(lw * 0.6, y); ctx.lineTo(lw - 60, y); ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.strokeStyle = '#224F82';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lineLens = [0.72, 0.5, 0.38, 0.22];
  for (let i = 0; i < 4; i++) {
    const y = lh * 0.42 + i * 70 - 14;
    const x0 = lw * 0.6, x1 = lw - 60;
    if (i === 0 && recipientName) {
      ctx.font = '400 34px Montserrat, sans-serif';
      ctx.fillStyle = '#224F82';
      ctx.fillText(recipientName, x0, y);
    } else {
      const target = x0 + (x1 - x0) * lineLens[i];
      ctx.beginPath();
      const steps = Math.max(2, Math.floor((target - x0) / 6));
      for (let s = 0; s <= steps; s++) {
        const x = x0 + ((target - x0) * s) / steps;
        const y2 = y + Math.sin(s * 1.7 + x0 * 0.01) * 4 + Math.sin(s * 0.6) * 2;
        if (s === 0) ctx.moveTo(x, y2); else ctx.lineTo(x, y2);
      }
      ctx.stroke();
    }
  }

  ctx.strokeRect(lw - 190, 60, 130, 170);
  const cx = lw - 190 + 65, cy = 60 + 85;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-8 * Math.PI / 180);
  ctx.fillStyle = '#FFC857';
  ctx.fillRect(-55, -75, 110, 150);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(-55, -75, 110, 150);
  ctx.setLineDash([]);
  ctx.strokeStyle = '#224F82';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, -5, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-50, 40); ctx.lineTo(50, 40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-50, 55); ctx.lineTo(50, 55); ctx.stroke();
  ctx.restore();

  ctx.font = TEXT_FONT;
  const maxWidth = lw * 0.55 - 100;
  const lines = layoutText(ctx, text || '', maxWidth);
  ctx.fillStyle = '#0d1f3f';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, TEXT_X, TEXT_Y + i * TEXT_LINE_H));
  ctx.restore();

  // Kept portrait-baked (matching rack.js's renderBack(), not its
  // landscapeBackDataUrl() undo step) — the physical card mesh stays
  // portrait-shaped, and it's the CSS roll (rotateZ 90deg alongside the
  // rotateY flip) that turns this the right way up as landscape on screen.
  return backCanvas.toDataURL('image/png');
}
