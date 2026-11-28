<script lang="ts">
  // Chrono : anneau qui se vide + chiffres Bangers, rose sous 10 s.
  let { deadline, start, now }: { deadline: number; start: number; now: () => number } = $props();
  let current = $state(0);
  $effect(() => {
    current = now();
    const timer = setInterval(() => (current = now()), 250);
    return () => clearInterval(timer);
  });

  const remainingMs = $derived(Math.max(0, deadline - current));
  const seconds = $derived(Math.ceil(remainingMs / 1000));
  const total = $derived(Math.max(1, deadline - start));
  const progress = $derived(Math.min(1, remainingMs / total));
  const R = 26;
  const C = 2 * Math.PI * R;
</script>

<div class="clock" class:hurry={seconds <= 10} role="timer" aria-label="{seconds} secondes restantes">
  <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
    <circle cx="32" cy="32" r={R} class="track" />
    <circle cx="32" cy="32" r={R} class="ring" stroke-dasharray={C} stroke-dashoffset={C * (1 - progress)} />
  </svg>
  <span>{seconds}</span>
</div>

<style>
  .clock {
    position: relative;
    width: 64px;
    height: 64px;
    color: var(--yellow);
  }
  .clock.hurry {
    color: var(--pink);
  }
  svg {
    transform: rotate(-90deg);
  }
  circle {
    fill: none;
    stroke-width: 6;
  }
  .track {
    stroke: var(--band);
  }
  .ring {
    stroke: currentColor;
    transition: stroke-dashoffset 0.25s linear;
  }
  span {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-family: var(--bangers);
    font-size: 26px;
    letter-spacing: 1px;
  }
</style>
