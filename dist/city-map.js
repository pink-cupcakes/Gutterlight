import { scenes, exits } from './city.js';
export function drawCityMap(canvas, s, large = false) {
  const ctx = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#102019';
  ctx.fillRect(0, 0, w, h);
  const sx = w / 8,
    sy = h / 4,
    point = (id) => ({ x: (scenes[id].map[0] + 1) * sx, y: (scenes[id].map[1] + 1) * sy });
  const discovered = new Set(s.city.visited);
  const known = new Set(discovered);
  for (const id of discovered) for (const to of Object.values(scenes[id].neighbors)) known.add(to);
  ctx.lineWidth = large ? 3 : 2;
  for (const id of known) {
    const a = point(id);
    for (const to of Object.values(scenes[id].neighbors)) {
      if (!known.has(to) || (!discovered.has(id) && !discovered.has(to))) continue;
      const b = point(to);
      const shortcut = (id === 'boiler' && to === 'cable') || (id === 'cable' && to === 'boiler');
      ctx.strokeStyle = shortcut ? (s.city.shortcut ? '#d0bb7d' : '#705b43') : '#6d8061';
      ctx.setLineDash(shortcut && !s.city.shortcut ? [4, 5] : []);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  for (const id of known) {
    const p = point(id),
      current = id === s.zone;
    ctx.fillStyle = current ? '#dce9b7' : discovered.has(id) ? '#91a773' : '#384c3b';
    ctx.strokeStyle = current ? '#f6edc3' : '#728261';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, current ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (large) {
      ctx.textAlign = 'center';
      ctx.font = '13px sans-serif';
      ctx.fillStyle = current ? '#eee8c7' : '#b5c3a2';
      ctx.fillText(discovered.has(id) ? scenes[id].name : 'Unexplored street', p.x, p.y + 24);
    }
  }
}
