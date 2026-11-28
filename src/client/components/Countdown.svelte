<script lang="ts">
  // Chrono : petit anneau qui se vide + chiffres Bangers (m:ss), rose sous 10 s.
  let { deadline, start, now }: { deadline: number; start: number; now: () => number } = $props();
  let current = $state(0);
  $effect(() => {
    current = now();
    const timer = setInterval(() => (current = now()), 250);
    return () => clearInterval(timer);
  });

  const remainingMs = $derived(Math.max(0, deadline - current));
  const seconds = $derived(Math.ceil(remainingMs / 1000));
  const label = $derived(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
  const progress = $derived(Math.min(1, remainingMs / Math.max(1, deadline - start)));
  const C = 2 * Math.PI * 12;
</script>

<span class="clock" class:hurry={seconds <= 10} role="timer" aria-label="Temps restant {label}">
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    <circle cx="15" cy="15" r="12" class="track" />
    <circle cx="15" cy="15" r="12" class="ring" stroke-dasharray="{C * progress} {C}" transform="rotate(-90 15 15)" />
  </svg>
  <span class="digits">{label}</span>
</span>

<style>
  .clock {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--paper);
  }
  .clock.hurry {
    color: var(--pink);
  }
  circle {
    fill: none;
    stroke-width: 4;
  }
  .track {
    stroke: #3a3833;
  }
  .ring {
    stroke: currentColor;
    transition: stroke-dasharray 0.25s linear;
  }
  .digits {
    font-family: var(--bangers);
    font-size: 26px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
</style>
