// Звуки тумбы: шорох ящика, скрип петель, стук и звяканье кольца.
// Всё синтезируется прямо в браузере (Web Audio API), поэтому аудиофайлы не нужны.

let ctx = null, master = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem('nightstand-muted') === '1'; } catch { /* хранилище недоступно */ }

export const isMuted = () => muted;

export function setMuted(value) {
    muted = value;
    try { localStorage.setItem('nightstand-muted', value ? '1' : '0'); } catch { /* не страшно */ }
}

// Звук в браузере включается только после клика, поэтому создаём его при первом звуке
function audio() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.8;
        master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

function noise(ac) {
    if (!noiseBuf) {
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    return src;
}

function filter(ac, type, freq, Q = 1) {
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    return f;
}

// Громкость: быстро нарастает, держится и плавно затихает
function envelope(ac, t0, attack, hold, release, peak) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    return g;
}

// Шорох дерева по дереву с неровным трением
function slide(ac, t0, dur, peak, from, to) {
    const src = noise(ac);
    const bp = filter(ac, 'bandpass', from, 0.9);
    bp.frequency.setValueAtTime(from, t0);
    bp.frequency.linearRampToValueAtTime(to, t0 + dur);
    const lp = filter(ac, 'lowpass', 2400);
    const rough = ac.createGain();
    rough.gain.value = 0.7;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 17 + Math.random() * 10;
    const depth = ac.createGain();
    depth.gain.value = 0.3;
    lfo.connect(depth).connect(rough.gain);
    const env = envelope(ac, t0, 0.04, Math.max(0.01, dur - 0.14), 0.1, peak);
    src.connect(bp).connect(lp).connect(rough).connect(env).connect(master);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
}

// Глухой деревянный стук
function knock(ac, t0, freq, peak) {
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(freq * 1.7, t0);
    o.frequency.exponentialRampToValueAtTime(freq, t0 + 0.03);
    o.connect(envelope(ac, t0, 0.003, 0, 0.14, peak)).connect(master);
    o.start(t0);
    o.stop(t0 + 0.2);
    const n = noise(ac);
    n.connect(filter(ac, 'lowpass', 1100)).connect(envelope(ac, t0, 0.002, 0, 0.05, peak * 0.7)).connect(master);
    n.start(t0, Math.random());
    n.stop(t0 + 0.1);
}

// Звяканье латунного кольца-ручки
function tink(ac, t0, peak) {
    for (const [f, k] of [[1870, 1], [2830, 0.6], [4100, 0.35]]) {
        const o = ac.createOscillator();
        o.frequency.value = f * (0.98 + Math.random() * 0.04);
        o.connect(envelope(ac, t0, 0.002, 0, 0.1 + 0.3 * k, peak * k)).connect(master);
        o.start(t0);
        o.stop(t0 + 0.5);
    }
}

// Скрип петель: «прилипание-проскальзывание» — частые короткие звенящие щелчки
function creak(ac, t0, dur, peak, pitch = 1) {
    const sr = ac.sampleRate, len = Math.ceil(dur * sr);
    const buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const ring = Math.ceil(0.012 * sr), decay = 0.0035 * sr;
    let phase = 0, max = 0;
    for (let i = 0; i < len; i++) {
        const t = i / len;
        phase += (55 + 70 * Math.sin(t * Math.PI) + 15 * Math.sin(t * 23)) * pitch / sr;
        if (phase < 1) continue;
        phase -= 1;
        const f1 = 900 * pitch * (1 + 0.15 * Math.sin(t * 7));
        const amp = Math.pow(Math.sin(t * Math.PI), 0.7) * (0.7 + Math.random() * 0.3);
        for (let k = 0; k < ring && i + k < len; k++) {
            const w = (2 * Math.PI * k) / sr;
            d[i + k] += amp * Math.exp(-k / decay) * (0.6 * Math.sin(w * f1) + 0.3 * Math.sin(w * f1 * 1.9) + 0.15 * Math.sin(w * f1 * 3.1));
        }
    }
    for (let i = 0; i < len; i++) max = Math.max(max, Math.abs(d[i]));
    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.value = max ? peak / max : 0;
    src.connect(filter(ac, 'highpass', 300)).connect(g).connect(master);
    src.start(t0);
}

// ---------- Звуки тумбы ----------
export function playDrawer(open) {
    if (muted) return;
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + 0.01;
    if (open) {
        slide(ac, t, 0.5, 0.45, 650, 1100);
        knock(ac, t + 0.47, 170, 0.22);
        tink(ac, t + 0.5, 0.05);
    } else {
        slide(ac, t, 0.4, 0.4, 1100, 700);
        knock(ac, t + 0.4, 130, 0.55);
        tink(ac, t + 0.42, 0.04);
    }
}

export function playDoor(open) {
    if (muted) return;
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + 0.01;
    if (open) {
        knock(ac, t, 900, 0.08);             // щелчок защёлки
        creak(ac, t + 0.04, 0.75, 0.22, 1);
    } else {
        creak(ac, t, 0.35, 0.14, 1.2);
        knock(ac, t + 0.38, 120, 0.6);       // дверца закрылась
        knock(ac, t + 0.4, 1100, 0.07);
    }
}
